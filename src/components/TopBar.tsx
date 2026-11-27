import React, { useEffect, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

export type WorkspaceTab = 'map' | 'advisors' | 'explorer' | 'wonders' | 'live_api';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenSources: () => void;
}

// shortLabel: 휴대폰 폭(640px 미만)에서 쓰는 짧은 이름. 다섯 탭이 한 줄에 들어가게 함
const NAV_ITEMS: { id: WorkspaceTab; label: string; shortLabel?: string }[] = [
  { id: 'map', label: '지도' },
  { id: 'advisors', label: '자문관' },
  { id: 'explorer', label: '탐색기' },
  { id: 'wonders', label: '불가사의' },
  { id: 'live_api', label: '실시간 API', shortLabel: 'API' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSources,
}) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // 탭 줄이 화면보다 넓을 때 고른 탭이 가려지지 않게 보이는 위치로 스크롤
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  return (
    <header className="relative z-30 flex h-13 shrink-0 items-center justify-between gap-2.5 border-b border-[#223347] bg-[#0B1521]/95 px-3 sm:gap-8 sm:px-5 backdrop-blur-sm">
      {/* Zone 1: Single text element wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('map')}
        className="font-display shrink-0 cursor-pointer whitespace-nowrap text-base font-bold sm:text-lg tracking-tight text-[#F0DFB3] transition-colors hover:text-[#FFF1CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A84B]"
      >
        KoreaCiv
      </button>

      {/* Zone 2: 4 single-line text navigation links */}
      <nav
        aria-label="주요 보기 전환"
        className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto text-[13px] font-medium [scrollbar-width:none] max-[359px]:[mask-image:linear-gradient(to_right,black_82%,transparent)] sm:flex-none sm:gap-6 sm:text-sm"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              ref={isActive ? activeRef : undefined}
              type="button"
              aria-label={item.label}
              onClick={() => onSelectTab(item.id)}
              className={`relative shrink-0 cursor-pointer whitespace-nowrap py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A84B] ${
                isActive
                  ? 'text-[#F5D684]'
                  : 'text-[#9CB0C4] hover:text-[#E8E6DF]'
              }`}
            >
              {item.shortLabel ? (
                <>
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </>
              ) : (
                item.label
              )}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 bottom-0 left-0 h-[2px] bg-[#D4A84B]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onOpenSources}
          aria-label="출처 · 규칙"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-[#2C4057] bg-[#132234] px-2 py-1.5 text-xs font-medium text-[#DCE4EC] sm:px-3 transition-colors hover:border-[#D4A84B]/60 hover:text-[#F5D684] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A84B]"
        >
          <HelpCircle className="h-3.5 w-3.5 text-[#D4A84B]" aria-hidden="true" />
          <span className="hidden sm:inline">출처 · 규칙</span>
        </button>
      </div>
    </header>
  );
};
