import type { ReliefType, TerrainType } from '../types/civ';
import { CIV_RULES } from './rules';
import hexTerrain from './generated/hexTerrain.json';

/**
 * 칸별 지형 원자료 집계 결과 (pipeline/terrain.py가 생성)
 * - 표고·기복: Copernicus DEM GLO-90
 * - 토지피복: ESA WorldCover 2021 v200 (칸 안 최다 유형)
 */
export interface HexTerrainRecord {
  elevationM: number;
  reliefM: number;
  /** 토지피복 최다 유형. 표본이 없는 칸은 null (앱이 추정 규칙으로 판정) */
  terrain: TerrainType | null;
}

interface HexTerrainFile {
  generatedAt: string;
  sources: string[];
  /** cells 값 배열의 순서. pipeline/terrain.py와 맞아야 함 */
  fields: ['elevMeanM', 'reliefM', 'terrainIndex'];
  /** terrainIndex → 지형 유형. TerrainType 값과 이름이 같아야 함 */
  terrains: TerrainType[];
  cells: Record<string, [number, number, number]>;
}

export const EXPECTED_TERRAIN_FIELDS = ['elevMeanM', 'reliefM', 'terrainIndex'] as const;
export const TERRAIN_TYPES = [
  'urban',
  'farmland',
  'forest',
  'grassland',
  'marsh',
  'barren',
  'water',
] as const satisfies readonly TerrainType[];

// TerrainType에 새 값을 넣고 위 목록에 빠뜨리면 여기서 컴파일 오류가 남
type MissingTerrain = Exclude<TerrainType, (typeof TERRAIN_TYPES)[number]>;
const terrainListIsComplete: [MissingTerrain] extends [never] ? true : never = true;
void terrainListIsComplete;

const data = hexTerrain as unknown as HexTerrainFile;

/**
 * 생성 파일의 구조가 앱이 읽는 방식과 맞는지 확인. 어긋나면 지형이 조용히 틀어지므로 바로 멈춤
 * (예: 파이프라인에서 필드 순서나 지형 이름을 바꾸고 앱은 그대로 둔 경우)
 */
export function validateHexTerrainFile(file: {
  fields?: unknown;
  terrains?: unknown;
  cells?: unknown;
}): string[] {
  const errors: string[] = [];
  if (JSON.stringify(file.fields) !== JSON.stringify(EXPECTED_TERRAIN_FIELDS)) {
    errors.push(`fields 순서가 다름: ${JSON.stringify(file.fields)}`);
  }
  const terrains = Array.isArray(file.terrains) ? file.terrains : [];
  for (const t of terrains) {
    if (!(TERRAIN_TYPES as readonly string[]).includes(String(t))) errors.push(`알 수 없는 지형 이름: ${String(t)}`);
  }
  if (typeof file.cells !== 'object' || file.cells === null) {
    errors.push('cells 없음');
  } else {
    for (const [id, v] of Object.entries(file.cells as Record<string, unknown>)) {
      const ok =
        /^-?\d+,-?\d+$/.test(id) &&
        Array.isArray(v) &&
        v.length === 3 &&
        v.every((n) => Number.isInteger(n)) &&
        (v[2] as number) >= -1 &&
        (v[2] as number) < terrains.length;
      if (!ok) {
        errors.push(`잘못된 칸 ${id}: ${JSON.stringify(v)}`);
        break;
      }
    }
  }
  return errors;
}

const structureErrors = validateHexTerrainFile(data);
if (structureErrors.length > 0) {
  throw new Error(`hexTerrain.json 구조 오류: ${structureErrors.join('; ')}`);
}

export const HEX_TERRAIN_META = {
  generatedAt: data.generatedAt,
  sources: data.sources,
  cellCount: Object.keys(data.cells).length,
};

/** 칸 ID("q,r")의 원자료 지형. 집계 결과가 없는 칸(육지 화소 없음)은 null */
export function lookupHexTerrain(id: string): HexTerrainRecord | null {
  const cell = data.cells[id];
  if (!cell) return null;
  const terrain = cell[2] >= 0 ? (data.terrains[cell[2]] ?? null) : null;
  return { elevationM: cell[0], reliefM: cell[1], terrain };
}

/** PLAN.md 4절 규칙: 칸 내 기복 300m 이상 Hills, 600m 이상 Mountain */
export function classifyReliefByRule(reliefM: number): ReliefType {
  if (reliefM >= CIV_RULES.relief.mountainThresholdM) return 'mountain';
  if (reliefM >= CIV_RULES.relief.hillsThresholdM) return 'hills';
  return 'flat';
}
