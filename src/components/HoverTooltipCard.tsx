import React from 'react';
import type { CityComputed, FacilityPoint, HexTile, LensId } from '../types/civ';
import { PROVINCE_META, RELIEF_META, TERRAIN_META } from '../data/rules';
import { formatPopulation, getLensTileMetricText } from '../utils/formatters';
import {
  computeCityPopChangePct,
  type HistoryRenderContext,
} from '../engine/history';

interface HoverTooltipCardProps {
  hex: HexTile | null;
  city: CityComputed | undefined;
  facility: FacilityPoint | null;
  activeLens: LensId;
  historyCtx?: HistoryRenderContext | null;
  sidebarCollapsed: boolean;
}

export const HoverTooltipCard: React.FC<HoverTooltipCardProps> = ({
  hex,
  city,
  facility,
  activeLens,
  historyCtx = null,
  sidebarCollapsed,
}) => {
  if (!hex && !facility) return null;

  const leftOffset = sidebarCollapsed ? 'left-4' : 'left-[292px]';

  if (facility) {
    return (
      <div
        className={`pointer-events-none absolute bottom-4 ${leftOffset} z-20 hidden w-[300px] rounded border border-[#D4A84B]/55 bg-[#0C1826]/94 px-3.5 py-2.5 backdrop-blur-md md:block`}
      >
        <div className="flex items-center justify-between text-[11px] text-[#D4A84B]">
          <span>
            {facility.isWonder
              ? facility.wonderKind === 'natural'
                ? `자연 불가사의 #${facility.wonderRank}`
                : facility.wonderKind === 'academic'
                  ? `학문 불가사의 #${facility.wonderRank}`
                  : `문화·신앙 불가사의 #${facility.wonderRank}`
              : facility.subCategory}
          </span>
          <span className="text-[#889EB3]">{PROVINCE_META[facility.province].shortName}</span>
        </div>
        <div className="mt-0.5 text-sm font-semibold text-[#F6EBC9]">
          {facility.name}
        </div>
        <div className="mt-1 flex items-baseline justify-between text-xs">
          <span className="text-[#9AB0C4]">{facility.metricLabel}</span>
          <span className="font-mono-num font-semibold text-[#F5D684]">
            {facility.metricValue.toLocaleString('ko-KR')} {facility.metricUnit}
          </span>
        </div>
      </div>
    );
  }

  if (!hex || !city) return null;
  const lensMetric = getLensTileMetricText(hex, city, activeLens, historyCtx);
  const histDelta =
    activeLens === 'history' && historyCtx
      ? computeCityPopChangePct(
          city.id,
          historyCtx.baseSnapshot,
          historyCtx.targetSnapshot
        )
      : null;

  return (
    <div
      className={`pointer-events-none absolute bottom-4 ${leftOffset} z-20 hidden w-[300px] rounded border border-[#24364B] bg-[#0C1826]/92 px-3.5 py-2.5 backdrop-blur-md md:block`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-[#F0EEE6]">
          {city.name}
          <span className="ml-1.5 text-xs font-normal text-[#859BB0]">
            {PROVINCE_META[city.province].shortName}
          </span>
        </div>
        <span className="font-mono-num text-[10.5px] text-[#6F869C]">
          ({hex.q}, {hex.r})
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9BB0C4]">
        <span>{TERRAIN_META[hex.terrain].nameKo}</span>
        <span aria-hidden="true">·</span>
        <span>{RELIEF_META[hex.relief].civName}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-num">{hex.elevationM}m</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between border-t border-[#1C2D40] pt-1.5 text-xs">
        <span className="text-[#8FA4B8]">{lensMetric.label}</span>
        <span className="font-mono-num font-semibold text-[#F5D684]">
          {lensMetric.value}
        </span>
      </div>

      {histDelta && (
        <div className="font-mono-num mt-1 flex items-center justify-between text-[10.5px] text-[#9BB0C4]">
          <span>
            {historyCtx?.baseYear} {formatPopulation(histDelta.basePop)} →{' '}
            {historyCtx?.targetYear} {formatPopulation(histDelta.targetPop)}
          </span>
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-[#182636] pt-1.5 text-[10.5px]">
        <span className="truncate text-[#95A9BC]">
          정책 ·{' '}
          <span className="font-medium" style={{ color: city.policyCard.accentColor }}>
            {city.policyCard.nameKo}
          </span>
        </span>
        <span className="font-mono-num shrink-0 text-[#72889E]">
          {city.policyCard.nameEn}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10.5px] text-[#7D93A8]">
        <span>금화 {hex.civGold} · 생산 {hex.civProduction} · 식량 {hex.civFood} · 과학 {hex.civScience}</span>
        <span>클릭하여 상세 보기</span>
      </div>
    </div>
  );
};
