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

// 대학알리미 getUniversityCode의 znNm(지역) 값 -> RAW_CITIES의 ProvinceCode.
// "전남광주"는 전남·광주 통합 표기라 둘 다 허용함
const ZN_NM_TO_PROVINCES: Record<string, string[]> = {
  경북: ['gyeongbuk'],
  경남: ['gyeongnam'],
  경기: ['gyeonggi'],
  강원: ['gangwon'],
  충북: ['chungbuk'],
  서울: ['seoul'],
  충남: ['chungnam'],
  대전: ['daejeon'],
  부산: ['busan'],
  대구: ['daegu'],
  인천: ['incheon'],
  세종: ['sejong'],
  전남광주: ['jeonnam', 'gwangju'],
  전북: ['jeonbuk'],
  울산: ['ulsan'],
  제주: ['jeju'],
};

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

// HTTP 오류·비정상 응답코드·네트워크 예외는 모두 throw함(= 호출부에서 요청
// 실패로 집계) — "자료가 진짜 없음"(resultCode는 정상인데 값이 비어 있는
// 경우)만 null로 반환해, 일시적 API 장애로 기존 연구비 값이 0으로
// 덮어써지지 않게 함
async function fetchResearchGrant(schlId: string): Promise<number | null> {
  const params = new URLSearchParams({
    serviceKey: DATA_GO_KR_KEY,
    pageNo: '1',
    numOfRows: '1',
    schlId,
    svyYr: '2024',
  });
  const url = `https://apis.data.go.kr/B340014/EducationResearchService/getComparisonFullTimeFacultyOutsideOfSchoolForPersonResearchGrant?${params.toString()}`;

  // 이 API는 대량 동시 호출 시 간헐적으로 빈 오류 응답을 주는 걸 관찰함
  // (같은 schlId를 개별로 재호출하면 정상 값이 나오는 경우가 많음) — 바로
  // 실패로 치지 않고 짧게 쉬었다가 몇 번 재시도함
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`연구비 API HTTP 오류 (${resp.status})`);
      const xml = await resp.text();
      if (xml.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1] !== '00') {
        throw new Error('연구비 API 응답 코드가 정상이 아님');
      }
      const val = xml.match(/<indctVal1>([^<]*)<\/indctVal1>/)?.[1];
      return val ? Number(val) : null;
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('연구비 API 재시도 실패');
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
  if (schools.length === 0) {
    // resultCode는 정상(00)인데 목록이 비는 경우 — API가 일시적으로 빈 성공
    // 응답을 줄 수 있음. 그대로 진행하면 main()이 0건 대상으로 돌아 기존
    // universities.json을 빈 배열로 덮어쓰게 되므로 여기서 중단함
    console.error('학교코드 목록이 비어 있습니다(resultCode는 정상). 기존 파일을 건드리지 않고 중단합니다. 다시 실행하세요.');
    process.exit(1);
  }
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

  // 이 연구비 API는 대량 호출 시 지속적으로(재시도 4번에도) 상당수가 실패하는
  // 걸 실측함 — 일시적 장애로 보고 전체를 중단하면 사실상 영원히 갱신을 못함.
  // 그래서 연구비만 실패한 학교는 직전 저장분의 값을 그대로 쓰고(재실행마다
  // 조금씩이라도 갱신되게), 좌표 자체가 실패한 경우만 전체 중단 대상으로 삼음
  const previousGrantBySchlId = new Map<string, number | null>();
  if (fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, 'utf-8')) as Array<{ id: string; metricValue: number }>;
      for (const u of prev) {
        const m = u.id.match(/^univ_schl(.+)$/);
        if (m) previousGrantBySchlId.set(m[1], u.metricValue > 0 ? u.metricValue : null);
      }
    } catch {
      // 기존 파일을 못 읽어도 치명적이지 않음 — 그냥 직전 값 없이 진행
    }
  }

  let geocoded = 0;
  let requestFailures = 0;
  let grantFallbackCount = 0;
  const results = await runWithConcurrency(targets, 5, async (school) => {
    let point: { lat: number; lon: number } | null = null;
    try {
      point = await vworldGeocode(school.schlKrnNm, cache);
    } catch {
      // 네트워크 오류 등 요청 자체가 실패 — 캐시 안 타므로 재실행하면 다시 시도됨
      requestFailures++;
      return { school, point: null, grant: null };
    }
    if (point) geocoded++;
    try {
      const grant = await fetchResearchGrant(school.schlId);
      return { school, point, grant };
    } catch {
      // 연구비만 실패 — 좌표는 살리고, 직전에 저장해 둔 값이 있으면 그걸 씀
      // (없으면 "자료 없음"과 똑같이 null. 실패를 전체 중단 사유로 치지 않음)
      grantFallbackCount++;
      return { school, point, grant: previousGrantBySchlId.get(school.schlId) ?? null };
    }
  });
  if (requestFailures > 0) {
    console.log(`요청 실패 ${requestFailures}곳 — 재실행하면 다시 시도됨`);
  }
  if (grantFallbackCount > 0) {
    console.log(`연구비 조회만 실패해 직전 값으로 대체 ${grantFallbackCount}곳`);
  }

  console.log(`지오코딩 성공 ${geocoded}/${targets.length}`);

  let regionMismatchCount = 0;
  const output = results
    .filter((r) => r.point)
    .map((r) => {
      const { school, point, grant } = r;
      const p = point!;

      // 전국 최근접 도시(기본값 — znNm 매핑이 없는 경우에만 씀)
      let nearestCity = RAW_CITIES[0];
      let bestDist = Infinity;
      for (const c of RAW_CITIES) {
        const d = haversineKm(p.lat, p.lon, c.lat, c.lon);
        if (d < bestDist) {
          bestDist = d;
          nearestCity = c;
        }
      }

      // 대학알리미가 알려준 지역(znNm)에 속한 도시 중 가장 가까운 도시로 검증·배정함
      // (전국에서 가장 가까운 도시가 아님 — 도 경계 근처 캠퍼스는 다른 도의
      // 도시가 전국 최근접일 수 있어서, 예: 서울여자대학교는 구리시 중심이
      // 서울 시내 어느 구보다 가까움. nearestCity를 그대로 쓰면 지역 검증은
      // 통과해도 cityId/province가 구리·경기로 잘못 배정됨). 지역 안에서
      // 가장 가까운 도시까지의 거리가 너무 멀면(50km 넘으면) VWorld가
      // 동명의 다른 장소를 집은 것으로 보고 버림(예: 성남 소재 을지대학교가
      // "양양"의 동명 건물로 잘못 지오코딩된 사례 — 148km)
      const expectedProvinces = ZN_NM_TO_PROVINCES[school.znNm];
      if (expectedProvinces) {
        let nearestInProvince: (typeof RAW_CITIES)[number] | null = null;
        let distToExpectedProvince = Infinity;
        for (const c of RAW_CITIES) {
          if (!expectedProvinces.includes(c.province)) continue;
          const d = haversineKm(p.lat, p.lon, c.lat, c.lon);
          if (d < distToExpectedProvince) {
            distToExpectedProvince = d;
            nearestInProvince = c;
          }
        }
        if (distToExpectedProvince > 50 || !nearestInProvince) {
          regionMismatchCount++;
          return null;
        }
        nearestCity = nearestInProvince;
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
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (regionMismatchCount > 0) {
    console.log(`지역 불일치로 제외 ${regionMismatchCount}곳 (동명의 다른 장소로 잘못 지오코딩됐을 가능성)`);
  }

  // 요청 실패(네트워크 오류 등)가 하나라도 있으면 이 스크립트는 매번 전체를 새로
  // 써서 기존 universities.json을 완전히 대체하므로 — 지금 실패한 대학이
  // 이전 실행에서는 성공했었더라도 이번 결과에서 통째로 사라짐. 그래서
  // 실패가 있으면 기존 파일을 건드리지 않고 재시도를 안내함
  if (requestFailures > 0) {
    console.error(
      `요청 실패가 ${requestFailures}건 있어 기존 ${OUT}를 덮어쓰지 않았습니다. 네트워크 상태를 확인하고 다시 실행하세요.`
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`${output.length}곳 저장함 -> ${OUT}`);
}

main();
