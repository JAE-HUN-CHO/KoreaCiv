import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Compass, Crosshair, Search, X } from 'lucide-react';
import type { CityComputed, FacilityPoint } from '../types/civ';
import { DISTRICT_META, INDUSTRY_META, PROVINCE_META } from '../data/rules';
import {
  formatGrdp100M,
  formatManwon,
  formatPopulation,
} from '../utils/formatters';
import {
  computeCityPopChangePct,
  type HistoryRenderContext,
} from '../engine/history';
import { PolicyCardBanner } from './PolicyCardBanner';

interface CityCompareSplitViewProps {
  cityA: CityComputed;
  cityB: CityComputed | null;
  allCities: CityComputed[];
  facilitiesA: FacilityPoint[];
  facilitiesB: FacilityPoint[];
  pickingFromMap: boolean;
  historyCtx?: HistoryRenderContext | null;
  onTogglePickFromMap: () => void;
  onSelectCityB: (cityId: string | null) => void;
  onSwapCities: () => void;
  onFocusCity: (city: CityComputed) => void;
}

interface MetricRowDef {
  id: string;
  label: string;
  valA: number;
  valB: number;
  fmtA: string;
  fmtB: string;
  deltaText: string;
  higherIsNeutral?: boolean;
}

function formatRatioOrDiff(a: number, b: number, unit: string, isPctPoint = false): string {
  const diff = a - b;
  if (Math.abs(diff) < 0.05) return '동일';
  const sign = diff > 0 ? '+' : '';
  if (isPctPoint) {
    return `${sign}${diff.toFixed(1)}%p`;
  }
  if (unit === '명' && Math.abs(diff) >= 10000) {
    return `${sign}${(diff / 10000).toFixed(1)}만명`;
  }
  if (unit === '억원' && Math.abs(diff) >= 10000) {
    return `${sign}${(diff / 10000).toFixed(1)}조원`;
  }
  return `${sign}${Math.round(diff).toLocaleString('ko-KR')}${unit}`;
}

export const CityCompareSplitView: React.FC<CityCompareSplitViewProps> = ({
  cityA,
  cityB,
  allCities,
  facilitiesA,
  facilitiesB,
  pickingFromMap,
  historyCtx = null,
  onTogglePickFromMap,
  onSelectCityB,
  onSwapCities,
  onFocusCity,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(!cityB);

  // 추천 비교 대상 (유사 규모 또는 주요 비교 도시)
  const suggestedCities = useMemo(() => {
    const others = allCities.filter((c) => c.id !== cityA.id);
    const byClosestPop = others
      .slice()
      .sort(
        (a, b) =>
          Math.abs(a.population - cityA.population) -
          Math.abs(b.population - cityA.population)
      )
      .slice(0, 6);
    const majorIds = ['seoul', 'busan', 'incheon', 'suwon', 'hwaseong', 'sejong', 'daejeon', 'daegu'];
    const result: CityComputed[] = [];
    const seen = new Set<string>();
    for (const c of byClosestPop) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        result.push(c);
      }
    }
    for (const id of majorIds) {
      if (id === cityA.id || seen.has(id)) continue;
      const found = allCities.find((c) => c.id === id);
      if (found) {
        seen.add(found.id);
        result.push(found);
      }
      if (result.length >= 10) break;
    }
    return result;
  }, [allCities, cityA.id, cityA.population]);

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suggestedCities;
    return allCities
      .filter(
        (c) =>
          c.id !== cityA.id &&
          (c.name.toLowerCase().includes(q) ||
            c.enName.toLowerCase().includes(q) ||
            c.provinceName.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [searchQuery, allCities, cityA.id, suggestedCities]);

  const metrics: MetricRowDef[] = useMemo(() => {
    if (!cityB) return [];
    const rows: MetricRowDef[] = [
      {
        id: 'population',
        label: '인구',
        valA: cityA.population,
        valB: cityB.population,
        fmtA: formatPopulation(cityA.population),
        fmtB: formatPopulation(cityB.population),
        deltaText: formatRatioOrDiff(cityA.population, cityB.population, '명'),
      },
      {
        id: 'density',
        label: '인구밀도',
        valA: cityA.populationDensity,
        valB: cityB.populationDensity,
        fmtA: `${cityA.populationDensity.toLocaleString('ko-KR')}/km²`,
        fmtB: `${cityB.populationDensity.toLocaleString('ko-KR')}/km²`,
        deltaText: formatRatioOrDiff(cityA.populationDensity, cityB.populationDensity, '명/km²'),
      },
      {
        id: 'grdp',
        label: 'GRDP (경제 규모)',
        valA: cityA.grdpBillionKrw,
        valB: cityB.grdpBillionKrw,
        fmtA: formatGrdp100M(cityA.grdpBillionKrw),
        fmtB: formatGrdp100M(cityB.grdpBillionKrw),
        deltaText: formatRatioOrDiff(cityA.grdpBillionKrw, cityB.grdpBillionKrw, '억원'),
      },
      {
        id: 'grdp_pc',
        label: '1인당 GRDP',
        valA: cityA.grdpPerCapitaManwon,
        valB: cityB.grdpPerCapitaManwon,
        fmtA: formatManwon(cityA.grdpPerCapitaManwon),
        fmtB: formatManwon(cityB.grdpPerCapitaManwon),
        deltaText: formatRatioOrDiff(cityA.grdpPerCapitaManwon, cityB.grdpPerCapitaManwon, '만원'),
      },
      {
        id: 'workers',
        label: '총 종사자',
        valA: cityA.totalWorkers,
        valB: cityB.totalWorkers,
        fmtA: `${(cityA.totalWorkers / 10000).toFixed(1)}만명`,
        fmtB: `${(cityB.totalWorkers / 10000).toFixed(1)}만명`,
        deltaText: formatRatioOrDiff(cityA.totalWorkers, cityB.totalWorkers, '명'),
      },
      {
        id: 'manufacturing',
        label: '제조업 비중',
        valA: cityA.shares.manufacturing,
        valB: cityB.shares.manufacturing,
        fmtA: `${cityA.shares.manufacturing.toFixed(1)}%`,
        fmtB: `${cityB.shares.manufacturing.toFixed(1)}%`,
        deltaText: formatRatioOrDiff(cityA.shares.manufacturing, cityB.shares.manufacturing, '%', true),
      },
      {
        id: 'ict',
        label: 'IT · 과학기술 비중',
        valA: cityA.shares.ictScience,
        valB: cityB.shares.ictScience,
        fmtA: `${cityA.shares.ictScience.toFixed(1)}%`,
        fmtB: `${cityB.shares.ictScience.toFixed(1)}%`,
        deltaText: formatRatioOrDiff(cityA.shares.ictScience, cityB.shares.ictScience, '%', true),
      },
      {
        id: 'aging',
        label: '고령화율 (65세+)',
        valA: cityA.agingRate,
        valB: cityB.agingRate,
        fmtA: `${cityA.agingRate.toFixed(1)}%`,
        fmtB: `${cityB.agingRate.toFixed(1)}%`,
        deltaText: formatRatioOrDiff(cityA.agingRate, cityB.agingRate, '%', true),
        higherIsNeutral: true,
      },
      {
        id: 'income',
        label: '평균 근로소득',
        valA: cityA.avgIncomeManwon,
        valB: cityB.avgIncomeManwon,
        fmtA: `${cityA.avgIncomeManwon.toLocaleString('ko-KR')}만원`,
        fmtB: `${cityB.avgIncomeManwon.toLocaleString('ko-KR')}만원`,
        deltaText: formatRatioOrDiff(cityA.avgIncomeManwon, cityB.avgIncomeManwon, '만원'),
      },
      {
        id: 'education',
        label: '대졸+ 학위 비중',
        valA: cityA.collegeDegreePct,
        valB: cityB.collegeDegreePct,
        fmtA: `${cityA.collegeDegreePct.toFixed(1)}%`,
        fmtB: `${cityB.collegeDegreePct.toFixed(1)}%`,
        deltaText: formatRatioOrDiff(cityA.collegeDegreePct, cityB.collegeDegreePct, '%', true),
      },
      {
        id: 'health',
        label: '기대수명',
        valA: cityA.lifeExpectancy,
        valB: cityB.lifeExpectancy,
        fmtA: `${cityA.lifeExpectancy.toFixed(1)}세`,
        fmtB: `${cityB.lifeExpectancy.toFixed(1)}세`,
        deltaText: `${cityA.lifeExpectancy - cityB.lifeExpectancy >= 0 ? '+' : ''}${(cityA.lifeExpectancy - cityB.lifeExpectancy).toFixed(1)}세`,
      },
      {
        id: 'housing',
        label: '주택가격 (3.3m²)',
        valA: cityA.housingPriceManwon,
        valB: cityB.housingPriceManwon,
        fmtA: `${cityA.housingPriceManwon.toLocaleString('ko-KR')}만`,
        fmtB: `${cityB.housingPriceManwon.toLocaleString('ko-KR')}만`,
        deltaText: formatRatioOrDiff(cityA.housingPriceManwon, cityB.housingPriceManwon, '만원'),
      },
      {
        id: 'faith',
        label: '종교인구 비중',
        valA: cityA.faithRatePct,
        valB: cityB.faithRatePct,
        fmtA: `${cityA.faithRatePct.toFixed(1)}%`,
        fmtB: `${cityB.faithRatePct.toFixed(1)}%`,
        deltaText: formatRatioOrDiff(cityA.faithRatePct, cityB.faithRatePct, '%', true),
        higherIsNeutral: true,
      },
      {
        id: 'culture',
        label: '문화유산 밀도 지수',
        valA: cityA.cultureScore,
        valB: cityB.cultureScore,
        fmtA: `${cityA.cultureScore}점`,
        fmtB: `${cityB.cultureScore}점`,
        deltaText: formatRatioOrDiff(cityA.cultureScore, cityB.cultureScore, '점'),
      },
      {
        id: 'freight',
        label: '연간 화물 물동량',
        valA: cityA.freightVolumeMt,
        valB: cityB.freightVolumeMt,
        fmtA: `${cityA.freightVolumeMt.toFixed(1)} Mt`,
        fmtB: `${cityB.freightVolumeMt.toFixed(1)} Mt`,
        deltaText: `${cityA.freightVolumeMt - cityB.freightVolumeMt >= 0 ? '+' : ''}${(cityA.freightVolumeMt - cityB.freightVolumeMt).toFixed(1)}Mt`,
      },
      {
        id: 'power',
        label: '발전 설비용량',
        valA: cityA.powerCapacityMw,
        valB: cityB.powerCapacityMw,
        fmtA: `${cityA.powerCapacityMw.toLocaleString('ko-KR')} MW`,
        fmtB: `${cityB.powerCapacityMw.toLocaleString('ko-KR')} MW`,
        deltaText: formatRatioOrDiff(cityA.powerCapacityMw, cityB.powerCapacityMw, 'MW'),
      },
      {
        id: 'rd',
        label: '대학 연구비',
        valA: cityA.universityRd100M,
        valB: cityB.universityRd100M,
        fmtA: `${cityA.universityRd100M.toLocaleString('ko-KR')}억`,
        fmtB: `${cityB.universityRd100M.toLocaleString('ko-KR')}억`,
        deltaText: formatRatioOrDiff(cityA.universityRd100M, cityB.universityRd100M, '억원'),
      },
      {
        id: 'disaster',
        label: '10년 재해피해',
        valA: cityA.disasterDamage100M,
        valB: cityB.disasterDamage100M,
        fmtA: `${cityA.disasterDamage100M.toLocaleString('ko-KR')}억`,
        fmtB: `${cityB.disasterDamage100M.toLocaleString('ko-KR')}억`,
        deltaText: formatRatioOrDiff(cityA.disasterDamage100M, cityB.disasterDamage100M, '억원'),
        higherIsNeutral: true,
      },
    ];

    if (historyCtx) {
      const dA = computeCityPopChangePct(
        cityA.id,
        historyCtx.baseSnapshot,
        historyCtx.targetSnapshot
      );
      const dB = computeCityPopChangePct(
        cityB.id,
        historyCtx.baseSnapshot,
        historyCtx.targetSnapshot
      );
      if (dA && dB) {
        rows.splice(2, 0, {
          id: 'hist_change',
          label: `${historyCtx.baseYear}→${historyCtx.targetYear} 인구 증감`,
          valA: Math.max(0, dA.pct + 40),
          valB: Math.max(0, dB.pct + 40),
          fmtA: `${dA.pct >= 0 ? '+' : ''}${dA.pct.toFixed(1)}%`,
          fmtB: `${dB.pct >= 0 ? '+' : ''}${dB.pct.toFixed(1)}%`,
          deltaText: formatRatioOrDiff(dA.pct, dB.pct, '%', true),
        });
      }
    }

    return rows;
  }, [cityA, cityB, historyCtx]);

  const provA = PROVINCE_META[cityA.province];
  const provB = cityB ? PROVINCE_META[cityB.province] : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 분할 상단: A 도시 vs B 도시 선택 & 컨트롤 */}
      <div className="grid grid-cols-2 border-b border-[#1E2F42] bg-[#0B1623]">
        {/* 좌측 City A 헤더 */}
        <div className="border-r border-[#1E2F42] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#D4A84B]">
              <span className="font-semibold">도시 A</span>
              <span aria-hidden="true">·</span>
              <span className="truncate text-[#8FA4B8]">
                {provA.shortName} · {cityA.hexCount}칸 ({cityA.areaKm2.toLocaleString('ko-KR')}km²)
              </span>
            </div>
            <button
              type="button"
              onClick={() => onFocusCity(cityA)}
              title={`${cityA.name}로 지도 이동`}
              aria-label={`${cityA.name}로 지도 이동`}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] transition-colors hover:border-[#D4A84B]/60 hover:text-[#F5D684]"
            >
              <Compass className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="font-display mt-0.5 truncate text-lg font-bold text-[#F5E9C8]">
            {cityA.name}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#95A9BC]">
            {cityA.summary}
          </p>
        </div>

        {/* 우측 City B 헤더 */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#67D4E8]">
              <span className="font-semibold">도시 B</span>
              {cityB && provB && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate text-[#8FA4B8]">
                    {provB.shortName} · {cityB.hexCount}칸 ({cityB.areaKm2.toLocaleString('ko-KR')}km²)
                  </span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {cityB && (
                <>
                  <button
                    type="button"
                    onClick={onSwapCities}
                    title="도시 A와 B 맞바꾸기"
                    aria-label="도시 A와 B 맞바꾸기"
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] transition-colors hover:border-[#67D4E8]/60 hover:text-[#9BE8F7]"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onFocusCity(cityB)}
                    title={`${cityB.name}로 지도 이동`}
                    aria-label={`${cityB.name}로 지도 이동`}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] transition-colors hover:border-[#67D4E8]/60 hover:text-[#9BE8F7]"
                  >
                    <Compass className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onTogglePickFromMap}
                title="지도에서 비교 도시(B) 직접 클릭 선택"
                className={`inline-flex h-6 cursor-pointer items-center gap-1 rounded border px-2 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
                  pickingFromMap
                    ? 'border-[#67D4E8] bg-[#133242] text-[#A2F0FF]'
                    : 'border-[#26394E] bg-[#122233] text-[#9BB0C4] hover:border-[#67D4E8]/60 hover:text-[#DCE8F2]'
                }`}
              >
                <Crosshair className="h-3 w-3" />
                <span>{pickingFromMap ? '지도 클릭 대기' : '지도 선택'}</span>
              </button>
            </div>
          </div>

          {cityB ? (
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <div className="font-display truncate text-lg font-bold text-[#B8F0FA]">
                {cityB.name}
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="shrink-0 cursor-pointer text-[11px] font-medium text-[#7AA8BC] underline-offset-2 hover:text-[#B8F0FA] hover:underline"
              >
                {pickerOpen ? '목록 닫기' : '도시 변경'}
              </button>
            </div>
          ) : (
            <div className="mt-0.5 text-sm font-semibold text-[#A5BACD]">
              비교할 두 번째 시·군을 선택하세요
            </div>
          )}

          {cityB && !pickerOpen && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#95A9BC]">
              {cityB.summary}
            </p>
          )}
        </div>
      </div>

      {/* 비교 대상 도시 B 선택기 (드롭다운 패널) */}
      {(pickerOpen || !cityB) && (
        <div className="border-b border-[#1E2F42] bg-[#09131F] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#6F879E]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="비교할 시·군 이름 검색 (예: 부산, 화성, 수원, 세종, 성남)..."
                className="w-full rounded border border-[#24374C] bg-[#0C1826] py-1.5 pr-7 pl-8 text-xs text-[#E8E6DF] placeholder-[#6A8198] focus:border-[#67D4E8] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="검색어 지우기"
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[#7C93AA] hover:text-[#E8E6DF]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {cityB && (
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="cursor-pointer rounded border border-[#24374C] px-2.5 py-1.5 text-[11px] text-[#9BB0C4] hover:text-[#E8E6DF]"
              >
                완료
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10.5px] text-[#7890A6]">
            <span>
              {searchQuery.trim()
                ? `검색 결과 (${filteredCities.length})`
                : `${cityA.name}과 규모가 유사하거나 자주 비교되는 시·군`}
            </span>
            <span>또는 지도에서 Shift+클릭으로 바로 비교 도시 지정</span>
          </div>

          <div className="mt-2 grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {filteredCities.map((c) => {
              const isActive = cityB?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCityB(c.id);
                    setSearchQuery('');
                    setPickerOpen(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? 'border-[#67D4E8] bg-[#132E3E] text-[#B8F0FA]'
                      : 'border-[#1C2D40] bg-[#0E1B2A] text-[#D2DDE8] hover:border-[#67D4E8]/50 hover:bg-[#142538]'
                  }`}
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="ml-1.5 shrink-0 text-[10.5px] text-[#7F95AA]">
                    {PROVINCE_META[c.province].shortName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 분할 본문: City B가 선택되었을 때만 사이드바이사이드 비교표 표시 */}
      {!cityB ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="text-sm font-semibold text-[#D6E0EA]">
            두 시·군의 핵심 지표를 나란히 비교합니다
          </div>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#859BB0]">
            위 목록에서 비교할 두 번째 도시를 고르거나, 우측 상단의 &lsquo;지도 선택&rsquo; 버튼을 누른 뒤
            지도에서 다른 시·군 타일을 클릭하면 인구·GRDP·특화 지구·시민 구성을 한눈에 대조할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* 0. 지역 정책 카드 (Policy Card) 나란히 비교 */}
          <section className="mb-4 border-b border-[#1E2F42] pb-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold text-[#F0DFB3]">
                지역 정책 카드 비교 (Policy Cards)
              </h3>
              <span className="text-[10.5px] text-[#738A9F]">
                주력 산업 기반 고유 패시브 보너스
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <PolicyCardBanner card={cityA.policyCard} compact cityLabel={cityA.name} />
              <PolicyCardBanner card={cityB.policyCard} compact cityLabel={cityB.name} />
            </div>
          </section>

          {/* 1. 핵심 통계 사이드바이사이드 비교표 */}
          <section className="border-b border-[#1E2F42] pb-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold text-[#F0DFB3]">
                핵심 지표 나란히 비교
              </h3>
              <div className="font-mono-num flex items-center gap-3 text-[10.5px] text-[#7D93A8]">
                <span className="text-[#F2CA66]">좌: {cityA.name}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#67D4E8]">우: {cityB.name}</span>
                <span aria-hidden="true">·</span>
                <span>차이 (A−B)</span>
              </div>
            </div>

            <div className="divide-y divide-[#172536] border-y border-[#1E2F42]">
              {metrics.map((m) => {
                const maxVal = Math.max(m.valA, m.valB, 0.001);
                const pctA = Math.min(100, (m.valA / maxVal) * 100);
                const pctB = Math.min(100, (m.valB / maxVal) * 100);
                const aHigher = m.valA > m.valB;
                const bHigher = m.valB > m.valA;

                return (
                  <div key={m.id} className="py-2">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3 text-xs">
                      {/* City A 값 */}
                      <div className="text-right">
                        <span
                          className={`font-mono-num ${
                            aHigher
                              ? 'font-semibold text-[#F5D684]'
                              : 'text-[#C6D3DF]'
                          }`}
                        >
                          {m.fmtA}
                        </span>
                      </div>

                      {/* 중앙 지표명 + 차이 */}
                      <div className="w-[144px] text-center">
                        <div className="text-[11px] font-medium text-[#D2DDE8]">
                          {m.label}
                        </div>
                        <div className="font-mono-num text-[10px] text-[#7C93AA]">
                          {m.deltaText}
                        </div>
                      </div>

                      {/* City B 값 */}
                      <div className="text-left">
                        <span
                          className={`font-mono-num ${
                            bHigher
                              ? 'font-semibold text-[#8CE6F5]'
                              : 'text-[#C6D3DF]'
                          }`}
                        >
                          {m.fmtB}
                        </span>
                      </div>
                    </div>

                    {/* 대칭 비교 막대 */}
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <div className="flex justify-end overflow-hidden rounded-xs bg-[#132234]">
                        <div
                          className="h-1.5 transition-all"
                          style={{
                            width: `${pctA}%`,
                            backgroundColor: aHigher ? '#D4A84B' : '#7D6A3E',
                          }}
                        />
                      </div>
                      <div className="flex justify-start overflow-hidden rounded-xs bg-[#132234]">
                        <div
                          className="h-1.5 transition-all"
                          style={{
                            width: `${pctB}%`,
                            backgroundColor: bHigher ? '#5AC4D9' : '#336C7B',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. 특화 지구 (Districts) 2열 비교 */}
          <section className="mt-4 border-b border-[#1E2F42] pb-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold text-[#F0DFB3]">
                특화 지구 비교 (Districts · LQ ≥ 1.5)
              </h3>
              <span className="font-mono-num text-[10.5px] text-[#738A9F]">
                {cityA.districts.length}개 vs {cityB.districts.length}개
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Left: City A Districts */}
              <div className="border-r border-[#1E2F42] pr-4">
                {cityA.districts.length === 0 ? (
                  <p className="text-[11px] text-[#7890A6]">특화 지구 없음 (균형형)</p>
                ) : (
                  <div className="space-y-2">
                    {cityA.districts.map((dist) => {
                      const meta = DISTRICT_META[dist.type];
                      return (
                        <div
                          key={dist.type}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2 w-2 shrink-0 rounded-xs"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="truncate font-medium text-[#ECEAE2]">
                              {meta.nameKo}
                            </span>
                          </div>
                          <span
                            className="font-mono-num shrink-0 text-[11px] font-semibold"
                            style={{ color: meta.color }}
                          >
                            LQ {dist.lq.toFixed(2)}×
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: City B Districts */}
              <div>
                {cityB.districts.length === 0 ? (
                  <p className="text-[11px] text-[#7890A6]">특화 지구 없음 (균형형)</p>
                ) : (
                  <div className="space-y-2">
                    {cityB.districts.map((dist) => {
                      const meta = DISTRICT_META[dist.type];
                      return (
                        <div
                          key={dist.type}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2 w-2 shrink-0 rounded-xs"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="truncate font-medium text-[#ECEAE2]">
                              {meta.nameKo}
                            </span>
                          </div>
                          <span
                            className="font-mono-num shrink-0 text-[11px] font-semibold"
                            style={{ color: meta.color }}
                          >
                            LQ {dist.lq.toFixed(2)}×
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. 시민 산업 구성 (7대 업종) 나란히 비교 */}
          <section className="mt-4 border-b border-[#1E2F42] pb-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold text-[#F0DFB3]">
                시민 산업 구성 비교 (7대 업종 비중)
              </h3>
              <span className="text-[10.5px] text-[#738A9F]">
                금색: A · 청록: B
              </span>
            </div>

            <div className="space-y-2.5">
              {(Object.keys(INDUSTRY_META) as Array<keyof typeof INDUSTRY_META>).map((indKey) => {
                const citA = cityA.citizens.find((c) => c.industry === indKey);
                const citB = cityB.citizens.find((c) => c.industry === indKey);
                const pctA = citA?.sharePct ?? cityA.shares[indKey];
                const pctB = citB?.sharePct ?? cityB.shares[indKey];
                const scaleMax = Math.max(pctA, pctB, 35);

                return (
                  <div key={indKey}>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-[11px]">
                      <div className="font-mono-num text-right text-[#E6D19A]">
                        {pctA.toFixed(1)}%
                        {citA && citA.oneInN < 100 && (
                          <span className="ml-1 text-[10px] text-[#7C93AA]">
                            ({citA.oneInN}명 중 1)
                          </span>
                        )}
                      </div>
                      <div className="w-28 truncate text-center text-[#C2D0DD]">
                        {INDUSTRY_META[indKey].shortKo}
                      </div>
                      <div className="font-mono-num text-left text-[#8FE4F3]">
                        {pctB.toFixed(1)}%
                        {citB && citB.oneInN < 100 && (
                          <span className="ml-1 text-[10px] text-[#7C93AA]">
                            ({citB.oneInN}명 중 1)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1.5">
                      <div className="flex justify-end overflow-hidden rounded-xs bg-[#132234]">
                        <div
                          className="h-1.5 bg-[#D4A84B]"
                          style={{ width: `${Math.min(100, (pctA / scaleMax) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-start overflow-hidden rounded-xs bg-[#132234]">
                        <div
                          className="h-1.5 bg-[#5AC4D9]"
                          style={{ width: `${Math.min(100, (pctB / scaleMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. 소재 불가사의 및 주요 시설 요약 */}
          <section className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold text-[#F0DFB3]">
                주요 시설 · 불가사의 ({facilitiesA.length} vs {facilitiesB.length})
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[11px]">
              <div className="space-y-1 border-r border-[#1E2F42] pr-4">
                {facilitiesA.length === 0 ? (
                  <span className="text-[#7890A6]">등록된 주요 거점 시설 없음</span>
                ) : (
                  facilitiesA.slice(0, 6).map((f) => (
                    <div key={f.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[#DCE4EC]">
                        {f.isWonder ? `★ ${f.name}` : f.name}
                      </span>
                      <span className="font-mono-num shrink-0 text-[10px] text-[#D4A84B]">
                        {f.metricValue.toLocaleString('ko-KR')} {f.metricUnit}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-1">
                {facilitiesB.length === 0 ? (
                  <span className="text-[#7890A6]">등록된 주요 거점 시설 없음</span>
                ) : (
                  facilitiesB.slice(0, 6).map((f) => (
                    <div key={f.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[#DCE4EC]">
                        {f.isWonder ? `★ ${f.name}` : f.name}
                      </span>
                      <span className="font-mono-num shrink-0 text-[10px] text-[#67D4E8]">
                        {f.metricValue.toLocaleString('ko-KR')} {f.metricUnit}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
