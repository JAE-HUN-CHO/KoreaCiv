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
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve('public/data');

const SECRET_ENV_NAMES = [
  'SGIS_CONSUMER_KEY',
  'SGIS_CONSUMER_SECRET',
  'KOSIS_API_KEY',
  'VWORLD_API_KEY',
];

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
    if (value && value.length >= 6 && text.includes(value)) return name;
  }
  return null;
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

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
      try {
        const r = await fetch(`${BASE}${t.url}`, { signal: AbortSignal.timeout(120_000) });
        const body = await r.text();
        if (!r.ok) {
          console.log(`- 실패 (HTTP ${r.status}): ${t.file}`);
          continue;
        }
        JSON.parse(body); // 유효한 JSON인지 확인
        const leaked = containsSecret(body);
        if (leaked) {
          // 키 값 자체는 출력하지 않음
          console.error(`- 중단: ${t.file} 응답에 ${leaked} 값이 포함되어 저장하지 않습니다.`);
          continue;
        }
        fs.writeFileSync(path.join(OUT_DIR, t.file), body);
        written.push(t.file);
        console.log(`- 저장: ${t.file} (${(body.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.log(`- 실패: ${t.file} (${err instanceof Error ? err.name : 'error'})`);
      }
    }
  } finally {
    server.kill('SIGTERM');
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
