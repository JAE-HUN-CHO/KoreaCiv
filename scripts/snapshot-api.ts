/**
 * 정적 배포용 공공 API 스냅샷 수집기
 *
 * GitHub Pages에는 server.ts(API 프록시)가 없습니다. 그래서 빌드 직전에 이 스크립트가
 * server.ts를 잠깐 띄워 /api 응답을 받아 public/data/*.json으로 저장합니다.
 * 정적 빌드(VITE_STATIC_DEPLOY=true)는 이 파일만 읽습니다.
 *
 * - 키가 없거나 호출이 실패한 항목은 건너뜁니다. 실패해도 빌드는 계속됩니다.
 * - 저장 전에 응답 안에 API 키 문자열이 섞여 있지 않은지 검사합니다.
 *
 * 실행: npx tsx scripts/snapshot-api.ts
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve('public/data');

// server.ts가 받아들이는 키 변수 이름 전부 (별칭 포함)
const SECRET_ENV_NAMES = [
  'SGIS_CONSUMER_KEY', 'SGIS_SERVICE_ID', 'SGIS_API_KEY', 'SGIS_KEY',
  'SGIS_CONSUMER_SECRET', 'SGIS_SECURITY_KEY', 'SGIS_SECRET_KEY', 'SGIS_SECRET',
  'KOSIS_API_KEY', 'KOSIS_OPENAPI_KEY', 'KOSIS_KEY',
  'VWORLD_API_KEY', 'VWORLD_KEY', 'VWORLD_AUTH_KEY', 'VWORLD_OPENAPI_KEY',
  'VWORLD_REST_API_KEY', 'VWORLD_SECRET_KEY', 'V_WORLD_API_KEY', 'V_WORLD_KEY',
];

// 전체 수집 제한 시간. 워크플로 step 제한(10분)보다 짧게 잡아 느린 API가 배포를 막지 않게 함
const TOTAL_DEADLINE_MS = 7 * 60_000;
const PER_REQUEST_TIMEOUT_MS = 120_000;

const TARGETS: Array<{ file: string; url: string; needs: 'sgis' | 'kosis' | 'any' }> = [
  { file: 'live-bootstrap.json', url: '/api/live/bootstrap', needs: 'any' },
  ...(['2010', '2015', '2020', '2024'] as const).map((year) => ({
    file: `sgis-history-${year}.json`,
    url: `/api/sgis/history?year=${year}`,
    needs: 'sgis' as const,
  })),
  ...(['grdp_sido', 'grdp_pc_sido', 'pop_sido', 'aging_sido'] as const).map((ind) => ({
    file: `kosis-${ind}.json`,
    url: `/api/kosis/timeseries?indicator=${ind}&startYear=2018&endYear=2026`,
    needs: 'kosis' as const,
  })),
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 30_000): Promise<{ sgis: boolean; kosis: boolean }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/status`);
      if (r.ok) return (await r.json()) as { sgis: boolean; kosis: boolean };
    } catch {
      // 아직 기동 중
    }
    await sleep(500);
  }
  throw new Error('server.ts가 제한 시간 안에 응답하지 않았습니다.');
}

function containsSecret(text: string): string | null {
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (!value || value.length < 6) continue;
    // 원문과 URL 인코딩된 형태(예: '=' → '%3D') 모두 검사
    if (text.includes(value) || text.includes(encodeURIComponent(value))) return name;
  }
  return null;
}

/** 프로세스 그룹 전체(npx → tsx → node)를 종료하고 실제로 끝날 때까지 기다림 */
async function stopServer(server: ReturnType<typeof spawn>): Promise<void> {
  if (server.exitCode !== null || server.pid === undefined) return;
  const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()));
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    return; // 이미 종료됨
  }
  const timedOut = await Promise.race([exited.then(() => false), sleep(5_000).then(() => true)]);
  if (timedOut) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      // 이미 종료됨
    }
  }
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // detached: 새 프로세스 그룹으로 띄워 종료 시 자식(tsx, node)까지 한 번에 끝냄
  const server = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: true,
  });
  const deadline = Date.now() + TOTAL_DEADLINE_MS;

  const written: string[] = [];
  try {
    const status = await waitForServer();
    console.log(`API 키 상태: SGIS=${status.sgis} KOSIS=${status.kosis}`);

    for (const t of TARGETS) {
      const available =
        t.needs === 'any' ? status.sgis || status.kosis : status[t.needs];
      if (!available) {
        console.log(`- 건너뜀 (키 없음): ${t.file}`);
        continue;
      }
      // 공공 API가 가끔 일시적으로 실패하므로 항목당 1회 재시도
      for (let attempt = 1; attempt <= 2; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < 5_000) {
          console.log(`- 건너뜀 (전체 제한 시간 초과): ${t.file}`);
          break;
        }
        const retryNote = attempt < 2 ? ', 재시도' : '';
        try {
          const r = await fetch(`${BASE}${t.url}`, {
            signal: AbortSignal.timeout(Math.min(PER_REQUEST_TIMEOUT_MS, remaining)),
          });
          const body = await r.text();
          if (!r.ok) {
            console.log(`- 실패 (HTTP ${r.status}${retryNote}): ${t.file}`);
            continue;
          }
          JSON.parse(body); // 유효한 JSON인지 확인
          const leaked = containsSecret(body);
          if (leaked) {
            // 키 값 자체는 출력하지 않음. 재시도해도 같으므로 바로 다음 항목으로
            console.error(`- 중단: ${t.file} 응답에 ${leaked} 값이 포함되어 저장하지 않습니다.`);
            break;
          }
          fs.writeFileSync(path.join(OUT_DIR, t.file), body);
          written.push(t.file);
          console.log(`- 저장: ${t.file} (${(body.length / 1024).toFixed(1)} KB)`);
          break;
        } catch (err) {
          console.log(`- 실패 (${err instanceof Error ? err.name : 'error'}${retryNote}): ${t.file}`);
        }
      }
    }
  } finally {
    await stopServer(server);
  }

  if (written.length === 0) {
    // 스냅샷이 하나도 없으면 manifest도 만들지 않음 → 앱은 내장 데이터로 동작
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    console.log('저장된 스냅샷이 없습니다. 앱은 내장 데이터로 동작합니다.');
    return;
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), files: written }, null, 2)
  );
  console.log(`스냅샷 ${written.length}개 저장 완료`);
}

main().catch((err) => {
  console.error('스냅샷 수집 실패:', err instanceof Error ? err.message : 'Unknown error');
  // 스냅샷 실패가 배포를 막지 않도록 0으로 종료
  process.exit(0);
});
