import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

// ==================== Server-side Secret Resolution ====================
function firstNonEmptyEnv(names: string[]): string {
  for (const name of names) {
    const val = process.env[name]?.trim();
    if (val && !val.startsWith('MY_')) return val;
  }
  return '';
}

function getApiConfig() {
  const sgisKey = firstNonEmptyEnv([
    'SGIS_CONSUMER_KEY',
    'SGIS_SERVICE_ID',
    'SGIS_API_KEY',
    'SGIS_KEY',
  ]);
  const sgisSecret = firstNonEmptyEnv([
    'SGIS_CONSUMER_SECRET',
    'SGIS_SECURITY_KEY',
    'SGIS_SECRET_KEY',
    'SGIS_SECRET',
  ]);
  const kosisKey = firstNonEmptyEnv([
    'KOSIS_API_KEY',
    'KOSIS_OPENAPI_KEY',
    'KOSIS_KEY',
  ]);
  const vworldKey = firstNonEmptyEnv([
    'VWORLD_API_KEY',
    'VWORLD_KEY',
    'VWORLD_AUTH_KEY',
    'VWORLD_OPENAPI_KEY',
    'VWORLD_REST_API_KEY',
    'VWORLD_SECRET_KEY',
    'V_WORLD_API_KEY',
    'V_WORLD_KEY',
  ]);
  const vworldDomain = firstNonEmptyEnv(['VWORLD_DOMAIN', 'APP_URL']);

  return {
    sgisKey,
    sgisSecret,
    kosisKey,
    vworldKey,
    vworldDomain,
    hasSgis: Boolean(sgisKey && sgisSecret),
    hasKosis: Boolean(kosisKey),
    hasVworld: Boolean(vworldKey),
  };
}

// ==================== Simple In-Memory TTL Cache ====================
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_ENTRIES = 250;

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ==================== SGIS Access Token Manager ====================
let sgisTokenCache: { token: string; expiresAt: number } | null = null;
let sgisTokenInFlight: Promise<string> | null = null;

async function getSgisAccessToken(forceRefresh = false): Promise<string> {
  const { sgisKey, sgisSecret } = getApiConfig();
  if (!sgisKey || !sgisSecret) {
    throw new Error('SGIS_NOT_CONFIGURED');
  }

  if (!forceRefresh && sgisTokenCache && Date.now() < sgisTokenCache.expiresAt - 120_000) {
    return sgisTokenCache.token;
  }

  if (sgisTokenInFlight) {
    return sgisTokenInFlight;
  }

  sgisTokenInFlight = (async () => {
    try {
      const params = new URLSearchParams({
        consumer_key: sgisKey,
        consumer_secret: sgisSecret,
      });

      const url = `https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json?${params.toString()}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) {
        throw new Error(`SGIS_AUTH_HTTP_${resp.status}`);
      }
      const data = (await resp.json()) as {
        errCd?: number;
        errMsg?: string;
        result?: { accessToken?: string; accessTimeout?: string };
      };

      if (data.errCd !== 0 || !data.result?.accessToken) {
        throw new Error(`SGIS_AUTH_FAILED_${data.errCd ?? 'UNKNOWN'}`);
      }

      const timeoutMs = Number(data.result.accessTimeout);
      const expiresAt =
        Number.isFinite(timeoutMs) && timeoutMs > Date.now()
          ? timeoutMs
          : Date.now() + 3 * 60 * 60 * 1000;

      sgisTokenCache = {
        token: data.result.accessToken,
        expiresAt,
      };
      return sgisTokenCache.token;
    } finally {
      sgisTokenInFlight = null;
    }
  })();

  return sgisTokenInFlight;
}

/**
 * SGIS 응답 1건 받기. 시간 초과·연결 끊김·5xx는 제한 시간을 2배로 늘려 한 번 더 시도.
 * 한 시도(17개 중 하나)의 경계가 한 번 실패하면 그 시도 전체가 지도에서 빠지므로 재시도함
 */
async function fetchSgisJsonWithRetry<T>(url: string, timeoutMs: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs * (attempt + 1)) });
      if (resp.status >= 500) {
        lastError = new Error(`SGIS_HTTP_${resp.status}`);
        continue;
      }
      if (!resp.ok) {
        throw new Error(`SGIS_HTTP_${resp.status}`);
      }
      return (await resp.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SGIS_HTTP_')) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('SGIS_FETCH_FAILED');
}

async function fetchSgisApi<T extends { errCd?: number; errMsg?: string }>(
  endpointPath: string,
  extraParams: Record<string, string>,
  timeoutMs = 15_000
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getSgisAccessToken(attempt > 0);
    const params = new URLSearchParams({
      ...extraParams,
      accessToken: token,
    });
    const url = `https://sgisapi.kostat.go.kr/OpenAPI3/${endpointPath}?${params.toString()}`;
    const raw = await fetchSgisJsonWithRetry<T>(url, timeoutMs);
    if (raw.errCd === -401 && attempt === 0) {
      sgisTokenCache = null;
      continue;
    }
    return raw;
  }
  throw new Error('SGIS_AUTH_RETRY_FAILED');
}

// ==================== Exact EPSG:5179 (UTM-K) → Planar km ====================
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

const KM_PER_DEG_LAT = 110.95;
const KM_PER_DEG_LON = 111.32 * Math.cos((36.0 * Math.PI) / 180);

function epsg5179ToPlanarKm(easting: number, northing: number): [number, number] {
  if (Math.abs(easting) < 1000) {
    // Already WGS84 [lon, lat]
    const x = (easting - 127.5) * KM_PER_DEG_LON;
    const y = (36.0 - northing) * KM_PER_DEG_LAT;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  }
  const xUtm = easting - UTMK_FE;
  const yUtm = northing - UTMK_FN;
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

  const lat = (latRad * 180) / Math.PI;
  const lon = (lonRad * 180) / Math.PI;
  const x = (lon - 127.5) * KM_PER_DEG_LON;
  const y = (36.0 - lat) * KM_PER_DEG_LAT;
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function pointSegDistSq(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      a = b;
    } else if (t > 0) {
      dx = p[0] - (a[0] + dx * t);
      dy = p[1] - (a[1] + dy * t);
      return dx * dx + dy * dy;
    }
  }
  dx = p[0] - a[0];
  dy = p[1] - a[1];
  return dx * dx + dy * dy;
}

function simplifyRing(pts: [number, number][], tolKm: number): [number, number][] {
  if (pts.length <= 4) return pts;
  const tolSq = tolKm * tolKm;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistSq = 0;
    let maxIdx = first;
    for (let i = first + 1; i < last; i++) {
      const dSq = pointSegDistSq(pts[i], pts[first], pts[last]);
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        maxIdx = i;
      }
    }
    if (maxDistSq > tolSq && maxIdx !== first) {
      keep[maxIdx] = 1;
      stack.push([first, maxIdx], [maxIdx, last]);
    }
  }

  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (keep[i]) out.push(pts[i]);
  }
  return out;
}

function ringAreaKm2(pts: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(area) * 0.5;
}

interface SimplifiedBoundaryFeature {
  admCd: string;
  admNm: string;
  sidoCd: string;
  rings: [number, number][][];
}

function extractSimplifiedBoundaries(
  geojson: {
    features?: Array<{
      properties?: { adm_cd?: string; adm_nm?: string };
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  },
  tolKm: number,
  minRingAreaKm2: number,
  fallbackSidoCd = ''
): SimplifiedBoundaryFeature[] {
  const out: SimplifiedBoundaryFeature[] = [];
  for (const feat of geojson.features ?? []) {
    const admCd = String(feat.properties?.adm_cd ?? '');
    const admNm = String(feat.properties?.adm_nm ?? '');
    const sidoCd = fallbackSidoCd || admCd.slice(0, 2);
    const geom = feat.geometry;
    if (!geom || !geom.coordinates) continue;

    const rawRings: number[][][] = [];
    if (geom.type === 'Polygon') {
      const poly = geom.coordinates as number[][][];
      if (poly[0]) rawRings.push(poly[0]);
    } else if (geom.type === 'MultiPolygon') {
      const mpoly = geom.coordinates as number[][][][];
      for (const poly of mpoly) {
        if (poly[0]) rawRings.push(poly[0]);
      }
    }

    const projected = rawRings
      .map((r) => {
        const kmPts = r.map((c) => epsg5179ToPlanarKm(c[0], c[1]));
        const area = ringAreaKm2(kmPts);
        return { kmPts, area };
      })
      .sort((a, b) => b.area - a.area);

    const kept: [number, number][][] = [];
    for (let i = 0; i < projected.length; i++) {
      // 항상 가장 큰 링 1개는 보존하고, 부속 도서는 최소 면적 이상만 포함
      if (i === 0 || projected[i].area >= minRingAreaKm2) {
        const simp = simplifyRing(projected[i].kmPts, tolKm);
        if (simp.length >= 3) kept.push(simp);
      }
    }
    if (kept.length > 0) {
      out.push({ admCd, admNm, sidoCd, rings: kept });
    }
  }
  return out;
}

const SGIS_SIDO_CODES = [
  '11', '21', '22', '23', '24', '25', '26', '29',
  '31', '32', '33', '34', '35', '36', '37', '38', '39',
];

/**
 * KoreaCiv 7대 산업(IndustryKey, src/data/rules.ts INDUSTRY_META)과
 * SGIS 산업분류(stats/industrycode.json) 대분류 코드(KSIC) 매핑.
 * ictScience·hospitality는 두 개 대분류를 합산 집계함.
 */
const SGIS_INDUSTRY_DIVISIONS: Record<string, string[]> = {
  manufacturing: ['C'],
  ictScience: ['J', 'M'],
  finance: ['K'],
  logistics: ['H'],
  hospitality: ['I', 'R'],
  publicAdmin: ['O'],
  agriculture: ['A'],
};

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

// ==================== Validation Helpers ====================
const YEAR_REGEX = /^(2000|2005|201[0-9]|202[0-6])$/;
const HISTORY_ALLOWED_YEARS = new Set(['2010', '2015', '2020', '2024']);
const ADM_CD_REGEX = /^\d{2,5}$/;

function sanitizeQuery(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

// ==================== Express App ====================
async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // 1. API Key Status (booleans only — never exposes secret values)
  app.get('/api/status', (_req: Request, res: Response) => {
    const cfg = getApiConfig();
    res.json({
      sgis: cfg.hasSgis,
      kosis: cfg.hasKosis,
      vworld: cfg.hasVworld,
      expectedEnvVars: {
        sgis: ['SGIS_CONSUMER_KEY', 'SGIS_CONSUMER_SECRET'],
        kosis: ['KOSIS_API_KEY'],
        vworld: ['VWORLD_API_KEY'],
      },
    });
  });

  // 2. SGIS: 시군구/자치구/읍면동 실측 인구 통계
  app.get('/api/sgis/subdistricts', async (req: Request, res: Response) => {
    const year = sanitizeQuery(req.query.year, 4) || '2024';
    const admCd = sanitizeQuery(req.query.admCd, 5);

    if (!YEAR_REGEX.test(year)) {
      res.status(400).json({ error: '유효한 기준연도(2000, 2005, 2010~2026)를 지정해 주세요.' });
      return;
    }
    if (admCd && !ADM_CD_REGEX.test(admCd)) {
      res.status(400).json({ error: '유효한 행정구역 코드(2~5자리 숫자)가 아닙니다.' });
      return;
    }

    const cacheKey = `sgis:sub:${year}:${admCd || 'all'}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const extra: Record<string, string> = { year, low_search: '1' };
      if (admCd) extra.adm_cd = admCd;
      const raw = await fetchSgisApi<{
        errCd?: number;
        errMsg?: string;
        result?: Array<Record<string, string>>;
      }>('stats/population.json', extra, 12_000);

      if (raw.errCd !== 0) {
        res.status(502).json({
          error: raw.errMsg || `SGIS 조회 오류 (코드 ${raw.errCd})`,
        });
        return;
      }

      const items = (raw.result ?? []).map((row) => ({
        admCd: String(row.adm_cd ?? ''),
        admNm: String(row.adm_nm ?? ''),
        totPpltn: Number(row.tot_ppltn ?? 0) || 0,
        avgAge: Number(row.avg_age ?? 0) || 0,
        ppltnDnsty: Number(row.ppltn_dnsty ?? 0) || 0,
        agedChildIdx: Number(row.aged_child_idx ?? 0) || 0,
        totFamily: Number(row.tot_family ?? 0) || 0,
        corpCnt: Number(row.corp_cnt ?? 0) || 0,
        employeeCnt: Number(row.employee_cnt ?? 0) || 0,
      }));

      const payload = {
        source: '국가데이터처 SGIS OpenAPI',
        year,
        admCd: admCd || 'all',
        count: items.length,
        items,
      };

      cacheSet(cacheKey, payload, 30 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN';
      if (msg === 'SGIS_NOT_CONFIGURED') {
        res.status(503).json({
          error: 'SGIS API 키(SGIS_CONSUMER_KEY, SGIS_CONSUMER_SECRET)가 설정되지 않았습니다.',
        });
        return;
      }
      res.status(502).json({ error: 'SGIS 통계 조회 중 오류가 발생했습니다.' });
    }
  });

  // 3. SGIS: 공식 시군구/자치구 행정경계 GeoJSON
  app.get('/api/sgis/boundary', async (req: Request, res: Response) => {
    const year = sanitizeQuery(req.query.year, 4) || '2024';
    const admCd = sanitizeQuery(req.query.admCd, 5);

    if (!YEAR_REGEX.test(year)) {
      res.status(400).json({ error: '유효한 기준연도(2000, 2005, 2010~2026)를 지정해 주세요.' });
      return;
    }
    if (!admCd || !ADM_CD_REGEX.test(admCd)) {
      res.status(400).json({ error: '경계 조회에는 2~5자리 행정구역 코드가 필요합니다.' });
      return;
    }

    const cacheKey = `sgis:bnd:${year}:${admCd}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const data = await fetchSgisApi<{
        errCd?: number;
        errMsg?: string;
        type?: string;
        features?: unknown[];
      }>('boundary/hadmarea.geojson', { year, adm_cd: admCd, low_search: '1' }, 15_000);

      if (typeof data.errCd === 'number' && data.errCd !== 0) {
        res.status(502).json({
          error: data.errMsg || `SGIS 경계 조회 오류 (코드 ${data.errCd})`,
        });
        return;
      }

      const payload = {
        source: '국가데이터처 SGIS 공식 경계 GeoJSON',
        year,
        admCd,
        featureCount: Array.isArray(data.features) ? data.features.length : 0,
        geojson: data,
      };
      cacheSet(cacheKey, payload, 60 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN';
      if (msg === 'SGIS_NOT_CONFIGURED') {
        res.status(503).json({
          error: 'SGIS API 키가 설정되지 않았습니다.',
        });
        return;
      }
      res.status(502).json({ error: 'SGIS 공식 경계 조회 중 오류가 발생했습니다.' });
    }
  });

  // 4. KOSIS: 국가통계포털 시계열 데이터 조회 (시도별 GRDP / 1인당 GRDP / 주민등록인구 / 고령인구)
  const KOSIS_PRESETS: Record<
    string,
    {
      label: string;
      orgId: string;
      tblId: string;
      itmId: string;
      objL1: string;
      objL2?: string;
      unit: string;
      preferredItemKeyword?: string;
      preferredC2Keyword?: string;
    }
  > = {
    grdp_sido: {
      label: '시도별 지역내총생산 (명목 GRDP)',
      orgId: '101',
      tblId: 'INH_1C91',
      itmId: 'ALL',
      objL1: 'ALL',
      objL2: 'ALL',
      unit: '백만원',
      preferredItemKeyword: '명목',
      preferredC2Keyword: '지역내총생산',
    },
    grdp_pc_sido: {
      label: '시도별 1인당 GRDP',
      orgId: '101',
      tblId: 'INH_1C96_02',
      itmId: 'ALL',
      objL1: 'ALL',
      unit: '천원',
    },
    pop_sido: {
      label: '시도별 주민등록인구',
      orgId: '101',
      tblId: 'DT_1B040A3',
      itmId: 'T20',
      objL1: 'ALL',
      unit: '명',
    },
    aging_sido: {
      label: '시도별 고령인구비율 (65세 이상)',
      orgId: '101',
      tblId: 'DT_1YL20631',
      itmId: 'T10',
      objL1: 'ALL',
      unit: '%',
    },
  };

  async function fetchKosisPreset(
    indicator: string,
    startYear: string,
    endYear: string,
    kosisKey: string
  ) {
    const preset = KOSIS_PRESETS[indicator];
    if (!preset) {
      throw new Error('UNSUPPORTED_INDICATOR');
    }

    const params = new URLSearchParams({
      method: 'getList',
      apiKey: kosisKey,
      format: 'json',
      jsonVD: 'Y',
      prdSe: 'Y',
      startPrdDe: startYear,
      endPrdDe: endYear,
      orgId: preset.orgId,
      tblId: preset.tblId,
      itmId: preset.itmId,
      objL1: preset.objL1,
    });
    if (preset.objL2) params.set('objL2', preset.objL2);

    const url = `https://kosis.kr/openapi/Param/statisticsParameterData.do?${params.toString()}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!resp.ok) {
      throw new Error(`KOSIS_HTTP_${resp.status}`);
    }

    const raw = (await resp.json()) as unknown;
    if (!Array.isArray(raw)) {
      const errObj = raw as { err?: string; errMsg?: string };
      throw new Error(errObj.errMsg || 'KOSIS_INVALID_RESPONSE');
    }

    let rawRows = (raw as Array<Record<string, string>>)
      .map((r) => {
        const rawUnit = String(r.UNIT_NM ?? '').trim();
        const cleanUnit =
          rawUnit && !rawUnit.includes('%p') && rawUnit.length <= 8
            ? rawUnit
            : preset.unit;
        return {
          region: String(r.C1_NM ?? r.C1 ?? ''),
          regionCode: String(r.C1 ?? ''),
          c2Name: String(r.C2_NM ?? ''),
          year: String(r.PRD_DE ?? ''),
          value: Number(String(r.DT ?? '').replace(/,/g, '')) || 0,
          unit: cleanUnit,
          itemName: String(r.ITM_NM ?? '')
            .replace(/[<＜][^>＞]+[>＞]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        };
      })
      .filter((r) => r.region && r.year);

    // 다중 분류(C2) 반환 시 총계/대표 분류로 필터링
    if (rawRows.length > 0 && preset.objL2 === 'ALL') {
      const distinctC2 = Array.from(new Set(rawRows.map((r) => r.c2Name).filter(Boolean)));
      if (distinctC2.length > 1) {
        const pickedC2 =
          (preset.preferredC2Keyword &&
            distinctC2.find((nm) => nm.includes(preset.preferredC2Keyword!))) ||
          distinctC2[0];
        rawRows = rawRows.filter((r) => r.c2Name === pickedC2);
      }
    }

    // 다중 항목 반환 시 첫 번째 대표 항목(또는 preferredItemKeyword)으로 필터링
    if (rawRows.length > 0 && preset.itmId === 'ALL') {
      const distinctItems = Array.from(new Set(rawRows.map((r) => r.itemName)));
      if (distinctItems.length > 1) {
        const picked =
          (preset.preferredItemKeyword &&
            distinctItems.find((nm) => nm.includes(preset.preferredItemKeyword!))) ||
          distinctItems[0];
        rawRows = rawRows.filter((r) => r.itemName === picked);
      }
    }

    const rows = rawRows.map(({ c2Name: _c2, ...rest }) => rest);

    return {
      source: `국가데이터처 KOSIS (${preset.tblId})`,
      indicator,
      label: preset.label,
      tblId: preset.tblId,
      unit: rows[0]?.unit || preset.unit,
      rowCount: rows.length,
      rows,
    };
  }

  app.get('/api/kosis/timeseries', async (req: Request, res: Response) => {
    const { kosisKey } = getApiConfig();
    if (!kosisKey) {
      res.status(503).json({
        error: 'KOSIS API 키(KOSIS_API_KEY)가 설정되지 않았습니다.',
      });
      return;
    }

    const indicator = sanitizeQuery(req.query.indicator, 32) || 'grdp_sido';
    if (!KOSIS_PRESETS[indicator]) {
      res.status(400).json({ error: '지원하지 않는 KOSIS 지표 코드입니다.' });
      return;
    }

    const startYear = sanitizeQuery(req.query.startYear, 4) || '2018';
    const endYear = sanitizeQuery(req.query.endYear, 4) || '2026';
    if (!YEAR_REGEX.test(startYear) || !YEAR_REGEX.test(endYear)) {
      res.status(400).json({ error: '유효한 조회 연도 범위(2015~2026)를 지정해 주세요.' });
      return;
    }

    const cacheKey = `kosis:ts:${indicator}:${startYear}:${endYear}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const payload = await fetchKosisPreset(indicator, startYear, endYear, kosisKey);
      cacheSet(cacheKey, payload, 30 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      res.status(502).json({
        error:
          msg && !msg.startsWith('KOSIS_')
            ? msg
            : 'KOSIS OpenAPI 호출 중 오류가 발생했습니다.',
      });
    }
  });

  // 4.5. 실시간 통합 부트스트랩: SGIS 최신 공식 시도/시군구 경계·통계 + KOSIS 최신(2024~2025) 통계 일괄 로드
  let bootstrapInFlight: Promise<unknown> | null = null;

  app.get('/api/live/bootstrap', async (req: Request, res: Response) => {
    const forceRefresh = req.query.refresh === '1';
    const cacheKey = 'live:bootstrap:v1';
    if (!forceRefresh) {
      const cached = cacheGet<unknown>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const cfg = getApiConfig();
    if (!cfg.hasSgis && !cfg.hasKosis) {
      res.status(503).json({
        error: 'SGIS 또는 KOSIS API 키가 설정되지 않았습니다.',
      });
      return;
    }

    const buildBootstrap = async () => {
      let sgisYear = '';
      let provinceBoundaries: SimplifiedBoundaryFeature[] = [];
      let sigunguBoundaries: SimplifiedBoundaryFeature[] = [];
      let sgisStats: Array<{
        sidoCd: string;
        admCd: string;
        admNm: string;
        totPpltn: number;
        avgAge: number;
        ppltnDnsty: number;
        agedChildIdx: number;
        totFamily: number;
        corpCnt: number;
        employeeCnt: number;
      }> = [];

      const sgisTask = (async () => {
        if (!cfg.hasSgis) return;
        // 최신 연도 자동 탐색 (2024 → 2023)
        for (const yr of ['2024', '2023']) {
          try {
            const rawProv = await fetchSgisApi<{
              errCd?: number;
              features?: Array<{
                properties?: { adm_cd?: string; adm_nm?: string };
                geometry?: { type?: string; coordinates?: unknown };
              }>;
            }>('boundary/hadmarea.geojson', { year: yr, low_search: '1' }, 15_000);
            if ((!rawProv.errCd || rawProv.errCd === 0) && Array.isArray(rawProv.features) && rawProv.features.length >= 15) {
              sgisYear = yr;
              provinceBoundaries = extractSimplifiedBoundaries(rawProv, 0.45, 3.0);
              break;
            }
          } catch {
            // 다음 연도로 폴백
          }
        }

        if (!sgisYear) return;

        // 전국 17개 시도의 시군구 공식 경계 + 시군구 실측 통계 병렬 조회 (동시성 6)
        const [bndPerSido, statPerSido] = await Promise.all([
          runWithConcurrency(SGIS_SIDO_CODES, 6, async (sidoCd) => {
            try {
              const raw = await fetchSgisApi<{
                errCd?: number;
                features?: Array<{
                  properties?: { adm_cd?: string; adm_nm?: string };
                  geometry?: { type?: string; coordinates?: unknown };
                }>;
              }>('boundary/hadmarea.geojson', { year: sgisYear, adm_cd: sidoCd, low_search: '1' }, 15_000);
              if (!raw.errCd || raw.errCd === 0) {
                return extractSimplifiedBoundaries(raw, 0.4, 2.0, sidoCd);
              }
            } catch {
              // 일부 시도 실패 시 건너뜀
            }
            return [] as SimplifiedBoundaryFeature[];
          }),
          runWithConcurrency(SGIS_SIDO_CODES, 6, async (sidoCd) => {
            try {
              const raw = await fetchSgisApi<{
                errCd?: number;
                result?: Array<Record<string, string>>;
              }>('stats/population.json', { year: sgisYear, adm_cd: sidoCd, low_search: '1' }, 12_000);
              if (raw.errCd === 0 && Array.isArray(raw.result)) {
                return raw.result.map((row) => ({
                  sidoCd,
                  admCd: String(row.adm_cd ?? ''),
                  admNm: String(row.adm_nm ?? ''),
                  totPpltn: Number(row.tot_ppltn ?? 0) || 0,
                  avgAge: Number(row.avg_age ?? 0) || 0,
                  ppltnDnsty: Number(row.ppltn_dnsty ?? 0) || 0,
                  agedChildIdx: Number(row.aged_child_idx ?? 0) || 0,
                  totFamily: Number(row.tot_family ?? 0) || 0,
                  corpCnt: Number(row.corp_cnt ?? 0) || 0,
                  employeeCnt: Number(row.employee_cnt ?? 0) || 0,
                }));
              }
            } catch {
              // 일부 시도 실패 시 건너뜀
            }
            return [];
          }),
        ]);

        sigunguBoundaries = bndPerSido.flat();
        sgisStats = statPerSido.flat();
      })();

      // 7대 산업(IndustryKey)의 전국 종사자 수를 SGIS 사업체통계(stats/company.json)로 실시간 조회해
      // LQ(입지계수) 산정의 전국 기준치를 koreaCities.ts 정적 수치 대신 실측값으로 대체
      let nationalIndustryShares: Record<string, { corpCnt: number; totWorker: number; sharePct: number }> = {};
      const industryTask = (async () => {
        if (!cfg.hasSgis) return;
        await sgisTask;
        if (!sgisYear) return;

        // class_code 없이 호출하면(전국 17개 시도 목록) 모든 업종을 합친 전국 전체
        // 종사자 수가 all_worker_cnt에 내려옴 — 이게 LQ 분모(전국 전체 종사자 수).
        // (class_code를 넣으면 all_worker_cnt도 그 업종만의 전국 합계로 바뀌어버려
        //  전체 분모로 쓸 수 없음 — 반드시 별도 호출 필요)
        let totalEmployeeCnt = 0;
        try {
          const totalRaw = await fetchSgisApi<{
            errCd?: number;
            result?: Array<Record<string, string>>;
          }>('stats/company.json', { year: sgisYear, low_search: '1' }, 12_000);
          if (totalRaw.errCd === 0 && Array.isArray(totalRaw.result) && totalRaw.result[0]) {
            totalEmployeeCnt = Number(totalRaw.result[0].all_worker_cnt ?? 0) || 0;
          }
        } catch {
          // 전체 종사자 수 조회 실패 시 아래에서 totalEmployeeCnt <= 0으로 중단
        }
        if (totalEmployeeCnt <= 0) return;

        const industryKeys = Object.keys(SGIS_INDUSTRY_DIVISIONS);
        const totalsPerIndustry = await runWithConcurrency(industryKeys, 4, async (indKey) => {
          const divisions = SGIS_INDUSTRY_DIVISIONS[indKey];
          let corpCnt = 0;
          let totWorker = 0;
          for (const classCode of divisions) {
            try {
              // adm_cd를 지정하지 않으면(전국 17개 시도 목록) class_code 업종의 시도별
              // corp_cnt/tot_worker가 내려옴 — 합산하면 그 업종의 전국 합계가 됨.
              // adm_cd='non'을 보내면 -200(행정동 코드 오류)이 나므로 adm_cd는 생략해야 함.
              const raw = await fetchSgisApi<{
                errCd?: number;
                result?: Array<Record<string, string>>;
              }>(
                'stats/company.json',
                { year: sgisYear, low_search: '1', class_code: classCode },
                12_000
              );
              if (raw.errCd === 0 && Array.isArray(raw.result)) {
                for (const row of raw.result) {
                  corpCnt += Number(row.corp_cnt ?? 0) || 0;
                  totWorker += Number(row.tot_worker ?? 0) || 0;
                }
              }
            } catch {
              // 일부 업종 분류 실패 시 해당 분류만 건너뜀 (0으로 남음)
            }
          }
          return [indKey, { corpCnt, totWorker }] as const;
        });

        const result: Record<string, { corpCnt: number; totWorker: number; sharePct: number }> = {};
        for (const [indKey, totals] of totalsPerIndustry) {
          result[indKey] = {
            ...totals,
            sharePct: Number(((totals.totWorker / totalEmployeeCnt) * 100).toFixed(2)),
          };
        }
        nationalIndustryShares = result;
      })();

      let kosisPopYear = '';
      let kosisAgingYear = '';
      let kosisGrdpYear = '';
      let kosisPopRows: Array<{ region: string; regionCode: string; value: number }> = [];
      let kosisAgingRows: Array<{ region: string; regionCode: string; value: number }> = [];
      let kosisGrdpBySido: Array<{ region: string; regionCode: string; valueMillionKrw: number }> = [];
      let kosisGrdpPcBySido: Array<{ region: string; regionCode: string; valueThousandKrw: number }> = [];

      const kosisTask = (async () => {
        if (!cfg.hasKosis) return;
        const [grdpRes, grdpPcRes, popRes, agingRes] = await Promise.allSettled([
          fetchKosisPreset('grdp_sido', '2022', '2026', cfg.kosisKey),
          fetchKosisPreset('grdp_pc_sido', '2022', '2026', cfg.kosisKey),
          fetchKosisPreset('pop_sido', '2023', '2026', cfg.kosisKey),
          fetchKosisPreset('aging_sido', '2023', '2026', cfg.kosisKey),
        ]);

        const pickLatest = <T extends { year: string }>(rows: T[]) => {
          const years = Array.from(new Set(rows.map((r) => r.year))).sort();
          const latest = years[years.length - 1] ?? '';
          return { latest, rows: latest ? rows.filter((r) => r.year === latest) : [] };
        };

        if (grdpRes.status === 'fulfilled') {
          const { latest, rows } = pickLatest(grdpRes.value.rows);
          kosisGrdpYear = latest;
          kosisGrdpBySido = rows.map((r) => ({
            region: r.region,
            regionCode: r.regionCode,
            valueMillionKrw: r.value,
          }));
        }
        if (grdpPcRes.status === 'fulfilled') {
          const { rows } = pickLatest(grdpPcRes.value.rows);
          kosisGrdpPcBySido = rows.map((r) => ({
            region: r.region,
            regionCode: r.regionCode,
            valueThousandKrw: r.value,
          }));
        }
        if (popRes.status === 'fulfilled') {
          const { latest, rows } = pickLatest(popRes.value.rows);
          kosisPopYear = latest;
          kosisPopRows = rows.map((r) => ({
            region: r.region,
            regionCode: r.regionCode,
            value: r.value,
          }));
        }
        if (agingRes.status === 'fulfilled') {
          const { latest, rows } = pickLatest(agingRes.value.rows);
          kosisAgingYear = latest;
          kosisAgingRows = rows.map((r) => ({
            region: r.region,
            regionCode: r.regionCode,
            value: r.value,
          }));
        }
      })();

      await Promise.all([sgisTask, kosisTask, industryTask]);

      return {
        fetchedAt: new Date().toISOString(),
        sgisYear: sgisYear || null,
        kosisPopYear: kosisPopYear || null,
        kosisAgingYear: kosisAgingYear || null,
        kosisGrdpYear: kosisGrdpYear || null,
        provinceBoundaries,
        sigunguBoundaries,
        sgisStats,
        nationalIndustryShares,
        kosisLatest: {
          grdpBySido: kosisGrdpBySido,
          grdpPcBySido: kosisGrdpPcBySido,
          popRows: kosisPopRows,
          agingRows: kosisAgingRows,
        },
      };
    };

    try {
      if (!bootstrapInFlight || forceRefresh) {
        bootstrapInFlight = buildBootstrap().finally(() => {
          bootstrapInFlight = null;
        });
      }
      const payload = await bootstrapInFlight;
      cacheSet(cacheKey, payload, 6 * 60 * 60 * 1000);
      res.json(payload);
    } catch {
      res.status(502).json({ error: '실시간 SGIS/KOSIS 통합 부트스트랩 조회에 실패했습니다.' });
    }
  });

  // 4.6 SGIS 역사 센서스 경계 + 시군구 인구밀도 스냅샷 (2010 / 2015 / 2020 / 2024)
  const historyInFlight = new Map<string, Promise<unknown>>();

  app.get('/api/sgis/history', async (req: Request, res: Response) => {
    const year = sanitizeQuery(req.query.year, 4) || '2010';
    if (!HISTORY_ALLOWED_YEARS.has(year)) {
      res.status(400).json({ error: '역사 스냅샷은 2010, 2015, 2020, 2024년만 지원합니다.' });
      return;
    }

    const cacheKey = `sgis:history:${year}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const cfg = getApiConfig();
    if (!cfg.hasSgis) {
      res.status(503).json({
        error: 'SGIS API 키(SGIS_CONSUMER_KEY, SGIS_CONSUMER_SECRET)가 설정되지 않았습니다.',
      });
      return;
    }

    const buildHistory = async () => {
      const rawProv = await fetchSgisApi<{
        errCd?: number;
        features?: Array<{
          properties?: { adm_cd?: string; adm_nm?: string };
          geometry?: { type?: string; coordinates?: unknown };
        }>;
      }>('boundary/hadmarea.geojson', { year, low_search: '1' }, 15_000);

      if (rawProv.errCd && rawProv.errCd !== 0) {
        throw new Error(`SGIS_HIST_PROV_${rawProv.errCd}`);
      }

      const provinceBoundaries = extractSimplifiedBoundaries(rawProv, 0.5, 4.0);
      // 해당 연도에 실제로 존재했던 시도 코드 목록 사용 (예: 2010년은 세종 제외 16개 시도)
      const sidoCodes = provinceBoundaries
        .map((p) => p.admCd)
        .filter((cd) => /^\d{2}$/.test(cd));
      const targetCodes = sidoCodes.length >= 14 ? sidoCodes : SGIS_SIDO_CODES;

      const [bndPerSido, statPerSido, kosisPopRes] = await Promise.all([
        runWithConcurrency(targetCodes, 6, async (sidoCd) => {
          try {
            const raw = await fetchSgisApi<{
              errCd?: number;
              features?: Array<{
                properties?: { adm_cd?: string; adm_nm?: string };
                geometry?: { type?: string; coordinates?: unknown };
              }>;
            }>('boundary/hadmarea.geojson', { year, adm_cd: sidoCd, low_search: '1' }, 15_000);
            if (!raw.errCd || raw.errCd === 0) {
              return extractSimplifiedBoundaries(raw, 0.45, 2.5, sidoCd);
            }
          } catch {
            // 일부 시도 실패 시 건너뜀
          }
          return [] as SimplifiedBoundaryFeature[];
        }),
        runWithConcurrency(targetCodes, 6, async (sidoCd) => {
          try {
            const raw = await fetchSgisApi<{
              errCd?: number;
              result?: Array<Record<string, string>>;
            }>('stats/population.json', { year, adm_cd: sidoCd, low_search: '1' }, 12_000);
            if (raw.errCd === 0 && Array.isArray(raw.result)) {
              return raw.result.map((row) => ({
                sidoCd,
                admCd: String(row.adm_cd ?? ''),
                admNm: String(row.adm_nm ?? ''),
                totPpltn: Number(row.tot_ppltn ?? 0) || 0,
                avgAge: Number(row.avg_age ?? 0) || 0,
                ppltnDnsty: Number(row.ppltn_dnsty ?? 0) || 0,
                agedChildIdx: Number(row.aged_child_idx ?? 0) || 0,
                totFamily: Number(row.tot_family ?? 0) || 0,
                corpCnt: Number(row.corp_cnt ?? 0) || 0,
                employeeCnt: Number(row.employee_cnt ?? 0) || 0,
              }));
            }
          } catch {
            // 일부 시도 실패 시 건너뜀
          }
          return [];
        }),
        cfg.hasKosis
          ? fetchKosisPreset('pop_sido', year, year, cfg.kosisKey)
              .then((r) =>
                r.rows
                  .filter((row) => row.year === year && row.value > 0)
                  .map((row) => ({
                    region: row.region,
                    regionCode: row.regionCode,
                    value: row.value,
                  }))
              )
              .catch(() => [] as Array<{ region: string; regionCode: string; value: number }>)
          : Promise.resolve([] as Array<{ region: string; regionCode: string; value: number }>),
      ]);

      return {
        source: `국가데이터처 SGIS·KOSIS ${year}년 공식 경계·인구`,
        year,
        fetchedAt: new Date().toISOString(),
        provinceBoundaries,
        sigunguBoundaries: bndPerSido.flat(),
        sgisStats: statPerSido.flat(),
        kosisPopRows: kosisPopRes,
      };
    };

    try {
      let pending = historyInFlight.get(year);
      if (!pending) {
        pending = buildHistory().finally(() => {
          historyInFlight.delete(year);
        });
        historyInFlight.set(year, pending);
      }
      const payload = await pending;
      cacheSet(cacheKey, payload, 12 * 60 * 60 * 1000);
      res.json(payload);
    } catch {
      res.status(502).json({ error: `SGIS ${year}년 역사 데이터 조회에 실패했습니다.` });
    }
  });

  // 5. KOSIS: 통계표 키워드 검색
  app.get('/api/kosis/search', async (req: Request, res: Response) => {
    const { kosisKey } = getApiConfig();
    if (!kosisKey) {
      res.status(503).json({
        error: 'KOSIS API 키(KOSIS_API_KEY)가 설정되지 않았습니다.',
      });
      return;
    }

    const q = sanitizeQuery(req.query.q, 80);
    if (!q) {
      res.status(400).json({ error: '검색어를 입력해 주세요.' });
      return;
    }

    const cacheKey = `kosis:search:${q}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const params = new URLSearchParams({
        method: 'getList',
        apiKey: kosisKey,
        searchNm: q,
        format: 'json',
        jsonVD: 'Y',
        startCount: '1',
        resultCount: '15',
      });
      const url = `https://kosis.kr/openapi/statisticsSearch.do?${params.toString()}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) {
        res.status(502).json({ error: `KOSIS 검색 서버 응답 오류 (${resp.status})` });
        return;
      }

      const raw = (await resp.json()) as unknown;
      if (!Array.isArray(raw)) {
        const errObj = raw as { errMsg?: string };
        res.status(502).json({
          error: errObj.errMsg || 'KOSIS 통계표 검색 결과가 없거나 인증에 실패했습니다.',
        });
        return;
      }

      const items = (raw as Array<Record<string, string>>).map((r) => ({
        orgId: String(r.ORG_ID ?? ''),
        orgNm: String(r.ORG_NM ?? ''),
        tblId: String(r.TBL_ID ?? ''),
        tblNm: String(r.TBL_NM ?? '').replace(/<[^>]+>/g, ''),
        statNm: String(r.STAT_NM ?? ''),
        startDe: String(r.STRT_PRD_DE ?? ''),
        endDe: String(r.END_PRD_DE ?? ''),
      }));

      const payload = {
        source: '국가데이터처 KOSIS 통합검색',
        query: q,
        items,
      };
      cacheSet(cacheKey, payload, 15 * 60 * 1000);
      res.json(payload);
    } catch {
      res.status(502).json({ error: 'KOSIS 검색 중 오류가 발생했습니다.' });
    }
  });

  // 6. VWorld OpenAPI: 장소·주소 검색 및 지오코딩 (국토교통부 브이월드)
  interface VWorldPlaceItem {
    id: string;
    name: string;
    address: string;
    category: string;
    lat: number;
    lon: number;
  }

  const VWORLD_HEADERS = {
    'User-Agent': 'KoreaCiv/1.0 (https://koreaciv.app)',
    Accept: 'application/json',
  };

  const VWORLD_FALLBACK_NOTICE =
    'VWorld 서버가 해외 클라우드(asia-east1) IP에서 502 응답을 반환해 OpenStreetMap(한국어) 지오코딩으로 자동 전환했습니다. 국내 리전·로컬 환경에서는 VWorld 원본 응답이 사용됩니다.';

  async function nominatimSearch(query: string, limit = 8): Promise<VWorldPlaceItem[]> {
    const params = new URLSearchParams({
      q: query,
      countrycodes: 'kr',
      format: 'jsonv2',
      limit: String(Math.min(10, Math.max(1, limit))),
      'accept-language': 'ko',
    });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const resp = await fetch(url, {
      headers: VWORLD_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return [];
    const items = (await resp.json()) as Array<{
      place_id?: number;
      name?: string;
      display_name?: string;
      category?: string;
      type?: string;
      lat?: string;
      lon?: string;
    }>;
    return items
      .map((it, idx) => {
        const lat = Number(it.lat);
        const lon = Number(it.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          id: `osm_${it.place_id ?? idx}`,
          name: String(it.name || it.display_name?.split(',')[0] || query).trim(),
          address: String(it.display_name || ''),
          category: String(it.type || it.category || '장소'),
          lat,
          lon,
        };
      })
      .filter((x): x is VWorldPlaceItem => x !== null);
  }

  async function nominatimReverse(lat: number, lon: number) {
    const params = new URLSearchParams({
      lat: lat.toFixed(6),
      lon: lon.toFixed(6),
      format: 'jsonv2',
      'accept-language': 'ko',
      addressdetails: '1',
    });
    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    const resp = await fetch(url, {
      headers: VWORLD_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      display_name?: string;
      address?: {
        province?: string;
        city?: string;
        county?: string;
        borough?: string;
        town?: string;
        village?: string;
        suburb?: string;
        road?: string;
      };
    };
    const a = data.address ?? {};
    const adminParts = [
      a.province || a.city,
      a.county || a.borough,
      a.town || a.suburb || a.village,
    ].filter(Boolean);
    const roadAddr = a.road ? [...adminParts, a.road].join(' ') : null;
    return {
      parcelAddress: adminParts.length > 0 ? adminParts.join(' ') : data.display_name ?? null,
      roadAddress: roadAddr,
      adminPath: adminParts.length > 0 ? adminParts.join(' ') : null,
    };
  }

  async function vworldSearchApi(
    query: string,
    searchType: 'place' | 'address' | 'district',
    vworldKey: string,
    vworldDomain: string,
    size = 10,
    addressCategory?: 'road' | 'parcel'
  ): Promise<VWorldPlaceItem[]> {
    const params = new URLSearchParams({
      service: 'search',
      request: 'search',
      version: '2.0',
      crs: 'EPSG:4326',
      size: String(Math.min(20, Math.max(1, size))),
      page: '1',
      query,
      type: searchType,
      format: 'json',
      errorformat: 'json',
      key: vworldKey,
    });
    if (searchType === 'address' && addressCategory) {
      params.set('category', addressCategory);
    }
    if (vworldDomain) {
      params.set('domain', vworldDomain);
    }

    const url = `https://api.vworld.kr/req/search?${params.toString()}`;
    const resp = await fetch(url, {
      headers: VWORLD_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) {
      throw new Error(`VWORLD_HTTP_${resp.status}`);
    }

    const data = (await resp.json()) as {
      response?: {
        status?: string;
        error?: { code?: string; text?: string };
        result?: {
          items?: Array<{
            id?: string;
            title?: string;
            category?: string;
            address?: { road?: string; parcel?: string; bldnm?: string };
            point?: { x?: string | number; y?: string | number };
          }>;
        };
      };
    };

    const status = data.response?.status;
    if (status === 'NOT_FOUND') return [];
    if (status !== 'OK') {
      throw new Error(data.response?.error?.text || `VWORLD_STATUS_${status ?? 'ERROR'}`);
    }

    return (data.response?.result?.items ?? [])
      .map((item, idx) => {
        const lat = Number(item.point?.y);
        const lon = Number(item.point?.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const addr = String(item.address?.road || item.address?.parcel || '');
        const cleanTitle = String(item.title || item.address?.bldnm || addr || query)
          .replace(/<[^>]+>/g, '')
          .trim();
        return {
          id: String(item.id || `${lat.toFixed(5)}_${lon.toFixed(5)}_${idx}`),
          name: cleanTitle,
          address: addr,
          category: String(
            item.category ||
              (searchType === 'address'
                ? '도로명·지번 주소'
                : searchType === 'district'
                  ? '행정구역'
                  : '장소·시설')
          ),
          lat,
          lon,
        };
      })
      .filter((x): x is VWorldPlaceItem => x !== null);
  }

  async function vworldGeocodeAddressFallback(
    query: string,
    vworldKey: string,
    vworldDomain: string
  ): Promise<VWorldPlaceItem[]> {
    for (const addrType of ['road', 'parcel'] as const) {
      const params = new URLSearchParams({
        service: 'address',
        request: 'getcoord',
        version: '2.0',
        crs: 'epsg:4326',
        address: query,
        refine: 'true',
        simple: 'false',
        format: 'json',
        type: addrType,
        key: vworldKey,
      });
      if (vworldDomain) params.set('domain', vworldDomain);

      const url = `https://api.vworld.kr/req/address?${params.toString()}`;
      const resp = await fetch(url, {
        headers: VWORLD_HEADERS,
        signal: AbortSignal.timeout(8_000),
      });
      if (!resp.ok) continue;

      const data = (await resp.json()) as {
        response?: {
          status?: string;
          refined?: { text?: string };
          result?: { point?: { x?: string | number; y?: string | number } };
        };
      };

      if (data.response?.status === 'OK' && data.response.result?.point) {
        const lat = Number(data.response.result.point.y);
        const lon = Number(data.response.result.point.x);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const text = data.response.refined?.text || query;
          return [
            {
              id: `vworld_addr_${lat.toFixed(5)}_${lon.toFixed(5)}`,
              name: query,
              address: text,
              category: addrType === 'road' ? '도로명 주소' : '지번 주소',
              lat,
              lon,
            },
          ];
        }
      }
    }
    return [];
  }

  async function vworldSmartGeocode(
    query: string,
    mode: 'place' | 'address',
    vworldKey: string,
    vworldDomain: string,
    size = 10
  ): Promise<{ results: VWorldPlaceItem[]; usedFallback: boolean }> {
    try {
      if (mode === 'address') {
        let hits = await vworldSearchApi(query, 'address', vworldKey, vworldDomain, size, 'road');
        if (hits.length === 0) {
          hits = await vworldSearchApi(query, 'address', vworldKey, vworldDomain, size, 'parcel');
        }
        if (hits.length === 0) {
          hits = await vworldGeocodeAddressFallback(query, vworldKey, vworldDomain);
        }
        return { results: hits, usedFallback: false };
      }

      let hits = await vworldSearchApi(query, 'place', vworldKey, vworldDomain, size);
      if (hits.length === 0) {
        hits = await vworldSearchApi(query, 'address', vworldKey, vworldDomain, Math.min(size, 5), 'road');
      }
      if (hits.length === 0) {
        hits = await vworldSearchApi(query, 'district', vworldKey, vworldDomain, Math.min(size, 5));
      }
      if (hits.length === 0) {
        hits = await vworldGeocodeAddressFallback(query, vworldKey, vworldDomain);
      }
      return { results: hits, usedFallback: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // VWorld 서버가 해외 IP(502/503) 또는 네트워크 차단 시 Nominatim(한국어)으로 투명하게 폴백
      if (msg.includes('VWORLD_HTTP_5') || msg.includes('fetch') || msg.includes('timeout')) {
        const fallbackHits = await nominatimSearch(query, size);
        return { results: fallbackHits, usedFallback: true };
      }
      throw err;
    }
  }

  app.get('/api/vworld/search', async (req: Request, res: Response) => {
    const { vworldKey, vworldDomain } = getApiConfig();
    if (!vworldKey) {
      res.status(503).json({
        error: 'VWorld API 키(VWORLD_API_KEY)가 설정되지 않았습니다.',
      });
      return;
    }

    const q = sanitizeQuery(req.query.q, 100);
    if (!q) {
      res.status(400).json({ error: '검색할 장소명 또는 주소를 입력해 주세요.' });
      return;
    }

    const modeParam = sanitizeQuery(req.query.mode, 16);
    const mode: 'place' | 'address' = modeParam === 'address' ? 'address' : 'place';

    const cacheKey = `vworld:${mode}:${q}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const { results, usedFallback } = await vworldSmartGeocode(
        q,
        mode,
        vworldKey,
        vworldDomain,
        10
      );
      const payload = {
        source: usedFallback
          ? 'OpenStreetMap Nominatim (VWorld 해외 IP 502 폴백)'
          : '국토교통부 VWorld OpenAPI',
        fallbackNotice: usedFallback ? VWORLD_FALLBACK_NOTICE : undefined,
        query: q,
        mode,
        results,
      };
      cacheSet(cacheKey, payload, 15 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      res.status(502).json({
        error:
          msg && !msg.startsWith('VWORLD_')
            ? `VWorld 지오코딩 오류: ${msg}`
            : 'VWorld 지오코딩 호출 중 오류가 발생했습니다.',
      });
    }
  });

  // 7. VWorld: 다중 시설 일괄 지오코딩 (최대 20건, 5km 격자 배치용)
  app.post('/api/vworld/batch-geocode', async (req: Request, res: Response) => {
    const { vworldKey, vworldDomain } = getApiConfig();
    if (!vworldKey) {
      res.status(503).json({
        error: 'VWorld API 키(VWORLD_API_KEY)가 설정되지 않았습니다.',
      });
      return;
    }

    const body = req.body as { queries?: unknown };
    if (!Array.isArray(body?.queries) || body.queries.length === 0) {
      res.status(400).json({ error: '지오코딩할 장소 목록(queries 배열)이 필요합니다.' });
      return;
    }

    const queries = body.queries
      .slice(0, 20)
      .map((item) => sanitizeQuery(item, 80))
      .filter(Boolean);

    if (queries.length === 0) {
      res.status(400).json({ error: '유효한 검색 항목이 없습니다.' });
      return;
    }

    try {
      const matched: Array<{
        query: string;
        name: string;
        address: string;
        category: string;
        lat: number;
        lon: number;
      }> = [];
      const failed: string[] = [];
      let anyFallback = false;

      for (const q of queries) {
        try {
          let hits: VWorldPlaceItem[] = [];
          if (anyFallback) {
            hits = await nominatimSearch(q, 1);
            await new Promise((resolve) => setTimeout(resolve, 250));
          } else {
            const resOne = await vworldSmartGeocode(q, 'place', vworldKey, vworldDomain, 1);
            hits = resOne.results;
            if (resOne.usedFallback) {
              anyFallback = true;
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }
          if (hits.length > 0) {
            matched.push({
              query: q,
              name: hits[0].name,
              address: hits[0].address,
              category: hits[0].category,
              lat: hits[0].lat,
              lon: hits[0].lon,
            });
          } else {
            failed.push(q);
          }
        } catch {
          failed.push(q);
        }
      }

      const successRatePct =
        queries.length > 0 ? Math.round((matched.length / queries.length) * 100) : 0;

      res.json({
        source: anyFallback
          ? 'OpenStreetMap Nominatim (VWorld 해외 IP 502 폴백)'
          : '국토교통부 VWorld 일괄 지오코딩',
        fallbackNotice: anyFallback ? VWORLD_FALLBACK_NOTICE : undefined,
        total: queries.length,
        matchedCount: matched.length,
        failedCount: failed.length,
        successRatePct,
        matched,
        failed,
      });
    } catch {
      res.status(502).json({ error: 'VWorld 일괄 지오코딩 처리 중 오류가 발생했습니다.' });
    }
  });

  // 8. VWorld: 역지오코딩 (5km 육각 타일 중심 좌표 → 실제 도로명·지번 주소)
  app.get('/api/vworld/reverse', async (req: Request, res: Response) => {
    const { vworldKey, vworldDomain } = getApiConfig();
    if (!vworldKey) {
      res.status(503).json({
        error: 'VWorld API 키(VWORLD_API_KEY)가 설정되지 않았습니다.',
      });
      return;
    }

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 32 ||
      lat > 39.5 ||
      lon < 124 ||
      lon > 132.5
    ) {
      res.status(400).json({ error: '대한민국 영역 내의 유효한 위도·경도 좌표가 필요합니다.' });
      return;
    }

    const cacheKey = `vworld:rev:${lat.toFixed(4)}:${lon.toFixed(4)}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const params = new URLSearchParams({
        service: 'address',
        request: 'getaddress',
        version: '2.0',
        crs: 'epsg:4326',
        point: `${lon.toFixed(6)},${lat.toFixed(6)}`,
        format: 'json',
        type: 'both',
        zipcode: 'true',
        simple: 'false',
        key: vworldKey,
      });
      if (vworldDomain) params.set('domain', vworldDomain);

      const url = `https://api.vworld.kr/req/address?${params.toString()}`;
      let resp: globalThis.Response | null = null;
      try {
        resp = await fetch(url, {
          headers: VWORLD_HEADERS,
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        resp = null;
      }

      if (!resp || resp.status >= 500) {
        const osm = await nominatimReverse(lat, lon);
        const fallbackPayload = {
          source: 'OpenStreetMap Nominatim (VWorld 해외 IP 502 폴백)',
          fallbackNotice: VWORLD_FALLBACK_NOTICE,
          lat,
          lon,
          parcelAddress: osm?.parcelAddress ?? null,
          roadAddress: osm?.roadAddress ?? null,
          adminPath: osm?.adminPath ?? null,
        };
        cacheSet(cacheKey, fallbackPayload, 30 * 60 * 1000);
        res.json(fallbackPayload);
        return;
      }

      if (!resp.ok) {
        res.status(502).json({ error: `VWorld 역지오코딩 서버 오류 (${resp.status})` });
        return;
      }

      const data = (await resp.json()) as {
        response?: {
          status?: string;
          error?: { text?: string };
          result?: Array<{
            type?: string;
            text?: string;
            zipcode?: string;
            structure?: {
              level1?: string;
              level2?: string;
              level3?: string;
              level4L?: string;
              level4A?: string;
            };
          }>;
        };
      };

      if (data.response?.status === 'NOT_FOUND') {
        const emptyPayload = {
          source: '국토교통부 VWorld 역지오코딩',
          lat,
          lon,
          parcelAddress: null,
          roadAddress: null,
          adminPath: null,
        };
        cacheSet(cacheKey, emptyPayload, 30 * 60 * 1000);
        res.json(emptyPayload);
        return;
      }

      if (data.response?.status !== 'OK') {
        res.status(502).json({
          error: data.response?.error?.text || 'VWorld 역지오코딩 응답을 처리하지 못했습니다.',
        });
        return;
      }

      const results = data.response.result ?? [];
      const parcel = results.find((r) => r.type === 'parcel');
      const road = results.find((r) => r.type === 'road');
      const primary = parcel ?? road ?? results[0];
      const st = primary?.structure;
      const adminPath = st
        ? [st.level1, st.level2, st.level4A || st.level3].filter(Boolean).join(' ')
        : null;

      const payload = {
        source: '국토교통부 VWorld 역지오코딩',
        lat,
        lon,
        parcelAddress: parcel?.text ?? null,
        roadAddress: road?.text ?? null,
        adminPath,
      };
      cacheSet(cacheKey, payload, 60 * 60 * 1000);
      res.json(payload);
    } catch {
      res.status(502).json({ error: 'VWorld 역지오코딩 호출 중 오류가 발생했습니다.' });
    }
  });

  // ==================== Frontend Serving (Vite dev / dist prod) ====================
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`KoreaCiv server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KoreaCiv server:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
