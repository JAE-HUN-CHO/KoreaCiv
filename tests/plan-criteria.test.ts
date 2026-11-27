/**
 * PLAN.md 7절 단계별 완료 기준을 자동 테스트로 확인합니다.
 * 실행: npm test
 *
 * public/data/live-bootstrap.json(공공 API 스냅샷)이 있으면 실데이터 반영 결과도 함께 검사합니다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { getKoreaCivWorld, rebuildWorldWithLiveApiData } from '../src/engine/hexGrid';
import { CIV_RULES } from '../src/data/rules';
import { lookupHexGridPopulation } from '../src/data/populationData';
import { lookupHexTerrain, validateHexTerrainFile } from '../src/data/terrainData';
import type { KoreaCivWorld } from '../src/engine/hexGrid';
import type { LiveBootstrapResponse } from '../src/services/publicApis';

const SNAPSHOT = 'public/data/live-bootstrap.json';

// SGIS 경계가 부족할 때(120개 미만) 내장 격자를 다시 쓰는 경로. 경계 없는 최소 응답으로 재현
const BOOTSTRAP_WITHOUT_BOUNDARIES: LiveBootstrapResponse = {
  fetchedAt: '2026-01-01T00:00:00Z',
  sgisYear: null,
  kosisPopYear: null,
  kosisAgingYear: null,
  kosisGrdpYear: null,
  provinceBoundaries: [],
  sigunguBoundaries: [],
  sgisStats: [],
  kosisLatest: { grdpBySido: [], grdpPcBySido: [], popRows: [], agingRows: [] },
};

const worlds: Array<[string, () => KoreaCivWorld]> = [
  ['내장 데이터', getKoreaCivWorld],
  ['경계 없는 실시간 응답', () => rebuildWorldWithLiveApiData(BOOTSTRAP_WITHOUT_BOUNDARIES)],
];
if (fs.existsSync(SNAPSHOT)) {
  worlds.push([
    'API 스냅샷',
    () =>
      rebuildWorldWithLiveApiData(
        JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as LiveBootstrapResponse
      ),
  ]);
}

function relDiff(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b);
}

for (const [label, build] of worlds) {
  describe(`[${label}]`, () => {
    const world = build();

    describe('M1 격자와 지형', () => {
      it('육지 칸 수가 4,000~5,000개', () => {
        const n = world.hexes.length;
        assert.ok(n >= 4000 && n <= 5000, `육지 칸 수 ${n}`);
      });

      it('칸 ID가 (q, r)로 고정되고 중복이 없음', () => {
        const ids = new Set<string>();
        for (const h of world.hexes) {
          assert.equal(h.id, `${h.q},${h.r}`);
          assert.ok(!ids.has(h.id), `중복 ID ${h.id}`);
          ids.add(h.id);
        }
        const again = build();
        assert.deepEqual(
          again.hexes.map((h) => h.id),
          world.hexes.map((h) => h.id),
          '빌드마다 칸 ID가 달라짐'
        );
      });

      it(`육지 비율 ${CIV_RULES.grid.minLandFraction * 100}% 이상인 칸만 그림`, () => {
        const bad = world.hexes.filter((h) => h.landFraction < CIV_RULES.grid.minLandFraction);
        assert.equal(bad.length, 0, `기준 미달 칸 ${bad.length}개`);
      });

      it('구릉·산악은 기복 기준(300m / 600m)을 따름', () => {
        const { hillsThresholdM, mountainThresholdM } = CIV_RULES.relief;
        for (const h of world.hexes) {
          const expected =
            h.reliefM >= mountainThresholdM ? 'mountain' : h.reliefM >= hillsThresholdM ? 'hills' : 'flat';
          assert.equal(h.relief, expected, `${h.id}: 기복 ${h.reliefM}m → ${h.relief}`);
        }
      });
    });

    describe('M1 원자료 반영', () => {
      it('칸의 99% 이상이 DEM·토지피복 집계값을 씀', () => {
        const missing = world.hexes.filter((h) => !lookupHexTerrain(h.id));
        const ratio = 1 - missing.length / world.hexes.length;
        assert.ok(ratio >= 0.99, `집계값 없는 칸 ${missing.length}개 (${(ratio * 100).toFixed(1)}%)`);
      });

      it('칸의 표고·기복이 집계값과 같음', () => {
        for (const h of world.hexes) {
          const real = lookupHexTerrain(h.id);
          if (!real) continue;
          assert.equal(h.elevationM, real.elevationM, `${h.id} 표고`);
          assert.equal(h.reliefM, real.reliefM, `${h.id} 기복`);
        }
      });

      it('결과 칸에 내부 판정 필드가 남지 않음', () => {
        assert.ok(world.hexes.every((h) => !('landCoverTerrain' in h)));
      });

      it('토지피복 칸은 집계된 최다 유형을 그대로 씀', () => {
        for (const h of world.hexes) {
          const real = lookupHexTerrain(h.id);
          if (real?.terrain) assert.equal(h.terrain, real.terrain, h.id);
        }
      });
    });

    describe('M2 통계 배분', () => {
      for (const field of ['population', 'grdp100M'] as const) {
        it(`칸 합계와 시·군 원값의 차이 0.1% 이내 (${field})`, () => {
          const sums = new Map<string, number>();
          for (const h of world.hexes) sums.set(h.cityId, (sums.get(h.cityId) ?? 0) + h[field]);
          const cityField = field === 'population' ? 'population' : 'grdpBillionKrw';
          const failures: string[] = [];
          for (const city of world.cities) {
            const original = (city as unknown as Record<string, number>)[cityField];
            const allocated = sums.get(city.id) ?? 0;
            if (typeof original !== 'number' || original === 0) continue;
            if (relDiff(allocated, original) > 0.001) {
              failures.push(`${city.name} ${allocated.toFixed(0)} / ${original.toFixed(0)}`);
            }
          }
          assert.equal(failures.length, 0, `0.1% 초과 ${failures.length}곳: ${failures.slice(0, 5).join(', ')}`);
        });
      }
    });

    describe('M2 격자 인구 반영', () => {
      it('시·군의 95% 이상이 격자 인구 비중으로 칸을 나눔', () => {
        const n = world.stats.gridPopulationCities;
        const total = world.cities.filter((c) => c.hexCount > 0).length;
        assert.ok(n / total >= 0.95, `격자 인구 사용 ${n}/${total}`);
      });

      it('인구 100만 이상 시·군은 칸 3개 이상 (경계 누락 감지. 수원 121km²가 약 5칸)', () => {
        const small = world.cities.filter((c) => c.population >= 1_000_000 && c.hexCount < 3);
        assert.equal(small.length, 0, small.map((c) => `${c.name} ${c.hexCount}칸`).join(', '));
      });

      it('칸 인구 비중이 격자 인구 비중과 같음', () => {
        const byCity = new Map<string, typeof world.hexes>();
        for (const h of world.hexes) {
          const list = byCity.get(h.cityId) ?? [];
          list.push(h);
          byCity.set(h.cityId, list);
        }
        const failures: string[] = [];
        for (const [cityId, list] of byCity) {
          const grid = list.map((h) => lookupHexGridPopulation(h.id));
          const gridSum = grid.reduce((a, b) => a + b, 0);
          const popSum = list.reduce((a, h) => a + h.population, 0);
          if (gridSum === 0 || popSum < 10_000) continue;
          list.forEach((h, i) => {
            const expected = (grid[i] / gridSum) * popSum;
            // 칸 인구는 정수로 반올림되므로 1명 + 0.5% 여유
            if (Math.abs(h.population - expected) > 1 + expected * 0.005) {
              failures.push(`${cityId} ${h.id}: ${h.population} / 기대 ${expected.toFixed(0)}`);
            }
          });
        }
        assert.equal(failures.length, 0, failures.slice(0, 5).join(', '));
      });
    });

    describe('M3 도시와 지구', () => {
      it('울산에 Industrial Zone이 나옴', () => {
        const ulsan = world.cityMap.get('ulsan');
        assert.ok(ulsan, '울산 도시 없음');
        assert.ok(
          ulsan.districts.some((d) => d.type === 'industrial_zone'),
          `울산 지구: ${ulsan.districts.map((d) => d.type).join(', ')}`
        );
      });

      it('지구는 입지계수 1.5 이상, 종사자 5,000명 이상, 도시당 최대 3개', () => {
        const { minLocationQuotient, minWorkers, maxDistrictsPerCity } = CIV_RULES.district;
        for (const c of world.cities) {
          assert.ok(c.districts.length <= maxDistrictsPerCity, `${c.name} 지구 ${c.districts.length}개`);
          for (const d of c.districts) {
            assert.ok(d.lq >= minLocationQuotient, `${c.name} ${d.type} LQ ${d.lq}`);
            assert.ok(d.workers >= minWorkers, `${c.name} ${d.type} 종사자 ${d.workers}`);
          }
        }
      });
    });

    describe('M4 점 데이터와 Wonder', () => {
      it(`발전소는 설비용량 ${CIV_RULES.facilities.powerPlantMinMw}MW 이상만 표시`, () => {
        const small = world.facilities.filter(
          (f) => f.type === 'power_plant' && f.metricValue < CIV_RULES.facilities.powerPlantMinMw
        );
        assert.equal(small.length, 0, small.map((f) => f.name).join(', '));
      });

      it('Wonder는 종류별 상위 5곳', () => {
        for (const kind of ['natural', 'academic'] as const) {
          const n = world.wonders.filter((w) => w.wonderKind === kind).length;
          assert.equal(n, CIV_RULES.wonders[`${kind}TopN`], `${kind} Wonder ${n}곳`);
        }
      });

      it('모든 시설이 존재하는 도시를 참조함', () => {
        const cityIds = new Set(world.cities.map((c) => c.id));
        const orphan = world.facilities.filter((f) => !cityIds.has(f.cityId));
        assert.equal(orphan.length, 0, orphan.map((f) => f.name).join(', '));
      });
    });
  });
}

describe('지형 데이터 파일 구조', () => {
  const file = JSON.parse(fs.readFileSync('src/data/generated/hexTerrain.json', 'utf8'));

  it('생성 파일이 앱이 읽는 구조와 맞음', () => {
    assert.deepEqual(validateHexTerrainFile(file), []);
  });

  it('파이프라인의 지형 목록과 생성 파일의 지형 목록이 같음', () => {
    const py = fs.readFileSync('pipeline/terrain.py', 'utf8');
    const m = py.match(/^TERRAINS = \[(.*?)\]/m);
    assert.ok(m, 'pipeline/terrain.py에서 TERRAINS를 찾지 못함');
    const pyTerrains = [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]);
    assert.deepEqual(file.terrains, pyTerrains);
  });

  it('구조가 어긋나면 오류를 냄', () => {
    const swapped = { ...file, fields: ['reliefM', 'elevMeanM', 'terrainIndex'] };
    assert.ok(validateHexTerrainFile(swapped).length > 0, '필드 순서 바뀜을 못 잡음');
    const unknown = { ...file, terrains: [...file.terrains, 'lava'] };
    assert.ok(validateHexTerrainFile(unknown).length > 0, '알 수 없는 지형을 못 잡음');
    const badIndex = { ...file, cells: { '0,0': [10, 20, 99] } };
    assert.ok(validateHexTerrainFile(badIndex).length > 0, '범위 밖 지형 번호를 못 잡음');
  });
});

describe('경계 응답 충분성 판정', { skip: !fs.existsSync(SNAPSHOT) && '스냅샷 없음' }, () => {
  it('시도 경계로 대신 채운 링은 충분성(120개) 판정에 세지 않음', () => {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as LiveBootstrapResponse;
    // 부산 시군구 경계를 빼고, 남은 시군구 링이 119개가 되도록 자름
    const sigungu = snap.sigunguBoundaries.filter((f) => f.sidoCd !== '21');
    const trimmed: typeof sigungu = [];
    let rings = 0;
    for (const f of sigungu) {
      const n = f.rings.filter((r) => r.length >= 3).length;
      if (rings + n > 119) continue;
      trimmed.push(f);
      rings += n;
    }
    assert.equal(rings, 119, `링 ${rings}개로 맞추지 못함`);
    const world = rebuildWorldWithLiveApiData({ ...snap, sigunguBoundaries: trimmed });
    // 부족한 응답이면 내장 격자를 그대로 씀
    assert.deepEqual(
      world.hexes.map((h) => h.id),
      getKoreaCivWorld().hexes.map((h) => h.id)
    );
  });
});
