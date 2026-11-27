/**
 * 대학알리미(data.go.kr) 학교코드 전체 목록을 받아, 이미 수록된 24개 외 "본교" 대학을
 * VWorld로 지오코딩하고 가장 가까운 시·군에 배정해 src/data/generated/universities.json을 만든다.
 *
 * 실행: npx tsx pipeline/fetch_universities.ts
 * (DATA_GO_KR_SERVICE_KEY, VWORLD_API_KEY가 .env에 있어야 함)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RAW_CITIES } from '../src/data/koreaCities';
import { RAW_UNIVERSITIES } from '../src/data/koreaFacilities';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'generated', 'universities.json');
const CACHE = path.join(__dirname, '..', 'data', 'raw', 'university_geocode_cache.json');

const DATA_GO_KR_KEY = process.env.DATA_GO_KR_SERVICE_KEY ?? '';
const VWORLD_KEY = process.env.VWORLD_API_KEY ?? '';

interface SchoolRow {
  schlId: string;
  schlKrnNm: string;
  clgcpDivCd: string;
  schlDivNm: string;
  estbDivNm: string;
  znNm: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function fetchSchoolCodes(): Promise<SchoolRow[]> {
  const params = new URLSearchParams({
    serviceKey: DATA_GO_KR_KEY,
    pageNo: '1',
    numOfRows: '999',
    svyYr: '2024',
  });
  const resp = await fetch(
    `https://apis.data.go.kr/B340014/BasicInformationService_2/getUniversityCode?${params.toString()}`
  );
  const xml = await resp.text();
  if (xml.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1] !== '00') {
    throw new Error('학교코드 API 응답 오류: ' + xml.slice(0, 200));
  }
  const rows: SchoolRow[] = [];
  for (const itemMatch of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const row: Record<string, string> = {};
    for (const tagMatch of itemMatch[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      row[tagMatch[1]] = tagMatch[2];
    }
    if (row.schlId && row.schlKrnNm) {
      rows.push({
        schlId: row.schlId,
        schlKrnNm: row.schlKrnNm,
        clgcpDivCd: row.clgcpDivCd ?? '',
        schlDivNm: row.schlDivNm ?? '',
        estbDivNm: row.estbDivNm ?? '',
        znNm: row.znNm ?? '',
      });
    }
  }
  return rows;
}

async function vworldGeocode(
  name: string,
  cache: Record<string, { lat: number; lon: number } | null>
): Promise<{ lat: number; lon: number } | null> {
  if (name in cache) return cache[name];
  const params = new URLSearchParams({
    service: 'search',
    request: 'search',
    version: '2.0',
    crs: 'EPSG:4326',
    size: '5',
    page: '1',
    query: name,
    type: 'place',
    format: 'json',
    errorformat: 'json',
    key: VWORLD_KEY,
  });
  // 요청 자체가 실패(네트워크 오류 등)하면 캐시하지 않음 — 연결이 복구된 뒤
  // 재실행하면 다시 시도되게 함. "검색은 됐지만 결과 0건"만 null로 캐시함
  let result: { lat: number; lon: number } | null;
  const resp = await fetch(`https://api.vworld.kr/req/search?${params.toString()}`);
  const data = (await resp.json()) as {
    response?: { result?: { items?: Array<{ title: string; category: string; point: { x: string; y: string } }> } };
  };
  const items = data.response?.result?.items ?? [];
  // "학교" 범주이면서 이름이 정확히 일치하는 결과를 우선 채택
  const exact = items.find((it) => it.title === name && it.category?.includes('학교'));
  const best = exact ?? items.find((it) => it.title === name) ?? items[0];
  result = best ? { lat: Number(best.point.y), lon: Number(best.point.x) } : null;
  cache[name] = result;
  fs.writeFileSync(CACHE, JSON.stringify(cache), 'utf-8');
  return result;
}

async function fetchResearchGrant(schlId: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      serviceKey: DATA_GO_KR_KEY,
      pageNo: '1',
      numOfRows: '1',
      schlId,
      svyYr: '2024',
    });
    const resp = await fetch(
      `https://apis.data.go.kr/B340014/EducationResearchService/getComparisonFullTimeFacultyOutsideOfSchoolForPersonResearchGrant?${params.toString()}`
    );
    if (!resp.ok) return null;
    const xml = await resp.text();
    if (xml.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1] !== '00') return null;
    const val = xml.match(/<indctVal1>([^<]*)<\/indctVal1>/)?.[1];
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
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

async function main() {
  if (!DATA_GO_KR_KEY || !VWORLD_KEY) {
    console.error('DATA_GO_KR_SERVICE_KEY, VWORLD_API_KEY가 .env에 필요합니다.');
    process.exit(1);
  }

  console.log('학교코드 목록 조회...');
  const schools = await fetchSchoolCodes();
  const mainCampuses = schools.filter((s) => s.clgcpDivCd === '1');
  console.log(`전체 ${schools.length}건, 본교 ${mainCampuses.length}건`);

  // 기존 24곳(RAW_UNIVERSITIES 원본 — 생성된 KOREA_FACILITIES를 쓰면 재실행할
  // 때마다 이전에 생성해 둔 323곳까지 "이미 있음"으로 잘못 제외됨)만 제외 대상으로 삼음.
  // "KAIST (한국과학기술원)"처럼 괄호 안이 대학알리미 정식명인 경우를 위해
  // server.ts의 universityMatchKeyword와 같은 규칙으로 키워드를 뽑음
  const universityMatchKeyword = (name: string): string => {
    const m = name.match(/\(([^)]+)\)/);
    return (m ? m[1] : name).trim();
  };
  const existingNames = new Set(RAW_UNIVERSITIES.map((u) => universityMatchKeyword(u.name)));

  const targets = mainCampuses.filter((s) => !existingNames.has(s.schlKrnNm));
  console.log(`기존 24곳 제외 후 신규 대상 ${targets.length}곳`);

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  let cache: Record<string, { lat: number; lon: number } | null> = {};
  if (fs.existsSync(CACHE)) {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
  }

  let geocoded = 0;
  let requestFailures = 0;
  const results = await runWithConcurrency(targets, 5, async (school) => {
    try {
      const point = await vworldGeocode(school.schlKrnNm, cache);
      const grant = await fetchResearchGrant(school.schlId);
      if (point) geocoded++;
      return { school, point, grant };
    } catch {
      // 네트워크 오류 등 요청 자체가 실패 — 캐시 안 타므로 재실행하면 다시 시도됨
      requestFailures++;
      return { school, point: null, grant: null };
    }
  });
  if (requestFailures > 0) {
    console.log(`요청 실패 ${requestFailures}곳 — 재실행하면 다시 시도됨`);
  }

  console.log(`지오코딩 성공 ${geocoded}/${targets.length}`);

  const output = results
    .filter((r) => r.point)
    .map(({ school, point, grant }) => {
      const p = point!;
      let nearestCity = RAW_CITIES[0];
      let bestDist = Infinity;
      for (const c of RAW_CITIES) {
        const d = haversineKm(p.lat, p.lon, c.lat, c.lon);
        if (d < bestDist) {
          bestDist = d;
          nearestCity = c;
        }
      }
      return {
        id: `univ_schl${school.schlId}`,
        name: school.schlKrnNm,
        type: 'university' as const,
        cityId: nearestCity.id,
        province: nearestCity.province,
        lat: Number(p.lat.toFixed(4)),
        lon: Number(p.lon.toFixed(4)),
        metricValue: grant ?? 0,
        metricUnit: '만원/교원',
        metricLabel: '전임교원 1인당 교외연구비',
        subCategory: `${school.schlDivNm} · ${school.estbDivNm}`,
        sourceNote:
          grant != null
            ? '대학알리미 (data.go.kr, 2024) · 교원 1인당 수치 — 지도의 상위 24개 대학(연간 총 연구비)과 단위가 다름'
            : '대학알리미 (data.go.kr) · 연구비 자료 없음(0으로 표시)',
      };
    });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`${output.length}곳 저장함 -> ${OUT}`);
}

main();
