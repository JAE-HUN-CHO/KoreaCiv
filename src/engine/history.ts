import type {
  CityComputed,
  HistoryCensusYear,
  HistoryViewMode,
  ProvinceCode,
} from '../types/civ';
import type { KoreaCivWorld } from './hexGrid';
import type {
  LiveBoundaryFeature,
  SgisHistoryResponse,
} from '../services/publicApis';

export interface HistoricalCityStat {
  population: number;
  density: number;
  avgAge: number;
}

export interface HistoricalSnapshot {
  year: HistoryCensusYear;
  isLive: boolean;
  source: string;
  sidoCount: number;
  sigunguCount: number;
  totalPopulation: number;
  provinceBoundaries: LiveBoundaryFeature[];
  sigunguBoundaries: LiveBoundaryFeature[];
  cityStats: Map<string, HistoricalCityStat>;
}

export interface HistoryRenderContext {
  mode: HistoryViewMode;
  activeYear: HistoryCensusYear;
  baseYear: HistoryCensusYear;
  targetYear: HistoryCensusYear;
  compareCurrentBoundaries: boolean;
  activeSnapshot: HistoricalSnapshot;
  baseSnapshot: HistoricalSnapshot;
  targetSnapshot: HistoricalSnapshot;
}

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

const MOIS_CODE_PREFIX_TO_PROVINCE: Record<string, ProvinceCode> = {
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

const KOSIS_METRO_NAME_TO_CITY_ID: Record<string, string> = {
  서울특별시: 'seoul',
  부산광역시: 'busan',
  대구광역시: 'daegu',
  인천광역시: 'incheon',
  광주광역시: 'gwangju',
  대전광역시: 'daejeon',
  울산광역시: 'ulsan',
  세종특별자치시: 'sejong',
};

/**
 * 2010~2024년 행정구역 개편·통합 이전의 구(舊) 시군구 명칭을 현재 161개 시·군 ID로 통합 매핑
 * (예: 2010년 연기군 → 세종시, 청원군 → 청주시, 여주군 → 여주시, 당진군 → 당진시, 군위군 → 대구광역시 등)
 */
const HISTORIC_NAME_TO_CITY_ID: Record<string, string> = {
  'chungnam:연기군': 'sejong',
  'chungbuk:청원군': 'cheongju',
  'gyeonggi:여주군': 'yeoju',
  'chungnam:당진군': 'dangjin',
  'gyeongbuk:군위군': 'daegu',
  'gyeongnam:마산시': 'changwon',
  'gyeongnam:진해시': 'changwon',
};

function normalizeBaseName(raw: string): string {
  const cleaned = raw.replace(/\(.*\)$/, '').trim();
  const tokens = cleaned.split(/\s+/);
  return tokens[0] ?? cleaned;
}

function resolveHistoricCityId(
  sidoCd: string,
  admNm: string,
  cityByProvName: Map<string, string>
): string | null {
  if (METRO_SIDO_TO_CITY_ID[sidoCd]) {
    return METRO_SIDO_TO_CITY_ID[sidoCd];
  }
  const prov = SGIS_CODE_TO_PROVINCE[sidoCd];
  if (!prov) return null;

  const base = normalizeBaseName(admNm);
  const historicOverride = HISTORIC_NAME_TO_CITY_ID[`${prov}:${base}`];
  if (historicOverride) return historicOverride;

  const direct = cityByProvName.get(`${prov}:${base}`);
  if (direct) return direct;

  // 예: '수원시 장안구' 또는 붙여쓴 '수원시장안구' 대응
  const siMatch = admNm.trim().match(/^([가-힣]+시)/);
  if (siMatch) {
    const bySi = cityByProvName.get(`${prov}:${siMatch[1]}`);
    if (bySi) return bySi;
  }

  return null;
}

/**
 * SGIS 역사 센서스 API 응답(2010/2015/2020/2024)을 161개 도시 기준 HistoricalSnapshot으로 변환
 */
export function buildHistoricalSnapshotFromApi(
  res: SgisHistoryResponse,
  cities: CityComputed[]
): HistoricalSnapshot {
  const cityByProvName = new Map<string, string>();
  const cityAreaById = new Map<string, number>();
  for (const c of cities) {
    cityByProvName.set(`${c.province}:${normalizeBaseName(c.name)}`, c.id);
    cityByProvName.set(`${c.province}:${c.name}`, c.id);
    cityAreaById.set(c.id, Math.max(1, c.areaKm2));
  }

  const aggByCity = new Map<string, { pop: number; weightedAge: number }>();
  let totalPopulation = 0;

  for (const item of res.sgisStats) {
    if (item.totPpltn <= 0) continue;
    totalPopulation += item.totPpltn;
    const cid = resolveHistoricCityId(item.sidoCd, item.admNm, cityByProvName);
    if (!cid) continue;
    const prev = aggByCity.get(cid) ?? { pop: 0, weightedAge: 0 };
    prev.pop += item.totPpltn;
    prev.weightedAge += item.avgAge * item.totPpltn;
    aggByCity.set(cid, prev);
  }

  // 2010년 등 SGIS population.json이 인구 'N/A'(0)를 반환하는 연도는 KOSIS 주민등록인구(DT_1B040A3) 실측치로 보강
  if (aggByCity.size < 100 && Array.isArray(res.kosisPopRows) && res.kosisPopRows.length > 0) {
    const kosisDirectPop = new Map<string, number>();
    const kosisMergerAdd = new Map<string, number>();

    for (const row of res.kosisPopRows) {
      if (row.value <= 0) continue;
      const trimmed = row.region.trim();
      const metroId = KOSIS_METRO_NAME_TO_CITY_ID[trimmed];
      if (metroId) {
        kosisDirectPop.set(metroId, row.value);
        continue;
      }
      const prov = MOIS_CODE_PREFIX_TO_PROVINCE[row.regionCode.slice(0, 2)];
      if (!prov) continue;
      const base = normalizeBaseName(trimmed);

      const historicTarget = HISTORIC_NAME_TO_CITY_ID[`${prov}:${base}`];
      if (historicTarget) {
        // 청원군(→청주시), 군위군(→대구), 연기군(→세종) 등 과거 통합 전 지자체 인구 합산
        if (historicTarget === 'cheongju' || historicTarget === 'daegu') {
          kosisMergerAdd.set(
            historicTarget,
            (kosisMergerAdd.get(historicTarget) ?? 0) + row.value
          );
        } else {
          kosisDirectPop.set(historicTarget, row.value);
        }
        continue;
      }

      const cid = cityByProvName.get(`${prov}:${base}`);
      if (cid) {
        const prev = kosisDirectPop.get(cid) ?? 0;
        if (row.value > prev) kosisDirectPop.set(cid, row.value);
      }
    }

    totalPopulation = 0;
    for (const c of cities) {
      const basePop = (kosisDirectPop.get(c.id) ?? 0) + (kosisMergerAdd.get(c.id) ?? 0);
      if (basePop > 0) {
        totalPopulation += basePop;
        aggByCity.set(c.id, { pop: basePop, weightedAge: 0 });
      }
    }
  }

  const cityStats = new Map<string, HistoricalCityStat>();
  for (const c of cities) {
    const agg = aggByCity.get(c.id);
    if (agg && agg.pop > 0) {
      const area = cityAreaById.get(c.id) ?? Math.max(1, c.areaKm2);
      cityStats.set(c.id, {
        population: Math.round(agg.pop),
        density: Math.round(agg.pop / area),
        avgAge: agg.weightedAge > 0 ? Number((agg.weightedAge / agg.pop).toFixed(1)) : 0,
      });
    }
  }

  return {
    year: res.year as HistoryCensusYear,
    isLive: true,
    source: res.source,
    sidoCount: res.provinceBoundaries.length,
    sigunguCount: res.sigunguBoundaries.length,
    totalPopulation,
    provinceBoundaries: res.provinceBoundaries,
    sigunguBoundaries: res.sigunguBoundaries,
    cityStats,
  };
}

/**
 * 이미 로드된 최신 2024 world.liveMeta로부터 즉시 2024 스냅샷 생성 (추가 네트워크 요청 불필요)
 */
export function buildCurrentYearSnapshotFromWorld(world: KoreaCivWorld): HistoricalSnapshot {
  const cityStats = new Map<string, HistoricalCityStat>();
  let totalPopulation = 0;

  for (const c of world.cities) {
    const subs = world.liveMeta?.sgisSubdistrictsByCityId.get(c.id);
    const pop =
      subs && subs.length > 0
        ? subs.reduce((acc, s) => acc + s.totPpltn, 0)
        : c.population;
    totalPopulation += pop;
    cityStats.set(c.id, {
      population: Math.round(pop),
      density: Math.round(pop / Math.max(1, c.areaKm2)),
      avgAge: c.liveAvgAge ?? Math.max(35, Math.min(56, 33 + c.agingRate * 0.52)),
    });
  }

  return {
    year: '2024',
    isLive: Boolean(world.liveMeta?.isLive),
    source: world.liveMeta?.isLive
      ? `국가데이터처 SGIS ${world.liveMeta.sgisYear ?? '2024'} 공식 통계·경계`
      : '내장 2024 기준 통계',
    sidoCount: world.liveMeta?.provinceBoundaries.length ?? 17,
    sigunguCount: world.liveMeta?.sigunguBoundaries.length ?? 252,
    totalPopulation,
    provinceBoundaries: world.liveMeta?.provinceBoundaries ?? [],
    sigunguBoundaries: world.liveMeta?.sigunguBoundaries ?? [],
    cityStats,
  };
}

/**
 * SGIS 과거 연도 스냅샷 로딩 중 또는 API 미연결 시 즉시 렌더링할 수 있는 인구구조 기반 추정 스냅샷
 * (고령화율·도시 등급별 2010→2024 한국 인구 이동 추세를 반영한 임시 폴백)
 */
export function buildFallbackHistoricalSnapshot(
  year: HistoryCensusYear,
  world: KoreaCivWorld
): HistoricalSnapshot {
  if (year === '2024') {
    return buildCurrentYearSnapshotFromWorld(world);
  }

  const yearsBack = 2024 - Number(year);
  const cityStats = new Map<string, HistoricalCityStat>();
  let totalPopulation = 0;

  for (const c of world.cities) {
    // 신도시·수도권 외곽 성장 vs 초고령 농어촌 감소·대도시 구도심 완만 감소
    let annualGrowthPct = 0;
    if (c.id === 'sejong') {
      annualGrowthPct = 10.5;
    } else if (c.id === 'hwaseong' || c.id === 'hanam' || c.id === 'gimpo' || c.id === 'pyeongtaek') {
      annualGrowthPct = 4.2;
    } else if (c.agingRate < 15) {
      annualGrowthPct = 1.6;
    } else if (c.agingRate < 22) {
      annualGrowthPct = c.province === 'seoul' || c.province === 'busan' ? -0.65 : 0.25;
    } else if (c.agingRate < 32) {
      annualGrowthPct = -0.85;
    } else {
      annualGrowthPct = -1.65;
    }

    const factor = Math.pow(1 + annualGrowthPct / 100, yearsBack);
    const estPop = Math.max(4000, Math.round(c.population / factor));
    totalPopulation += estPop;
    cityStats.set(c.id, {
      population: estPop,
      density: Math.round(estPop / Math.max(1, c.areaKm2)),
      avgAge: Number(Math.max(30, (c.liveAvgAge ?? 44) - yearsBack * 0.42).toFixed(1)),
    });
  }

  return {
    year,
    isLive: false,
    source: `${year}년 인구 추정치 (SGIS 실측 로딩 중)`,
    sidoCount: year === '2010' ? 16 : 17,
    sigunguCount: year === '2010' ? 251 : 252,
    totalPopulation,
    provinceBoundaries: [],
    sigunguBoundaries: [],
    cityStats,
  };
}

/**
 * 기준연도 → 비교연도 인구 증감률 (%) 계산
 */
export function computeCityPopChangePct(
  cityId: string,
  baseSnap: HistoricalSnapshot,
  targetSnap: HistoricalSnapshot
): { pct: number; basePop: number; targetPop: number } | null {
  const b = baseSnap.cityStats.get(cityId);
  const t = targetSnap.cityStats.get(cityId);
  if (!b || !t || b.population <= 0) return null;
  const pct = ((t.population - b.population) / b.population) * 100;
  return { pct, basePop: b.population, targetPop: t.population };
}
