import React from 'react';
import {
  Anchor,
  Compass,
  Cpu,
  Factory,
  Landmark,
  Palette,
  Shield,
  Wheat,
} from 'lucide-react';
import type { PolicyCard, PolicyCardId } from '../types/civ';

interface PolicyCardBannerProps {
  card: PolicyCard;
  compact?: boolean;
  cityLabel?: string;
}

function renderPolicyIcon(id: PolicyCardId, color: string, compact: boolean) {
  const cls = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const style = { color };
  switch (id) {
    case 'industrial_base':
      return <Factory className={cls} style={style} aria-hidden="true" />;
    case 'tech_hub':
      return <Cpu className={cls} style={style} aria-hidden="true" />;
    case 'financial_capital':
      return <Landmark className={cls} style={style} aria-hidden="true" />;
    case 'maritime_gateway':
      return <Anchor className={cls} style={style} aria-hidden="true" />;
    case 'cultural_bastion':
      return <Palette className={cls} style={style} aria-hidden="true" />;
    case 'civic_seat':
      return <Shield className={cls} style={style} aria-hidden="true" />;
    case 'breadbasket':
      return <Wheat className={cls} style={style} aria-hidden="true" />;
    case 'balanced_polis':
      return <Compass className={cls} style={style} aria-hidden="true" />;
  }
}

export const PolicyCardBanner: React.FC<PolicyCardBannerProps> = ({
  card,
  compact = false,
  cityLabel,
}) => {
  return (
    <div className="overflow-hidden rounded border border-[#24364B] bg-[#0F1D2C]">
      {/* 상단 정책 슬롯 얇은 액센트 룰 */}
      <div
        className="h-[2px] w-full opacity-85"
        style={{ backgroundColor: card.accentColor }}
        aria-hidden="true"
      />

      <div className={compact ? 'p-2.5' : 'p-3'}>
        <div className="flex items-start gap-2.5">
          {/* 정책 카드 문장 아이콘 프레임 */}
          <div
            className={`flex shrink-0 items-center justify-center rounded border border-[#24364B] bg-[#0A1420] ${
              compact ? 'h-7 w-7' : 'h-9 w-9'
            }`}
          >
            {renderPolicyIcon(card.id, card.accentColor, compact)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[10.5px] text-[#8399AE]">
              <span className="truncate">
                {card.slotLabelKo}
                <span className="mx-1 text-[#4E647A]" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono-num text-[#9EB2C5]">{card.nameEn}</span>
              </span>
              {cityLabel && (
                <span className="shrink-0 font-medium text-[#A9BCCF]">{cityLabel}</span>
              )}
            </div>

            <div
              className={`font-display mt-0.5 font-bold text-[#F5E9C8] ${
                compact ? 'text-sm' : 'text-[15px]'
              }`}
            >
              {card.nameKo}
            </div>

            <div
              className={`mt-1 font-medium leading-snug ${
                compact ? 'text-[11px]' : 'text-xs'
              }`}
              style={{ color: card.accentColor }}
            >
              {card.passiveBonus}
            </div>

            {!compact && (
              <p className="mt-1 text-[11px] leading-relaxed text-[#9BB0C4]">
                {card.secondaryEffect}
              </p>
            )}
          </div>
        </div>

        {/* 실측 데이터 근거 풋터 */}
        <div
          className={`font-mono-num border-t border-[#1A2A3D] text-[#7D93A8] ${
            compact ? 'mt-2 pt-1.5 text-[10px]' : 'mt-2.5 pt-2 text-[10.5px]'
          }`}
        >
          발동 근거: {card.triggerRule}
        </div>
      </div>
    </div>
  );
};
