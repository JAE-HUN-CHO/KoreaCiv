import type { CityComputed, HexTile, LensId } from '../types/civ';
import { TERRAIN_META } from '../data/rules';
import {
  computeCityPopChangePct,
  type HistoryRenderContext,
} from '../engine/history';

export function formatPopulation(pop: number): string {
  if (pop >= 10000) {
    const man = pop / 10000;
    return `${man >= 100 ? Math.round(man).toLocaleString('ko-KR') : man.toFixed(1)}만명`;
  }
  return `${Math.round(pop).toLocaleString('ko-KR')}명`;
}

export function formatGrdp100M(grdp100M: number): string {
  if (grdp100M >= 10000) {
    return `${(grdp100M / 10000).toFixed(1)}조원`;
  }
  return `${Math.round(grdp100M).toLocaleString('ko-KR')}억원`;
}

export function formatManwon(manwon: number): string {
  return `${Math.round(manwon).toLocaleString('ko-KR')}만원`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b))
      .toString(16)
      .slice(1)
  );
}

function sampleRamp(t: number, stops: string[]): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  const localT = scaled - idx;
  const [r1, g1, b1] = hexToRgb(stops[idx]);
  const [r2, g2, b2] = hexToRgb(stops[idx + 1]);
  return rgbToHex(
    r1 + (r2 - r1) * localT,
    g1 + (g2 - g1) * localT,
    b1 + (b2 - b1) * localT
  );
}

const RAMPS: Record<Exclude<LensId, 'terrain'>, string[]> = {
  grdp: ['#172434', '#4A4728', '#8F7B2E', '#D4A84B', '#FFF0A8'],
  grdp_per_capita: ['#1C2E42', '#2E6278', '#4B997C', '#C7B046', '#F2DC79'],
  population_density: ['#152334', '#244A6E', '#397CA8', '#E09A48', '#F75B43'],
  manufacturing_share: ['#192432', '#4C3629', '#8C4C27', '#D4732A', '#FFB057'],
  income: ['#182433', '#274C5E', '#3C7F6B', '#A5A847', '#F5DA6E'],
  education: ['#162233', '#243C66', '#39619E', '#6193D9', '#B3DCFF'],
  faith: ['#192234', '#3B2F5E', '#69448C', '#A366BA', '#E3B0F5'],
  culture: ['#171E30', '#382452', '#733178', '#C44D9C', '#FFAE82'],
  health: ['#3B2938', '#5D4858', '#3A6F7D', '#45A38C', '#9BE8B8'],
  housing: ['#182433', '#2F4663', '#6E5A82', '#C46C7C', '#FFA396'],
  freight_logistics: ['#162333', '#1F465E', '#29778F', '#48B3C7', '#9EF0FF'],
  aging_rate: ['#205561', '#3B8272', '#B8A64C', '#CF6C3E', '#B83333'],
  science_ict: ['#152233', '#1D416B', '#286AA8', '#46A4E6', '#A6E1FF'],
  finance_share: ['#172332', '#3F4630', '#7D7632', '#C9A93E', '#FCE074'],
  agriculture_food: ['#182530', '#2B4D3A', '#457D49', '#7BB559', '#C2E378'],
  power_capacity: ['#16212E', '#323E59', '#614F8A', '#AD5C9E', '#F5B547'],
  university_rd: ['#15202E', '#203E5E', '#2D669C', '#4E9DE0', '#A3E4FF'],
  disaster_damage: ['#192533', '#4F3438', '#8F3E3A', '#D14B36', '#FF8A5B'],
  history: ['#B5383E', '#C97B59', '#2F4358', '#398A7A', '#6CD49A'],
};

/**
 * 현재 활성 렌즈에 따른 육각 타일 채우기 색상 반환
 */
export function getHexFillColor(
  tile: HexTile,
  city: CityComputed | undefined,
  lens: LensId,
  historyCtx?: HistoryRenderContext | null
): string {
  if (lens === 'terrain') {
    const meta = TERRAIN_META[tile.terrain];
    if (tile.relief === 'mountain') return meta.mountainFill;
    if (tile.relief === 'hills') return meta.hillFill;
    return meta.fill;
  }

  if (!city) return '#1B2838';

  switch (lens) {
    case 'grdp': {
      // 로그 스케일 (50억 ~ 120,000억)
      const logV = Math.log10(Math.max(10, tile.grdp100M));
      const t = (logV - 1.5) / 3.4;
      return sampleRamp(t, RAMPS.grdp);
    }
    case 'grdp_per_capita': {
      const t = (city.grdpPerCapitaManwon - 2400) / 7200;
      return sampleRamp(t, RAMPS.grdp_per_capita);
    }
    case 'population_density': {
      const logV = Math.log10(Math.max(10, tile.populationDensity));
      const t = (logV - 1.2) / 3.0;
      return sampleRamp(t, RAMPS.population_density);
    }
    case 'manufacturing_share': {
      const t = (city.shares.manufacturing - 6) / 44;
      return sampleRamp(t, RAMPS.manufacturing_share);
    }
    case 'income': {
      const t = (city.avgIncomeManwon - 3100) / 3000;
      return sampleRamp(t, RAMPS.income);
    }
    case 'education': {
      const t = (city.collegeDegreePct - 24) / 42;
      return sampleRamp(t, RAMPS.education);
    }
    case 'faith': {
      const t = (city.faithRatePct - 35) / 21;
      return sampleRamp(t, RAMPS.faith);
    }
    case 'culture': {
      const t = Math.pow(Math.max(0, Math.min(1, tile.cultureDensity / 100)), 0.88);
      return sampleRamp(t, RAMPS.culture);
    }
    case 'health': {
      const t = (city.lifeExpectancy - 81.0) / 4.5;
      return sampleRamp(t, RAMPS.health);
    }
    case 'housing': {
      const logV = Math.log10(Math.max(450, city.housingPriceManwon));
      const t = (logV - 2.68) / 1.02;
      return sampleRamp(t, RAMPS.housing);
    }
    case 'freight_logistics': {
      const logV = Math.log10(Math.max(1.2, city.freightVolumeMt));
      const t = (logV - 0.15) / 2.25;
      return sampleRamp(t, RAMPS.freight_logistics);
    }
    case 'aging_rate': {
      const t = (city.agingRate - 12) / 33;
      return sampleRamp(t, RAMPS.aging_rate);
    }
    case 'science_ict': {
      const t = (city.shares.ictScience - 2) / 22;
      return sampleRamp(t, RAMPS.science_ict);
    }
    case 'finance_share': {
      const t = (city.shares.finance - 1.4) / 5.4;
      return sampleRamp(t, RAMPS.finance_share);
    }
    case 'agriculture_food': {
      const t = (city.shares.agriculture - 1) / 42;
      return sampleRamp(t, RAMPS.agriculture_food);
    }
    case 'power_capacity': {
      const logV = Math.log10(Math.max(10, city.powerCapacityMw));
      const t = (logV - 1.5) / 2.55;
      return sampleRamp(t, RAMPS.power_capacity);
    }
    case 'university_rd': {
      if (city.universityRd100M <= 0) return RAMPS.university_rd[0];
      const logV = Math.log10(Math.max(10, city.universityRd100M));
      const t = (logV - 1.3) / 3.1;
      return sampleRamp(t, RAMPS.university_rd);
    }
    case 'disaster_damage': {
      const logV = Math.log10(Math.max(50, city.disasterDamage100M));
      const t = (logV - 2.0) / 1.65;
      return sampleRamp(t, RAMPS.disaster_damage);
    }
    case 'history': {
      if (!historyCtx) return '#1B2838';
      if (historyCtx.mode === 'boundaries') {
        return tile.relief === 'mountain'
          ? '#203040'
          : tile.relief === 'hills'
            ? '#1A2A39'
            : '#162433';
      }
      if (historyCtx.mode === 'density') {
        const histStat = historyCtx.activeSnapshot.cityStats.get(city.id);
        const ratio =
          histStat && city.population > 0 ? histStat.population / city.population : 1;
        const histTileDensity = Math.max(10, tile.populationDensity * ratio);
        const logV = Math.log10(histTileDensity);
        const t = (logV - 1.2) / 3.0;
        return sampleRamp(t, RAMPS.population_density);
      }
      const delta = computeCityPopChangePct(
        city.id,
        historyCtx.baseSnapshot,
        historyCtx.targetSnapshot
      );
      if (!delta) return '#27384B';
      const t =
        delta.pct < 0
          ? 0.5 + Math.max(-0.5, (delta.pct / 30) * 0.5)
          : 0.5 + Math.min(0.5, (delta.pct / 38) * 0.5);
      return sampleRamp(t, RAMPS.history);
    }
  }
}

export function getLensTileMetricText(
  tile: HexTile,
  city: CityComputed | undefined,
  lens: LensId,
  historyCtx?: HistoryRenderContext | null
): { label: string; value: string } {
  if (!city) return { label: '표고', value: `${tile.elevationM}m` };
  switch (lens) {
    case 'terrain':
      return { label: '표고 / 기복', value: `${tile.elevationM}m / Δ${tile.reliefM}m` };
    case 'grdp':
      return { label: '타일 GRDP', value: formatGrdp100M(tile.grdp100M) };
    case 'grdp_per_capita':
      return { label: '시군구 1인당 GRDP', value: formatManwon(city.grdpPerCapitaManwon) };
    case 'population_density':
      return {
        label: '타일 인구밀도',
        value: `${tile.populationDensity.toLocaleString('ko-KR')}명/km²`,
      };
    case 'manufacturing_share':
      return { label: '제조업 비중', value: `${city.shares.manufacturing.toFixed(1)}%` };
    case 'income':
      return { label: '평균 근로소득', value: `${formatManwon(city.avgIncomeManwon)}/년` };
    case 'education':
      return { label: '대졸 이상 학위 비중', value: `${city.collegeDegreePct.toFixed(1)}%` };
    case 'faith':
      return { label: '종교인구 · 신앙 비중', value: `${city.faithRatePct.toFixed(1)}%` };
    case 'culture':
      return {
        label: '문화유산 밀도 지수',
        value:
          tile.nearbyCulturalCount > 0
            ? `${tile.cultureDensity}점 · 반경 25km ${tile.nearbyCulturalCount}곳`
            : `${tile.cultureDensity}점`,
      };
    case 'health':
      return { label: '출생 시 기대수명', value: `${city.lifeExpectancy.toFixed(1)}세` };
    case 'housing':
      return { label: '3.3m²당 평균 주택가', value: formatManwon(city.housingPriceManwon) };
    case 'freight_logistics':
      return {
        label: '연간 화물 물동량',
        value: `${city.freightVolumeMt.toLocaleString('ko-KR')} 백만톤`,
      };
    case 'aging_rate':
      return { label: '고령 인구 비율', value: `${city.agingRate.toFixed(1)}%` };
    case 'science_ict':
      return { label: 'IT·과학기술 비중', value: `${city.shares.ictScience.toFixed(1)}%` };
    case 'finance_share':
      return { label: '금융·보험 비중', value: `${city.shares.finance.toFixed(1)}%` };
    case 'agriculture_food':
      return { label: '농림어업 비중', value: `${city.shares.agriculture.toFixed(1)}%` };
    case 'power_capacity':
      return {
        label: '시군구 발전설비',
        value: `${city.powerCapacityMw.toLocaleString('ko-KR')} MW`,
      };
    case 'university_rd':
      return {
        label: '시군구 대학 연구비',
        value: `${city.universityRd100M.toLocaleString('ko-KR')}억원`,
      };
    case 'disaster_damage':
      return {
        label: '10년 누적 재해피해',
        value: `${city.disasterDamage100M.toLocaleString('ko-KR')}억원`,
      };
    case 'history': {
      if (!historyCtx) {
        return { label: '역사 센서스', value: '데이터 준비 중' };
      }
      if (historyCtx.mode === 'density') {
        const histStat = historyCtx.activeSnapshot.cityStats.get(city.id);
        const ratio =
          histStat && city.population > 0 ? histStat.population / city.population : 1;
        const histDens = Math.round(tile.populationDensity * ratio);
        return {
          label: `${historyCtx.activeYear}년 타일 밀도`,
          value: `${histDens.toLocaleString('ko-KR')}명/km²`,
        };
      }
      const delta = computeCityPopChangePct(
        city.id,
        historyCtx.baseSnapshot,
        historyCtx.targetSnapshot
      );
      if (historyCtx.mode === 'boundaries') {
        const histStat = historyCtx.activeSnapshot.cityStats.get(city.id);
        return {
          label: `${historyCtx.activeYear}년 시군구 인구`,
          value: histStat ? formatPopulation(histStat.population) : '—',
        };
      }
      if (!delta) return { label: '인구 증감', value: '—' };
      const sign = delta.pct >= 0 ? '+' : '';
      return {
        label: `${historyCtx.baseYear}→${historyCtx.targetYear} 인구 증감`,
        value: `${sign}${delta.pct.toFixed(1)}%`,
      };
    }
  }
}
