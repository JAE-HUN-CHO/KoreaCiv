import type {
  CityComputed,
  CityRawRecord,
  FacilityPoint,
  GridStats,
  HexTile,
  ProvinceCode,
  ReliefType,
  TerrainType,
} from '../types/civ';
import { CIV_RULES } from '../data/rules';
import {
  getPlainScore,
  isMarshZone,
  kmToLatLon,
  latLonToKm,
  locateLandGroup,
  sampleElevationM,
} from '../data/koreaGeography';
import { buildComputedCities, RAW_CITIES } from '../data/koreaCities';
import { KOREA_FACILITIES } from '../data/koreaFacilities';
import { classifyReliefByRule, lookupHexTerrain } from '../data/terrainData';
import type {
  LiveBootstrapResponse,
  LiveBoundaryFeature,
  LiveSgisStatItem,
} from '../services/publicApis';

export interface LiveWorldMeta {
  isLive: boolean;
  fetchedAt: string;
  sgisYear: string | null;
  kosisPopYear: string | null;
  kosisAgingYear: string | null;
  kosisGrdpYear: string | null;
  provinceBoundaries: LiveBoundaryFeature[];
  sigunguBoundaries: LiveBoundaryFeature[];
  cityBoundariesByCityId: Map<string, [number, number][][]>;
  sgisSubdistrictsByCityId: Map<string, LiveSgisStatItem[]>;
  updatedCityCount: number;
  boundaryHexCount: number;
}

export interface KoreaCivWorld {
  hexes: HexTile[];
  hexMap: Map<string, HexTile>;
  cities: CityComputed[];
  cityMap: Map<string, CityComputed>;
  facilities: FacilityPoint[];
  wonders: FacilityPoint[];
  stats: GridStats;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  liveMeta?: LiveWorldMeta;
}

/**
 * 5km 정육각형 (pointy-top) 기하 상수
 * 마주 보는 변 사이 거리(width) = 5.0 km
 * 반지름(center to vertex) R = width / sqrt(3) ≈ 2.88675 km
 * 육각형 1칸 면적 = (sqrt(3) / 2) * width^2 ≈ 21.65 km²
 */
export const HEX_WIDTH_KM = CIV_RULES.grid.hexFlatToFlatKm;
export const HEX_RADIUS_KM = HEX_WIDTH_KM / Math.sqrt(3);
export const HEX_AREA_KM2 = (Math.sqrt(3) / 2) * HEX_WIDTH_KM * HEX_WIDTH_KM;

export function axialToKm(q: number, r: number): { x: number; y: number } {
  const x = HEX_WIDTH_KM * (q + r / 2);
  const y = HEX_RADIUS_KM * 1.5 * r;
  return { x, y };
}

// 육각형 내부 7개 샘플 포인트(중심 + 6개 내접점)로 육지 비율 및 DEM 기복 산출
const SAMPLE_OFFSETS: [number, number][] = [
  [0, 0],
  [HEX_RADIUS_KM * 0.62, 0],
  [-HEX_RADIUS_KM * 0.62, 0],
  [HEX_RADIUS_KM * 0.31, HEX_RADIUS_KM * 0.54],
  [-HEX_RADIUS_KM * 0.31, HEX_RADIUS_KM * 0.54],
  [HEX_RADIUS_KM * 0.31, -HEX_RADIUS_KM * 0.54],
  [-HEX_RADIUS_KM * 0.31, -HEX_RADIUS_KM * 0.54],
];

const SGIS_CODE_TO_PROVINCE: Record<string, ProvinceCode> = {
  '11': 'seoul',
  '21': 'busan',
  '22': 'daegu',
  '23': 'incheon',
  '24': 'gwangju',
  '25': 'daejeon',
  '26': 'ulsan',
  '29': 'sejong',
  '31': 'gyeonggi',
  '32': 'gangwon',
  '33': 'chungbuk',
  '34': 'chungnam',
  '35': 'jeonbuk',
  '36': 'jeonnam',
  '37': 'gyeongbuk',
  '38': 'gyeongnam',
  '39': 'jeju',
};

const METRO_SIDO_TO_CITY_ID: Record<string, string> = {
  '11': 'seoul',
  '21': 'busan',
  '22': 'daegu',
  '23': 'incheon',
  '24': 'gwangju',
  '25': 'daejeon',
  '26': 'ulsan',
  '29': 'sejong',
};

const KOSIS_CODE_PREFIX_TO_PROVINCE: Record<string, ProvinceCode> = {
  '11': 'seoul',
  '26': 'busan',
  '27': 'daegu',
  '28': 'incheon',
  '29': 'gwangju',
  '30': 'daejeon',
  '31': 'ulsan',
  '36': 'sejong',
  '41': 'gyeonggi',
  '42': 'gangwon',
  '51': 'gangwon',
  '43': 'chungbuk',
  '44': 'chungnam',
  '45': 'jeonbuk',
  '52': 'jeonbuk',
  '46': 'jeonnam',
  '47': 'gyeongbuk',
  '48': 'gyeongnam',
  '50': 'jeju',
};

const KOSIS_PROVINCE_NAME_MAP: Record<string, ProvinceCode> = {
  서울특별시: 'seoul',
  부산광역시: 'busan',
  대구광역시: 'daegu',
  인천광역시: 'incheon',
  광주광역시: 'gwangju',
  대전광역시: 'daejeon',
  울산광역시: 'ulsan',
  세종특별자치시: 'sejong',
  경기도: 'gyeonggi',
  강원특별자치도: 'gangwon',
  강원도: 'gangwon',
  충청북도: 'chungbuk',
  충청남도: 'chungnam',
  전북특별자치도: 'jeonbuk',
  전라북도: 'jeonbuk',
  전라남도: 'jeonnam',
  경상북도: 'gyeongbuk',
  경상남도: 'gyeongnam',
  제주특별자치도: 'jeju',
};

// 섬 그룹별 소속 도시 필터
function getCityIslandGroup(cityId: string): HexTile['islandGroup'] {
  if (cityId === 'jeju_si' || cityId === 'seogwipo') return 'jeju';
  if (cityId === 'ulleung') return 'ulleung';
  if (cityId === 'geoje') return 'geoje';
  if (cityId === 'namhae') return 'namhae';
  if (cityId === 'jindo') return 'jindo';
  if (cityId === 'wando') return 'wando';
  return 'mainland';
}

/**
 * 칸의 표고·기복·토지피복 결정.
 * 원자료 집계(pipeline/terrain.py)가 있으면 그 값을 쓰고, 없는 칸(DEM 육지 화소가 없는 작은 섬 등)만
 * 합성 표고 모델(샘플 7점)로 추정함. 기복 판정은 두 경우 모두 PLAN.md 규칙(300m / 600m)
 */
function resolveHexTerrain(
  id: string,
  sumElev: number,
  minElev: number,
  maxElev: number
): { elevationM: number; reliefM: number; relief: ReliefType; landCoverTerrain?: TerrainType } {
  const real = lookupHexTerrain(id);
  if (real) {
    return {
      elevationM: real.elevationM,
      reliefM: real.reliefM,
      relief: classifyReliefByRule(real.reliefM),
      landCoverTerrain: real.terrain,
    };
  }
  const elevationM = Math.round(sumElev / SAMPLE_OFFSETS.length);
  const reliefM = Math.round((maxElev - minElev) * 1.45);
  return { elevationM, reliefM, relief: classifyReliefByRule(reliefM) };
}

function classifyTerrain(
  popDensity: number,
  elevationM: number,
  relief: ReliefType,
  plainScore: number,
  marsh: boolean,
  isCoastal: boolean,
  cityAgriShare: number
): TerrainType {
  if (popDensity >= 1450) return 'urban';
  if (marsh && elevationM < 65 && isCoastal) return 'marsh';
  if (marsh && elevationM < 55) return 'marsh';
  if (relief === 'mountain') {
    return elevationM > 1150 ? 'barren' : 'forest';
  }
  if (elevationM >= 230 || relief === 'hills') {
    if (plainScore > 0.45 && elevationM < 280) return 'farmland';
    return 'forest';
  }
  if (plainScore >= 0.25 || (elevationM < 135 && cityAgriShare >= 14)) {
    return 'farmland';
  }
  if (elevationM < 110 && popDensity >= 480) {
    return 'urban';
  }
  if (elevationM < 145) {
    return cityAgriShare >= 7 ? 'farmland' : 'grassland';
  }
  return 'forest';
}

function toCivYieldGrade(val: number, thresholds: [number, number, number, number, number]): number {
  if (val >= thresholds[4]) return 6;
  if (val >= thresholds[3]) return 5;
  if (val >= thresholds[2]) return 4;
  if (val >= thresholds[1]) return 3;
  if (val >= thresholds[0]) return 2;
  return 1;
}

function pointInTupleRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

interface IndexedCityRing {
  cityId: string;
  province: ProvinceCode;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  ring: [number, number][];
}

function normalizeCityBaseName(name: string): string {
  return name.replace(/\(.*\)$/, '').trim().split(/\s+/)[0];
}

function resolveSgisCityId(
  sidoCd: string,
  admNm: string,
  cityByProvName: Map<string, string>
): string | null {
  if (METRO_SIDO_TO_CITY_ID[sidoCd]) {
    return METRO_SIDO_TO_CITY_ID[sidoCd];
  }
  const province = SGIS_CODE_TO_PROVINCE[sidoCd];
  if (!province) return null;
  const tokens = admNm.trim().split(/\s+/);
  for (const tok of tokens) {
    const hit = cityByProvName.get(`${province}:${tok}`);
    if (hit) return hit;
  }
  const base = normalizeCityBaseName(admNm);
  return cityByProvName.get(`${province}:${base}`) ?? null;
}

type RawHexSeed = Omit<
  HexTile,
  | 'isCoastal'
  | 'population'
  | 'populationDensity'
  | 'grdp100M'
  | 'grdpPerCapitaManwon'
  | 'manufacturingWorkers'
  | 'scienceScore'
  | 'foodScore'
  | 'cultureDensity'
  | 'nearbyCulturalCount'
  | 'civGold'
  | 'civProduction'
  | 'civFood'
  | 'civScience'
  | 'terrain'
> & {
  /** 원자료(ESA WorldCover) 토지피복 최다 유형. 없으면 추정 규칙으로 판정 */
  landCoverTerrain?: TerrainType;
};

function assembleWorldFromCitiesAndHexes(
  cities: CityComputed[],
  rawHexes: RawHexSeed[],
  landCoordsSet: Set<string>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  liveMeta?: LiveWorldMeta
): KoreaCivWorld {
  const cityMap = new Map<string, CityComputed>();
  cities.forEach((c) => cityMap.set(c.id, c));

  // 6방 이웃 검사로 해안 타일 판정 + 도시별 타일 묶기
  const NEIGHBOR_DIRS: [number, number][] = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];

  const hexesByCity = new Map<string, RawHexSeed[]>();
  const coastalMap = new Map<string, boolean>();

  for (const h of rawHexes) {
    let coastal = false;
    for (const [dq, dr] of NEIGHBOR_DIRS) {
      if (!landCoordsSet.has(`${h.q + dq},${h.r + dr}`)) {
        coastal = true;
        break;
      }
    }
    coastalMap.set(h.id, coastal);

    const list = hexesByCity.get(h.cityId) ?? [];
    list.push(h);
    hexesByCity.set(h.cityId, list);
  }

  // 안전장치: 0-타일 도시 방지 (초소형 도서/시군이 누락되지 않도록 가장 가까운 타일 1칸 보장)
  for (const city of cities) {
    if ((hexesByCity.get(city.id)?.length ?? 0) > 0) continue;
    let bestHex: RawHexSeed | null = null;
    let bestD2 = Infinity;
    for (const h of rawHexes) {
      if ((hexesByCity.get(h.cityId)?.length ?? 0) <= 1) continue;
      const dx = h.x - city.centerX;
      const dy = h.y - city.centerY;
      const d2 = dx * dx + dy * dy + (h.province === city.province ? 0 : 400);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestHex = h;
      }
    }
    if (bestHex) {
      const oldList = hexesByCity.get(bestHex.cityId);
      if (oldList) {
        const idx = oldList.indexOf(bestHex);
        if (idx >= 0) oldList.splice(idx, 1);
      }
      bestHex.cityId = city.id;
      bestHex.province = city.province;
      hexesByCity.set(city.id, [bestHex]);
    }
  }

  // 시군구 통계를 소속 육각 타일로 인구 가중 배분 (합계 보존 0.00% 오차)
  const hexes: HexTile[] = [];
  const hexMap = new Map<string, HexTile>();

  let allocatedPopSum = 0;
  let allocatedGrdpSum = 0;
  let allocatedMfgSum = 0;
  let targetPopSum = 0;
  let targetGrdpSum = 0;
  let targetMfgSum = 0;

  for (const city of cities) {
    const cityRawHexes = hexesByCity.get(city.id) ?? [];
    if (cityRawHexes.length === 0) continue;

    targetPopSum += city.population;
    targetGrdpSum += city.grdpBillionKrw;
    const cityMfgWorkers = city.totalWorkers * (city.shares.manufacturing / 100);
    targetMfgSum += cityMfgWorkers;

    const sigma = city.tier === 1 ? 12 : city.tier === 2 ? 10 : 8.5;
    const weights: number[] = [];
    let weightSum = 0;
    let closestHexId = cityRawHexes[0].id;
    let closestD2 = Infinity;

    for (const h of cityRawHexes) {
      const dx = h.x - city.centerX;
      const dy = h.y - city.centerY;
      const d2 = dx * dx + dy * dy;
      if (d2 < closestD2) {
        closestD2 = d2;
        closestHexId = h.id;
      }
      const distDecay = Math.exp(-d2 / (2 * sigma * sigma));
      const elevPenalty = h.relief === 'mountain' ? 0.14 : h.relief === 'hills' ? 0.48 : 1.0;
      const w = (0.12 + 0.88 * distDecay) * elevPenalty * h.landFraction;
      weights.push(w);
      weightSum += w;
    }

    city.hexCount = cityRawHexes.length;
    city.centerHexId = closestHexId;
    city.areaKm2 = Math.round(cityRawHexes.length * HEX_AREA_KM2);
    city.populationDensity = Math.round(city.population / Math.max(1, city.areaKm2));

    for (let i = 0; i < cityRawHexes.length; i++) {
      const h = cityRawHexes[i];
      const frac = weights[i] / (weightSum || 1);
      const pop = city.population * frac;
      const popDensity = pop / (HEX_AREA_KM2 * Math.max(0.35, h.landFraction));
      const grdp100M = city.grdpBillionKrw * frac;
      const mfgWorkers = cityMfgWorkers * frac;

      allocatedPopSum += pop;
      allocatedGrdpSum += grdp100M;
      allocatedMfgSum += mfgWorkers;

      const isCoastal = coastalMap.get(h.id) ?? false;
      const plainScore = getPlainScore(h.x, h.y);
      const marsh = isMarshZone(h.x, h.y);

      const terrain = h.landCoverTerrain ?? classifyTerrain(
        popDensity,
        h.elevationM,
        h.relief,
        plainScore,
        marsh,
        isCoastal,
        city.shares.agriculture
      );

      const foodScore =
        (terrain === 'farmland' ? 35 : terrain === 'grassland' ? 18 : 6) +
        city.shares.agriculture * 1.4 +
        plainScore * 25;

      const ictWorkersTile = city.totalWorkers * (city.shares.ictScience / 100) * frac;
      const scienceScore =
        ictWorkersTile * 0.08 + city.universityRd100M * frac * 0.25 + city.shares.ictScience * 2;

      const tile: HexTile = {
        ...h,
        terrain,
        isCoastal,
        population: Math.round(pop),
        populationDensity: Math.round(popDensity),
        grdp100M: Number(grdp100M.toFixed(1)),
        grdpPerCapitaManwon: city.grdpPerCapitaManwon,
        manufacturingWorkers: Math.round(mfgWorkers),
        scienceScore: Number(scienceScore.toFixed(1)),
        foodScore: Number(foodScore.toFixed(1)),
        cultureDensity: 0,
        nearbyCulturalCount: 0,
        civGold: toCivYieldGrade(grdp100M, [250, 900, 2800, 8000, 25000]),
        civProduction: toCivYieldGrade(mfgWorkers, [180, 650, 2000, 6000, 15000]),
        civFood: toCivYieldGrade(foodScore, [22, 36, 52, 68, 84]),
        civScience: toCivYieldGrade(scienceScore, [10, 25, 55, 130, 320]),
      };

      hexes.push(tile);
      hexMap.set(tile.id, tile);
    }
  }

  // 시설물 및 불가사의를 최근접 육지 타일에 매핑
  const facilities: FacilityPoint[] = KOREA_FACILITIES.map((f) => {
    const pt = latLonToKm(f.lat, f.lon);
    let nearestHex: HexTile | undefined;
    let bestD2 = Infinity;
    for (let i = 0; i < hexes.length; i++) {
      const h = hexes[i];
      const dx = h.x - pt.x;
      const dy = h.y - pt.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        nearestHex = h;
      }
    }
    return {
      ...f,
      x: pt.x,
      y: pt.y,
      hexId: nearestHex?.id,
    };
  });

  // 대학 연구비 가산
  for (const f of facilities) {
    if (f.type === 'university' && f.hexId) {
      const tile = hexMap.get(f.hexId);
      if (tile) {
        tile.scienceScore = Number((tile.scienceScore + f.metricValue * 0.12).toFixed(1));
        tile.civScience = Math.min(6, Math.max(tile.civScience, f.isWonder ? 6 : 5));
      }
    }
  }

  // 5km 육각 격자별 공간 문화 밀도(Culture Hotspots) 계산 — 가우시안 커널 밀도 추정
  const culturalSites = facilities.filter((f) => f.type === 'cultural_site' && f.x !== undefined && f.y !== undefined);
  const parkSites = facilities.filter((f) => f.type === 'national_park' && f.x !== undefined && f.y !== undefined);
  const univSites = facilities.filter((f) => f.type === 'university' && f.x !== undefined && f.y !== undefined);

  const citySiteCountMap = new Map<string, number>();
  for (const site of culturalSites) {
    citySiteCountMap.set(site.cityId, (citySiteCountMap.get(site.cityId) ?? 0) + 1);
  }

  const cityDensityStats = new Map<string, { peak: number; sum: number; count: number }>();
  const RADIUS_25KM_SQ = 25 * 25;
  const SIGMA_CULTURAL_SQ = 2 * 18 * 18; // 주 문화유산·국립박물관 커널 반경 18km
  const SIGMA_CORE_SQ = 2 * 7.5 * 7.5;   // 핵심 랜드마크 피크 강조 7.5km
  const SIGMA_AUX_SQ = 2 * 14 * 14;      // 국립공원·대학 박물관 보조 커널 14km

  for (let i = 0; i < hexes.length; i++) {
    const tile = hexes[i];
    const city = cityMap.get(tile.cityId);
    let rawDensity = 0;
    let nearbyCount = 0;

    for (let j = 0; j < culturalSites.length; j++) {
      const s = culturalSites[j];
      const dx = tile.x - (s.x as number);
      const dy = tile.y - (s.y as number);
      const d2 = dx * dx + dy * dy;
      if (d2 <= RADIUS_25KM_SQ) nearbyCount += 1;
      if (d2 > 68 * 68) continue;
      // 방문객 규모 로그 가중치 + 유네스코/불가사의 가중
      const weight = 20 + Math.log10(Math.max(40, s.metricValue)) * 12 + (s.isWonder ? 14 : 0);
      rawDensity += weight * (0.68 * Math.exp(-d2 / SIGMA_CULTURAL_SQ) + 0.45 * Math.exp(-d2 / SIGMA_CORE_SQ));
    }

    // 국립공원 명승지·대학 박물관/공연장 보조 문화 영향
    for (let j = 0; j < parkSites.length; j++) {
      const p = parkSites[j];
      const dx = tile.x - (p.x as number);
      const dy = tile.y - (p.y as number);
      const d2 = dx * dx + dy * dy;
      if (d2 > 36 * 36) continue;
      rawDensity += 7.5 * Math.exp(-d2 / SIGMA_AUX_SQ);
    }

    for (let j = 0; j < univSites.length; j++) {
      const u = univSites[j];
      const dx = tile.x - (u.x as number);
      const dy = tile.y - (u.y as number);
      const d2 = dx * dx + dy * dy;
      if (d2 > 30 * 30) continue;
      rawDensity += 6.0 * Math.exp(-d2 / SIGMA_AUX_SQ);
    }

    // 지역 관광·예술여가 기반 기저 문화값 소폭 반영
    if (city) {
      rawDensity += Math.min(12, city.shares.hospitality * 0.45);
    }

    // 비선형 압축으로 0~100 핫스팟 지수화 (서울·경주·수원·전주·광주·부여·공주·안동 핫스팟 선명화)
    const normalized = Math.min(100, Math.round(100 * (1 - Math.exp(-rawDensity / 56))));
    tile.cultureDensity = normalized;
    tile.nearbyCulturalCount = nearbyCount;

    const st = cityDensityStats.get(tile.cityId) ?? { peak: 0, sum: 0, count: 0 };
    if (normalized > st.peak) st.peak = normalized;
    st.sum += normalized;
    st.count += 1;
    cityDensityStats.set(tile.cityId, st);
  }

  // 시군구별 문화유산 수 및 공간 문화 밀도 점수 반영
  for (const city of cities) {
    const siteCount = citySiteCountMap.get(city.id) ?? 0;
    const st = cityDensityStats.get(city.id);
    const meanDens = st && st.count > 0 ? st.sum / st.count : 0;
    const peakDens = st ? st.peak : 0;
    city.culturalSiteCount = siteCount;
    city.cultureScore = Math.min(100, Math.round(peakDens * 0.65 + meanDens * 0.35));
    city.yields.culture = Math.max(city.yields.culture, Math.round(city.cultureScore * 0.8 + siteCount * 12));
  }

  const wonderOrder = { natural: 0, academic: 1, cultural: 2 };
  const wonders = facilities
    .filter((f) => f.isWonder)
    .sort((a, b) => {
      if (a.wonderKind !== b.wonderKind) {
        return (wonderOrder[a.wonderKind ?? 'natural'] ?? 9) - (wonderOrder[b.wonderKind ?? 'natural'] ?? 9);
      }
      return (a.wonderRank ?? 99) - (b.wonderRank ?? 99);
    });

  const stats: GridStats = {
    totalLandHexes: hexes.length,
    hexWidthKm: HEX_WIDTH_KM,
    hexAreaKm2: Number(HEX_AREA_KM2.toFixed(2)),
    totalLandAreaKm2: Math.round(hexes.length * HEX_AREA_KM2),
    grdpConservationErrorPct:
      targetGrdpSum > 0
        ? Number(((Math.abs(allocatedGrdpSum - targetGrdpSum) / targetGrdpSum) * 100).toFixed(4))
        : 0,
    popConservationErrorPct:
      targetPopSum > 0
        ? Number(((Math.abs(allocatedPopSum - targetPopSum) / targetPopSum) * 100).toFixed(4))
        : 0,
    mfgConservationErrorPct:
      targetMfgSum > 0
        ? Number(((Math.abs(allocatedMfgSum - targetMfgSum) / targetMfgSum) * 100).toFixed(4))
        : 0,
    totalCities: cities.length,
    totalFacilities: facilities.length,
    naturalWondersCount: wonders.filter((w) => w.wonderKind === 'natural').length,
    academicWondersCount: wonders.filter((w) => w.wonderKind === 'academic').length,
    culturalWondersCount: wonders.filter((w) => w.wonderKind === 'cultural').length,
  };

  return {
    hexes,
    hexMap,
    cities,
    cityMap,
    facilities,
    wonders,
    stats,
    bounds,
    liveMeta,
  };
}

let cachedWorld: KoreaCivWorld | null = null;

/**
 * 초기 즉시 렌더링용 5km 육각 격자 생성 (오프라인 내장 기준)
 */
export function getKoreaCivWorld(): KoreaCivWorld {
  if (cachedWorld) return cachedWorld;

  const cities = buildComputedCities();
  const cityMap = new Map<string, CityComputed>();
  cities.forEach((c) => cityMap.set(c.id, c));

  const citiesByGroup = new Map<string, CityComputed[]>();
  for (const c of cities) {
    const grp = getCityIslandGroup(c.id);
    const arr = citiesByGroup.get(grp) ?? [];
    arr.push(c);
    citiesByGroup.set(grp, arr);
  }
  const mainlandCities = citiesByGroup.get('mainland') ?? [];

  const minR = -72;
  const maxR = 78;
  const minQ = -68;
  const maxQ = 82;

  const rawHexes: RawHexSeed[] = [];
  const landCoordsSet = new Set<string>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let r = minR; r <= maxR; r++) {
    for (let q = minQ; q <= maxQ; q++) {
      const { x, y } = axialToKm(q, r);
      if (x < -160 || x > 330 || y < -305 || y > 335) continue;

      let landHits = 0;
      let primaryGroup: HexTile['islandGroup'] | null = null;
      let minElev = Infinity;
      let maxElev = -Infinity;
      let sumElev = 0;

      for (let s = 0; s < SAMPLE_OFFSETS.length; s++) {
        const sx = x + SAMPLE_OFFSETS[s][0];
        const sy = y + SAMPLE_OFFSETS[s][1];
        const grp = locateLandGroup(sx, sy);
        if (grp) {
          landHits++;
          if (!primaryGroup) primaryGroup = grp;
        }
        const e = sampleElevationM(sx, sy);
        if (e < minElev) minElev = e;
        if (e > maxElev) maxElev = e;
        sumElev += e;
      }

      const landFraction = landHits / SAMPLE_OFFSETS.length;
      if (landFraction < CIV_RULES.grid.minLandFraction || !primaryGroup) continue;

      const id = `${q},${r}`;
      const { elevationM, reliefM, relief, landCoverTerrain } = resolveHexTerrain(
        id,
        sumElev,
        minElev,
        maxElev
      );
      const { lat, lon } = kmToLatLon(x, y);

      let candidates = citiesByGroup.get(primaryGroup);
      if (!candidates || candidates.length === 0) {
        if (primaryGroup === 'ganghwa') {
          candidates = [cityMap.get('incheon')!];
        } else {
          candidates = mainlandCities;
        }
      }

      let bestCity = candidates[0];
      let bestDist2 = Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const dx = x - c.centerX;
        const dy = y - c.centerY;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
          bestDist2 = d2;
          bestCity = c;
        }
      }

      landCoordsSet.add(id);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      rawHexes.push({
        id,
        q,
        r,
        x,
        y,
        lat,
        lon,
        landFraction,
        islandGroup: primaryGroup,
        elevationM,
        reliefM,
        relief,
        landCoverTerrain,
        cityId: bestCity.id,
        province: bestCity.province,
      });
    }
  }

  cachedWorld = assembleWorldFromCitiesAndHexes(cities, rawHexes, landCoordsSet, {
    minX,
    maxX,
    minY,
    maxY,
  });

  return cachedWorld;
}

/**
 * 실시간 SGIS 공식 행정경계 GeoJSON + SGIS 2024 시군구 실측 + KOSIS 2024~2025 최신 통계로
 * 5km 육각 격자 경계·도시 소속·통계·지구를 완전히 재구축
 */
export function rebuildWorldWithLiveApiData(bootstrap: LiveBootstrapResponse): KoreaCivWorld {
  // 1. (시도, 기본 도시명) → cityId 인덱스 구축
  const cityByProvName = new Map<string, string>();
  for (const c of RAW_CITIES) {
    cityByProvName.set(`${c.province}:${normalizeCityBaseName(c.name)}`, c.id);
    cityByProvName.set(`${c.province}:${c.name}`, c.id);
  }

  // 2. SGIS 2024 시군구 실측 통계 집계 (자치구·일반구 → 161개 도시 합산)
  const sgisSubdistrictsByCityId = new Map<string, LiveSgisStatItem[]>();
  const sgisAggByCityId = new Map<
    string,
    {
      pop: number;
      corp: number;
      workers: number;
      ageWeightedSum: number;
      agedIdxWeightedSum: number;
    }
  >();

  for (const item of bootstrap.sgisStats) {
    const cityId = resolveSgisCityId(item.sidoCd, item.admNm, cityByProvName);
    if (!cityId) continue;
    const list = sgisSubdistrictsByCityId.get(cityId) ?? [];
    list.push(item);
    sgisSubdistrictsByCityId.set(cityId, list);

    const agg = sgisAggByCityId.get(cityId) ?? {
      pop: 0,
      corp: 0,
      workers: 0,
      ageWeightedSum: 0,
      agedIdxWeightedSum: 0,
    };
    agg.pop += item.totPpltn;
    agg.corp += item.corpCnt;
    agg.workers += item.employeeCnt;
    agg.ageWeightedSum += item.avgAge * item.totPpltn;
    agg.agedIdxWeightedSum += item.agedChildIdx * item.totPpltn;
    sgisAggByCityId.set(cityId, agg);
  }

  // 3. KOSIS 최신 시군구 인구(2025) & 고령화율(2025) 인덱스
  const kosisPopByCityId = new Map<string, number>();
  for (const row of bootstrap.kosisLatest.popRows) {
    if (row.value <= 0) continue;
    const provFromName = KOSIS_PROVINCE_NAME_MAP[row.region.trim()];
    if (provFromName && (provFromName === 'seoul' || provFromName === 'busan' || provFromName === 'daegu' || provFromName === 'incheon' || provFromName === 'gwangju' || provFromName === 'daejeon' || provFromName === 'ulsan' || provFromName === 'sejong')) {
      kosisPopByCityId.set(provFromName, row.value);
      continue;
    }
    const prov = KOSIS_CODE_PREFIX_TO_PROVINCE[row.regionCode.slice(0, 2)];
    if (!prov) continue;
    const base = normalizeCityBaseName(row.region);
    const cid = cityByProvName.get(`${prov}:${base}`);
    if (cid) {
      // 일반구 합산이 아닌 본시 행(예: 수원시) 우선, 이미 있으면 큰 값 유지
      const prev = kosisPopByCityId.get(cid) ?? 0;
      if (row.value > prev) kosisPopByCityId.set(cid, row.value);
    }
  }

  const kosisAgingByCityId = new Map<string, number>();
  for (const row of bootstrap.kosisLatest.agingRows) {
    if (row.value <= 0) continue;
    const provFromName = KOSIS_PROVINCE_NAME_MAP[row.region.trim()];
    if (provFromName && (provFromName === 'seoul' || provFromName === 'busan' || provFromName === 'daegu' || provFromName === 'incheon' || provFromName === 'gwangju' || provFromName === 'daejeon' || provFromName === 'ulsan' || provFromName === 'sejong')) {
      kosisAgingByCityId.set(provFromName, row.value);
      continue;
    }
    const agingSidoPrefix =
      row.regionCode.startsWith('12') && row.regionCode.length >= 4
        ? row.regionCode.slice(2, 4)
        : row.regionCode.slice(0, 2);
    const prov = SGIS_CODE_TO_PROVINCE[agingSidoPrefix];
    if (!prov) continue;
    const base = normalizeCityBaseName(row.region);
    const cid = cityByProvName.get(`${prov}:${base}`);
    if (cid && !kosisAgingByCityId.has(cid)) {
      kosisAgingByCityId.set(cid, row.value);
    }
  }

  // 4. KOSIS 최신 시도별 명목 GRDP (2024, 백만원 → 억원)
  const liveGrdp100MByProv = new Map<ProvinceCode, number>();
  for (const row of bootstrap.kosisLatest.grdpBySido) {
    const prov = KOSIS_PROVINCE_NAME_MAP[row.region.trim()];
    if (prov && row.valueMillionKrw > 0) {
      liveGrdp100MByProv.set(prov, row.valueMillionKrw / 100);
    }
  }

  const builtinGrdpSumByProv = new Map<ProvinceCode, number>();
  for (const c of RAW_CITIES) {
    builtinGrdpSumByProv.set(c.province, (builtinGrdpSumByProv.get(c.province) ?? 0) + c.grdpBillionKrw);
  }

  // 5. 161개 도시 원천 레코드를 최신 API 수치로 갱신
  let updatedCityCount = 0;
  const liveRawCities: CityRawRecord[] = RAW_CITIES.map((raw) => {
    const sgisAgg = sgisAggByCityId.get(raw.id);
    const kosisPop = kosisPopByCityId.get(raw.id);
    const kosisAging = kosisAgingByCityId.get(raw.id);
    const liveProvGrdp = liveGrdp100MByProv.get(raw.province);
    const builtinProvGrdp = builtinGrdpSumByProv.get(raw.province) ?? 0;

    let population = raw.population;
    if (kosisPop && kosisPop > 0) {
      population = Math.round(kosisPop);
    } else if (sgisAgg && sgisAgg.pop > 0) {
      population = Math.round(sgisAgg.pop);
    }

    const agingRate =
      kosisAging && kosisAging > 0 ? Number(kosisAging.toFixed(1)) : raw.agingRate;

    const grdpBillionKrw =
      liveProvGrdp && builtinProvGrdp > 0
        ? Math.round(raw.grdpBillionKrw * (liveProvGrdp / builtinProvGrdp))
        : raw.grdpBillionKrw;

    // SGIS 종사자 수 반영 (비정상 결측치 방지: 기존 대비 0.35~2.8배 범위 내 신뢰값만 적용)
    const totalWorkers =
      sgisAgg &&
      sgisAgg.workers > 0 &&
      sgisAgg.workers >= raw.totalWorkers * 0.35 &&
      sgisAgg.workers <= raw.totalWorkers * 2.8
        ? Math.round(sgisAgg.workers)
        : raw.totalWorkers;

    if (kosisPop || sgisAgg || kosisAging || liveProvGrdp) {
      updatedCityCount++;
    }

    return {
      ...raw,
      population,
      agingRate,
      grdpBillionKrw,
      totalWorkers,
    };
  });

  const cities = buildComputedCities(liveRawCities);

  // 도시별 실시간 연도·SGIS 부가 지표 부착
  for (const city of cities) {
    const sgisAgg = sgisAggByCityId.get(city.id);
    if (kosisPopByCityId.has(city.id) && bootstrap.kosisPopYear) {
      city.livePopYear = `KOSIS ${bootstrap.kosisPopYear}`;
    } else if (sgisAgg && bootstrap.sgisYear) {
      city.livePopYear = `SGIS ${bootstrap.sgisYear}`;
    }
    if (kosisAgingByCityId.has(city.id) && bootstrap.kosisAgingYear) {
      city.liveAgingYear = `KOSIS ${bootstrap.kosisAgingYear}`;
    }
    if (liveGrdp100MByProv.has(city.province) && bootstrap.kosisGrdpYear) {
      city.liveGrdpYear = `KOSIS ${bootstrap.kosisGrdpYear}`;
    }
    if (sgisAgg && sgisAgg.pop > 0) {
      city.liveAvgAge = Number((sgisAgg.ageWeightedSum / sgisAgg.pop).toFixed(1));
      city.liveAgedChildIdx = Number((sgisAgg.agedIdxWeightedSum / sgisAgg.pop).toFixed(1));
      city.liveCorpCnt = sgisAgg.corp;
    }
  }

  // 6. SGIS 공식 시군구 경계 폴리곤을 161개 도시에 매핑하고 바운딩박스 인덱싱
  const indexedRings: IndexedCityRing[] = [];
  const cityBoundariesByCityId = new Map<string, [number, number][][]>();
  const provByCityId = new Map<string, ProvinceCode>();
  cities.forEach((c) => provByCityId.set(c.id, c.province));

  for (const feat of bootstrap.sigunguBoundaries) {
    const cityId = resolveSgisCityId(feat.sidoCd, feat.admNm, cityByProvName);
    if (!cityId) continue;
    const province = provByCityId.get(cityId);
    if (!province) continue;

    const existingRings = cityBoundariesByCityId.get(cityId) ?? [];
    for (const ring of feat.rings) {
      if (ring.length < 3) continue;
      existingRings.push(ring);
      let rMinX = Infinity;
      let rMaxX = -Infinity;
      let rMinY = Infinity;
      let rMaxY = -Infinity;
      for (let i = 0; i < ring.length; i++) {
        const [rx, ry] = ring[i];
        if (rx < rMinX) rMinX = rx;
        if (rx > rMaxX) rMaxX = rx;
        if (ry < rMinY) rMinY = ry;
        if (ry > rMaxY) rMaxY = ry;
      }
      indexedRings.push({
        cityId,
        province,
        minX: rMinX,
        maxX: rMaxX,
        minY: rMinY,
        maxY: rMaxY,
        ring,
      });
    }
    cityBoundariesByCityId.set(cityId, existingRings);
  }

  // SGIS 공식 경계가 충분히 로드되지 않은 경우 기존 폴리곤 지오메트리 유지하되 통계만 갱신
  const hasOfficialBoundaries = indexedRings.length >= 120;

  if (!hasOfficialBoundaries) {
    const base = getKoreaCivWorld();
    const rawHexes: RawHexSeed[] = base.hexes.map((h) => ({
      id: h.id,
      q: h.q,
      r: h.r,
      x: h.x,
      y: h.y,
      lat: h.lat,
      lon: h.lon,
      landFraction: h.landFraction,
      islandGroup: h.islandGroup,
      elevationM: h.elevationM,
      reliefM: h.reliefM,
      relief: h.relief,
      cityId: h.cityId,
      province: h.province,
    }));
    const landSet = new Set(rawHexes.map((h) => h.id));
    return assembleWorldFromCitiesAndHexes(cities, rawHexes, landSet, base.bounds, {
      isLive: true,
      fetchedAt: bootstrap.fetchedAt,
      sgisYear: bootstrap.sgisYear,
      kosisPopYear: bootstrap.kosisPopYear,
      kosisAgingYear: bootstrap.kosisAgingYear,
      kosisGrdpYear: bootstrap.kosisGrdpYear,
      provinceBoundaries: bootstrap.provinceBoundaries,
      sigunguBoundaries: bootstrap.sigunguBoundaries,
      cityBoundariesByCityId,
      sgisSubdistrictsByCityId,
      updatedCityCount,
      boundaryHexCount: rawHexes.length,
    });
  }

  // 7. SGIS 2024 공식 행정경계 폴리곤으로 남한 5km 육각 격자 전체 재구축
  const minR = -72;
  const maxR = 78;
  const minQ = -68;
  const maxQ = 82;

  const rawHexes: RawHexSeed[] = [];
  const landCoordsSet = new Set<string>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const findSgisCityAtPoint = (px: number, py: number): { cityId: string; province: ProvinceCode } | null => {
    for (let i = 0; i < indexedRings.length; i++) {
      const r = indexedRings[i];
      if (px < r.minX || px > r.maxX || py < r.minY || py > r.maxY) continue;
      if (pointInTupleRing(px, py, r.ring)) {
        return { cityId: r.cityId, province: r.province };
      }
    }
    return null;
  };

  for (let r = minR; r <= maxR; r++) {
    for (let q = minQ; q <= maxQ; q++) {
      const { x, y } = axialToKm(q, r);
      if (x < -165 || x > 335 || y < -310 || y > 340) continue;

      let landHits = 0;
      const cityVotes = new Map<string, { count: number; province: ProvinceCode }>();
      let minElev = Infinity;
      let maxElev = -Infinity;
      let sumElev = 0;

      for (let s = 0; s < SAMPLE_OFFSETS.length; s++) {
        const sx = x + SAMPLE_OFFSETS[s][0];
        const sy = y + SAMPLE_OFFSETS[s][1];
        const hit = findSgisCityAtPoint(sx, sy);
        if (hit) {
          landHits++;
          const prev = cityVotes.get(hit.cityId);
          if (prev) prev.count++;
          else cityVotes.set(hit.cityId, { count: 1, province: hit.province });
        }
        const e = sampleElevationM(sx, sy);
        if (e < minElev) minElev = e;
        if (e > maxElev) maxElev = e;
        sumElev += e;
      }

      const landFraction = landHits / SAMPLE_OFFSETS.length;
      if (landFraction < CIV_RULES.grid.minLandFraction || cityVotes.size === 0) continue;

      // 최다 득표 공식 시군구 채택
      let bestCityId = '';
      let bestProv: ProvinceCode = 'seoul';
      let bestCount = -1;
      cityVotes.forEach((v, cid) => {
        if (v.count > bestCount) {
          bestCount = v.count;
          bestCityId = cid;
          bestProv = v.province;
        }
      });

      const id = `${q},${r}`;
      const { elevationM, reliefM, relief, landCoverTerrain } = resolveHexTerrain(
        id,
        sumElev,
        minElev,
        maxElev
      );
      const { lat, lon } = kmToLatLon(x, y);
      const islandGroup = getCityIslandGroup(bestCityId);
      landCoordsSet.add(id);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      rawHexes.push({
        id,
        q,
        r,
        x,
        y,
        lat,
        lon,
        landFraction,
        islandGroup,
        elevationM,
        reliefM,
        relief,
        landCoverTerrain,
        cityId: bestCityId,
        province: bestProv,
      });
    }
  }

  return assembleWorldFromCitiesAndHexes(
    cities,
    rawHexes,
    landCoordsSet,
    { minX, maxX, minY, maxY },
    {
      isLive: true,
      fetchedAt: bootstrap.fetchedAt,
      sgisYear: bootstrap.sgisYear,
      kosisPopYear: bootstrap.kosisPopYear,
      kosisAgingYear: bootstrap.kosisAgingYear,
      kosisGrdpYear: bootstrap.kosisGrdpYear,
      provinceBoundaries: bootstrap.provinceBoundaries,
      sigunguBoundaries: bootstrap.sigunguBoundaries,
      cityBoundariesByCityId,
      sgisSubdistrictsByCityId,
      updatedCityCount,
      boundaryHexCount: rawHexes.length,
    }
  );
}
