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
  terrain: TerrainType;
}

interface HexTerrainFile {
  generatedAt: string;
  sources: string[];
  terrains: TerrainType[];
  cells: Record<string, [number, number, number]>;
}

const data = hexTerrain as unknown as HexTerrainFile;

export const HEX_TERRAIN_META = {
  generatedAt: data.generatedAt,
  sources: data.sources,
  cellCount: Object.keys(data.cells).length,
};

/** 칸 ID("q,r")의 원자료 지형. 집계 결과가 없는 칸(육지 화소 없음)은 null */
export function lookupHexTerrain(id: string): HexTerrainRecord | null {
  const cell = data.cells[id];
  if (!cell) return null;
  const terrain = data.terrains[cell[2]];
  if (!terrain) return null;
  return { elevationM: cell[0], reliefM: cell[1], terrain };
}

/** PLAN.md 4절 규칙: 칸 내 기복 300m 이상 Hills, 600m 이상 Mountain */
export function classifyReliefByRule(reliefM: number): ReliefType {
  if (reliefM >= CIV_RULES.relief.mountainThresholdM) return 'mountain';
  if (reliefM >= CIV_RULES.relief.hillsThresholdM) return 'hills';
  return 'flat';
}
