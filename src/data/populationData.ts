import hexPopulation from './generated/hexPopulation.json';

/**
 * 칸별 격자 인구 (pipeline/population.py가 생성)
 * - 원자료: WorldPop 2020 Constrained, UN 보정 (100m). SGIS 격자 인구 대체
 * - 앱은 이 값을 시·군 안의 칸별 인구 비중으로만 씀. 합계는 KOSIS 시·군 인구에 맞춤
 */
interface HexPopulationFile {
  generatedAt: string;
  source: string;
  unit: string;
  cells: Record<string, number>;
}

const data = hexPopulation as unknown as HexPopulationFile;

export const HEX_POPULATION_META = {
  generatedAt: data.generatedAt,
  source: data.source,
  cellCount: Object.keys(data.cells).length,
};

/** 칸 ID("q,r")의 격자 인구. 사람이 사는 화소가 없는 칸은 0 */
export function lookupHexGridPopulation(id: string): number {
  return data.cells[id] ?? 0;
}
