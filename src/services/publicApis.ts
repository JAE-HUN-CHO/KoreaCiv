import { KOSIS_SNAPSHOT_END_YEAR, KOSIS_SNAPSHOT_START_YEAR } from './snapshotConfig';

import type { ProvinceCode } from '../types/civ';
import { latLonToKm, type Point2D } from '../data/koreaGeography';

export interface ApiStatusResponse {
  sgis: boolean;
  kosis: boolean;
  vworld: boolean;
  /** 정적 배포(GitHub Pages) 빌드 여부. true면 /api 대신 빌드 시점 스냅샷 JSON을 읽음 */
  staticMode?: boolean;
  /** 스냅샷 생성 시각 (ISO 8601). 스냅샷이 없으면 null */
  snapshotGeneratedAt?: string | null;
  expectedEnvVars: {
    sgis: string[];
    kosis: string[];
    vworld: string[];
  };
}

export interface SgisSubdistrictItem {
  admCd: string;
  admNm: string;
  totPpltn: number;
  avgAge: number;
  ppltnDnsty: number;
  agedChildIdx: number;
  totFamily: number;
  corpCnt: number;
  employeeCnt: number;
}

export interface SgisSubdistrictsResponse {
  source: string;
  year: string;
  admCd: string;
  count: number;
  items: SgisSubdistrictItem[];
}

export interface SgisBoundaryOverlay {
  label: string;
  year: string;
  admCd: string;
  rings: { name: string; admCd: string; points: Point2D[] }[];
}

export interface KosisTimeseriesRow {
  region: string;
  regionCode: string;
  year: string;
  value: number;
  unit: string;
  itemName: string;
}

export interface KosisTimeseriesResponse {
  source: string;
  indicator: string;
  label: string;
  tblId: string;
  unit: string;
  rowCount: number;
  rows: KosisTimeseriesRow[];
}

export interface KosisSearchItem {
  orgId: string;
  orgNm: string;
  tblId: string;
  tblNm: string;
  statNm: string;
  startDe: string;
  endDe: string;
}

export interface GeocodedPlaceResult {
  id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lon: number;
}

export interface VWorldReverseResult {
  source: string;
  fallbackNotice?: string;
  lat: number;
  lon: number;
  parcelAddress: string | null;
  roadAddress: string | null;
  adminPath: string | null;
}

export interface CustomMapPin {
  id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  hexId?: string;
  cityId?: string;
}

export interface LiveBoundaryFeature {
  admCd: string;
  admNm: string;
  sidoCd: string;
  rings: [number, number][][];
}

export interface LiveSgisStatItem extends SgisSubdistrictItem {
  sidoCd: string;
}

export interface LiveNationalIndustryShare {
  corpCnt: number;
  totWorker: number;
  sharePct: number;
}

export interface LiveBootstrapResponse {
  fetchedAt: string;
  sgisYear: string | null;
  kosisPopYear: string | null;
  kosisAgingYear: string | null;
  kosisGrdpYear: string | null;
  provinceBoundaries: LiveBoundaryFeature[];
  sigunguBoundaries: LiveBoundaryFeature[];
  sgisStats: LiveSgisStatItem[];
  /** 7대 산업(IndustryKey)의 전국 종사자 비중 — SGIS 사업체통계(stats/company.json) 실시간 집계 */
  nationalIndustryShares?: Partial<Record<string, LiveNationalIndustryShare>>;
  kosisLatest: {
    grdpBySido: Array<{ region: string; regionCode: string; valueMillionKrw: number }>;
    grdpPcBySido: Array<{ region: string; regionCode: string; valueThousandKrw: number }>;
    popRows: Array<{ region: string; regionCode: string; value: number }>;
    agingRows: Array<{ region: string; regionCode: string; value: number }>;
  };
}

export interface SgisHistoryResponse {
  source: string;
  year: string;
  fetchedAt: string;
  provinceBoundaries: LiveBoundaryFeature[];
  sigunguBoundaries: LiveBoundaryFeature[];
  sgisStats: LiveSgisStatItem[];
  kosisPopRows?: Array<{ region: string; regionCode: string; value: number }>;
}

/**
 * 국가데이터처 SGIS 공식 통계구역 시도 코드 (2자리)
 * (행정표준코드와 다름 — 기획서 제2절 코드 매핑 규칙 반영)
 */
export const SGIS_PROVINCE_CODES: Record<ProvinceCode, { code: string; name: string }> = {
  seoul: { code: '11', name: '서울특별시' },
  busan: { code: '21', name: '부산광역시' },
  daegu: { code: '22', name: '대구광역시' },
  incheon: { code: '23', name: '인천광역시' },
  gwangju: { code: '24', name: '광주광역시' },
  daejeon: { code: '25', name: '대전광역시' },
  ulsan: { code: '26', name: '울산광역시' },
  sejong: { code: '29', name: '세종특별자치시' },
  gyeonggi: { code: '31', name: '경기도' },
  gangwon: { code: '32', name: '강원특별자치도' },
  chungbuk: { code: '33', name: '충청북도' },
  chungnam: { code: '34', name: '충청남도' },
  jeonbuk: { code: '35', name: '전북특별자치도' },
  jeonnam: { code: '36', name: '전라남도' },
  gyeongbuk: { code: '37', name: '경상북도' },
  gyeongnam: { code: '38', name: '경상남도' },
  jeju: { code: '39', name: '제주특별자치도' },
};

/**
 * 자치구 또는 일반구가 존재하는 특별·광역시 및 대도시의 SGIS 코드
 */
export const CITY_TO_SGIS_ADM_CD: Record<string, { code: string; label: string }> = {
  seoul: { code: '11', label: '서울 25개 자치구' },
  busan: { code: '21', label: '부산 16개 구·군' },
  daegu: { code: '22', label: '대구 9개 구·군' },
  incheon: { code: '23', label: '인천 10개 구·군' },
  gwangju: { code: '24', label: '광주 5개 자치구' },
  daejeon: { code: '25', label: '대전 5개 자치구' },
  ulsan: { code: '26', label: '울산 5개 구·군' },
  sejong: { code: '29010', label: '세종 읍·면·동' },
  suwon: { code: '3101', label: '수원시 4개 구' },
  seongnam: { code: '3102', label: '성남시 3개 구' },
  anyang: { code: '3104', label: '안양시 2개 구' },
  ansan: { code: '3109', label: '안산시 2개 구' },
  goyang: { code: '3110', label: '고양시 3개 구' },
  yongin: { code: '3119', label: '용인시 3개 구' },
  cheongju: { code: '3304', label: '청주시 4개 구' },
  cheonan: { code: '3401', label: '천안시 2개 구' },
  jeonju: { code: '3501', label: '전주시 2개 구' },
  pohang: { code: '3701', label: '포항시 2개 구' },
  changwon: { code: '3811', label: '창원시 5개 구' },
};

/**
 * SGIS 좌표(UTM-K / EPSG:5179 미터 또는 WGS84 경위도)를 KoreaCiv 평면 km 좌표로 정밀 변환
 */
const GRS80_A = 6378137.0;
const GRS80_F = 1 / 298.257222101;
const GRS80_E2 = 2 * GRS80_F - GRS80_F * GRS80_F;
const GRS80_EP2 = GRS80_E2 / (1 - GRS80_E2);
const GRS80_E1 = (1 - Math.sqrt(1 - GRS80_E2)) / (1 + Math.sqrt(1 - GRS80_E2));
const UTMK_K0 = 0.9996;
const UTMK_FE = 1_000_000.0;
const UTMK_FN = 2_000_000.0;
const UTMK_LON0_RAD = (127.5 * Math.PI) / 180;
const UTMK_LAT0_RAD = (38.0 * Math.PI) / 180;
const UTMK_M0 =
  GRS80_A *
  ((1 - GRS80_E2 / 4 - (3 * GRS80_E2 ** 2) / 64 - (5 * GRS80_E2 ** 3) / 256) * UTMK_LAT0_RAD -
    ((3 * GRS80_E2) / 8 + (3 * GRS80_E2 ** 2) / 32 + (45 * GRS80_E2 ** 3) / 1024) *
      Math.sin(2 * UTMK_LAT0_RAD) +
    ((15 * GRS80_E2 ** 2) / 256 + (45 * GRS80_E2 ** 3) / 1024) * Math.sin(4 * UTMK_LAT0_RAD) -
    ((35 * GRS80_E2 ** 3) / 3072) * Math.sin(6 * UTMK_LAT0_RAD));

function sgisCoordToKm(coord: number[]): Point2D {
  const [c0, c1] = coord;
  if (Math.abs(c0) > 1000) {
    const xUtm = c0 - UTMK_FE;
    const yUtm = c1 - UTMK_FN;
    const M = UTMK_M0 + yUtm / UTMK_K0;
    const mu = M / (GRS80_A * (1 - GRS80_E2 / 4 - (3 * GRS80_E2 ** 2) / 64 - (5 * GRS80_E2 ** 3) / 256));
    const phi1 =
      mu +
      ((3 * GRS80_E1) / 2 - (27 * GRS80_E1 ** 3) / 32) * Math.sin(2 * mu) +
      ((21 * GRS80_E1 ** 2) / 16 - (55 * GRS80_E1 ** 4) / 32) * Math.sin(4 * mu) +
      ((151 * GRS80_E1 ** 3) / 96) * Math.sin(6 * mu) +
      ((1097 * GRS80_E1 ** 4) / 512) * Math.sin(8 * mu);

    const sinP = Math.sin(phi1);
    const cosP = Math.cos(phi1);
    const tanP = Math.tan(phi1);
    const N1 = GRS80_A / Math.sqrt(1 - GRS80_E2 * sinP * sinP);
    const T1 = tanP * tanP;
    const C1 = GRS80_EP2 * cosP * cosP;
    const R1 = (GRS80_A * (1 - GRS80_E2)) / Math.pow(1 - GRS80_E2 * sinP * sinP, 1.5);
    const D = xUtm / (N1 * UTMK_K0);

    const latRad =
      phi1 -
      ((N1 * tanP) / R1) *
        ((D * D) / 2 -
          ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * GRS80_EP2) * D ** 4) / 24 +
          ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * GRS80_EP2 - 3 * C1 * C1) * D ** 6) / 720);

    const lonRad =
      UTMK_LON0_RAD +
      (D -
        ((1 + 2 * T1 + C1) * D ** 3) / 6 +
        ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * GRS80_EP2 + 24 * T1 * T1) * D ** 5) / 120) /
        cosP;

    return latLonToKm((latRad * 180) / Math.PI, (lonRad * 180) / Math.PI);
  }
  return latLonToKm(c1, c0);
}

interface RawGeoJson {
  features?: Array<{
    properties?: { adm_nm?: string; adm_cd?: string };
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
}

export function parseSgisGeoJsonToOverlay(
  geojson: unknown,
  meta: { label: string; year: string; admCd: string }
): SgisBoundaryOverlay {
  const g = geojson as RawGeoJson;
  const rings: SgisBoundaryOverlay['rings'] = [];

  for (const feat of g?.features ?? []) {
    const name = String(feat.properties?.adm_nm ?? '');
    const admCd = String(feat.properties?.adm_cd ?? '');
    const geom = feat.geometry;
    if (!geom || !geom.coordinates) continue;

    if (geom.type === 'Polygon') {
      const poly = geom.coordinates as number[][][];
      if (poly[0] && poly[0].length >= 3) {
        rings.push({
          name,
          admCd,
          points: poly[0].map(sgisCoordToKm),
        });
      }
    } else if (geom.type === 'MultiPolygon') {
      const mpoly = geom.coordinates as number[][][][];
      for (const poly of mpoly) {
        if (poly[0] && poly[0].length >= 3) {
          rings.push({
            name,
            admCd,
            points: poly[0].map(sgisCoordToKm),
          });
        }
      }
    }
  }

  return {
    ...meta,
    rings,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
  if (!resp.ok) {
    throw new Error(data.error || `요청 실패 (HTTP ${resp.status})`);
  }
  return data;
}

// ==================== 정적 배포(GitHub Pages) 모드 ====================
// Pages에는 server.ts가 없으므로, GitHub Actions가 빌드 직전에 /api 응답을 받아
// data/*.json으로 저장해 둔다(scripts/snapshot-api.ts). 정적 빌드는 그 파일만 읽는다.

export const IS_STATIC_DEPLOY = import.meta.env.VITE_STATIC_DEPLOY === 'true';

const STATIC_UNSUPPORTED_MESSAGE =
  '정적 배포(GitHub Pages)에서는 이 실시간 조회를 지원하지 않습니다. 로컬에서 npm run dev로 실행하면 사용할 수 있습니다.';

interface SnapshotManifest {
  generatedAt: string;
  files: string[];
}

let manifestPromise: Promise<SnapshotManifest | null> | null = null;

function snapshotUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/${file}`;
}

function loadSnapshotManifest(): Promise<SnapshotManifest | null> {
  manifestPromise ??= fetch(snapshotUrl('manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<SnapshotManifest>) : null))
    .catch(() => null)
    .then((manifest) => {
      // 실패 결과는 캐시하지 않음 → 네트워크가 돌아오면 다음 호출에서 다시 요청
      if (!manifest) manifestPromise = null;
      return manifest;
    });
  return manifestPromise;
}

async function fetchSnapshot<T>(file: string): Promise<T> {
  const manifest = await loadSnapshotManifest();
  if (!manifest?.files.includes(file)) {
    throw new Error('이 데이터의 스냅샷이 아직 없습니다 (GitHub Actions 정기 수집 대기 중).');
  }
  return fetchJson<T>(snapshotUrl(file));
}

function staticUnsupported(): Promise<never> {
  return Promise.reject(new Error(STATIC_UNSUPPORTED_MESSAGE));
}

const EXPECTED_ENV_VARS: ApiStatusResponse['expectedEnvVars'] = {
  sgis: ['SGIS_CONSUMER_KEY', 'SGIS_CONSUMER_SECRET'],
  kosis: ['KOSIS_API_KEY'],
  vworld: ['VWORLD_API_KEY'],
};

export async function fetchApiStatus(): Promise<ApiStatusResponse> {
  if (!IS_STATIC_DEPLOY) {
    return fetchJson<ApiStatusResponse>('/api/status');
  }
  const manifest = await loadSnapshotManifest();
  const files = manifest?.files ?? [];
  return {
    // live-bootstrap.json은 KOSIS 키만 있어도 만들어지므로 SGIS 여부는 sgis-* 파일로 판단
    sgis: files.some((f) => f.startsWith('sgis-')),
    kosis: files.some((f) => f.startsWith('kosis-')),
    vworld: false,
    staticMode: true,
    snapshotGeneratedAt: manifest?.generatedAt ?? null,
    expectedEnvVars: EXPECTED_ENV_VARS,
  };
}

export function fetchLiveBootstrap(forceRefresh = false): Promise<LiveBootstrapResponse> {
  if (IS_STATIC_DEPLOY) {
    return fetchSnapshot<LiveBootstrapResponse>('live-bootstrap.json');
  }
  return fetchJson<LiveBootstrapResponse>(
    forceRefresh ? '/api/live/bootstrap?refresh=1' : '/api/live/bootstrap'
  );
}

export function fetchSgisHistorySnapshot(
  year: '2010' | '2015' | '2020' | '2024'
): Promise<SgisHistoryResponse> {
  if (IS_STATIC_DEPLOY) {
    return fetchSnapshot<SgisHistoryResponse>(`sgis-history-${year}.json`);
  }
  const params = new URLSearchParams({ year });
  return fetchJson<SgisHistoryResponse>(`/api/sgis/history?${params.toString()}`);
}

export function fetchSgisSubdistricts(
  admCd: string,
  year = '2024'
): Promise<SgisSubdistrictsResponse> {
  if (IS_STATIC_DEPLOY) return staticUnsupported();
  const params = new URLSearchParams({ admCd, year });
  return fetchJson<SgisSubdistrictsResponse>(`/api/sgis/subdistricts?${params.toString()}`);
}

export async function fetchSgisBoundaryOverlay(
  admCd: string,
  label: string,
  year = '2024'
): Promise<SgisBoundaryOverlay> {
  if (IS_STATIC_DEPLOY) return staticUnsupported();
  const params = new URLSearchParams({ admCd, year });
  const data = await fetchJson<{ geojson: unknown; year: string; admCd: string }>(
    `/api/sgis/boundary?${params.toString()}`
  );
  return parseSgisGeoJsonToOverlay(data.geojson, { label, year: data.year, admCd: data.admCd });
}

export function fetchKosisTimeseries(
  indicator: 'grdp_sido' | 'grdp_pc_sido' | 'pop_sido' | 'aging_sido',
  startYear = KOSIS_SNAPSHOT_START_YEAR,
  endYear = KOSIS_SNAPSHOT_END_YEAR
): Promise<KosisTimeseriesResponse> {
  if (IS_STATIC_DEPLOY) {
    // 스냅샷은 고정 범위로만 수집하므로 다른 범위 요청은 조용히 다른 데이터를 주지 않고 실패시킴
    if (startYear !== KOSIS_SNAPSHOT_START_YEAR || endYear !== KOSIS_SNAPSHOT_END_YEAR) {
      return Promise.reject(
        new Error(
          `정적 배포의 KOSIS 시계열은 ${KOSIS_SNAPSHOT_START_YEAR}–${KOSIS_SNAPSHOT_END_YEAR}년 범위만 제공합니다.`
        )
      );
    }
    return fetchSnapshot<KosisTimeseriesResponse>(`kosis-${indicator}.json`);
  }
  const params = new URLSearchParams({ indicator, startYear, endYear });
  return fetchJson<KosisTimeseriesResponse>(`/api/kosis/timeseries?${params.toString()}`);
}

export function searchKosisTables(q: string): Promise<{
  source: string;
  query: string;
  items: KosisSearchItem[];
}> {
  if (IS_STATIC_DEPLOY) return staticUnsupported();
  const params = new URLSearchParams({ q });
  return fetchJson(`/api/kosis/search?${params.toString()}`);
}

export function searchVWorldPlaces(
  q: string,
  mode: 'place' | 'address' = 'place'
): Promise<{
  source: string;
  fallbackNotice?: string;
  query: string;
  mode: string;
  results: GeocodedPlaceResult[];
}> {
  if (IS_STATIC_DEPLOY) return staticUnsupported();
  const params = new URLSearchParams({ q, mode });
  return fetchJson(`/api/vworld/search?${params.toString()}`);
}

export function batchGeocodeVWorld(queries: string[]): Promise<{
  source: string;
  fallbackNotice?: string;
  total: number;
  matchedCount: number;
  failedCount: number;
  successRatePct: number;
  matched: Array<{
    query: string;
    name: string;
    address: string;
    category: string;
    lat: number;
    lon: number;
  }>;
  failed: string[];
}> {
  if (IS_STATIC_DEPLOY) return staticUnsupported();
  return fetchJson('/api/vworld/batch-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  });
}

export function reverseGeocodeVWorld(lat: number, lon: number): Promise<VWorldReverseResult> {
  if (IS_STATIC_DEPLOY) return staticUnsupported();
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
  });
  return fetchJson<VWorldReverseResult>(`/api/vworld/reverse?${params.toString()}`);
}
