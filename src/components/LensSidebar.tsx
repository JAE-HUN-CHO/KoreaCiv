import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import type {
  CityComputed,
  FacilityPoint,
  HistoryCensusYear,
  HistoryViewMode,
  LayerVisibility,
  LensId,
} from '../types/civ';
import type { HistoryRenderContext } from '../engine/history';
import { LENS_DEFINITIONS, PROVINCE_META } from '../data/rules';
import { searchVWorldPlaces, type GeocodedPlaceResult } from '../services/publicApis';

interface LensSidebarProps {
  activeLens: LensId;
  onSelectLens: (lens: LensId) => void;
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  cities: CityComputed[];
  facilities: FacilityPoint[];
  vworldEnabled?: boolean;
  historyCtx?: HistoryRenderContext | null;
  historyLoading?: boolean;
  historyError?: string | null;
  onChangeHistoryMode?: (mode: HistoryViewMode) => void;
  onChangeHistoryYear?: (year: HistoryCensusYear) => void;
  onChangeHistoryRange?: (base: HistoryCensusYear, target: HistoryCensusYear) => void;
  onToggleHistoryCompareCurrent?: () => void;
  onPinPlace?: (place: GeocodedPlaceResult, flyToPin: boolean) => void;
  onJumpToCity: (cityId: string) => void;
  onJumpToFacility: (facility: FacilityPoint) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const LAYER_OPTIONS: { key: keyof LayerVisibility; label: string; dotColor?: string }[] = [
  { key: 'cityBanners', label: '도시 배너' },
  { key: 'wonders', label: '불가사의 (Top 15)', dotColor: '#F7DA82' },
  { key: 'freightFlows', label: '화물 물류 흐름 (KTDB)', dotColor: '#67DAF0' },
  { key: 'culturalSites', label: '문화유산 · 박물관 · 랜드마크 (30)', dotColor: '#E080C0' },
  { key: 'defenseHubs', label: '안보 · 전략 권역 (10)', dotColor: '#95B574' },
  { key: 'powerPlants', label: '발전소 (≥500MW)', dotColor: '#F5B547' },
  { key: 'ports', label: '무역항', dotColor: '#45B8D9' },
  { key: 'airports', label: '전국 공항 (15)', dotColor: '#9CC6F5' },
  { key: 'mines', label: '광산 · 탄전', dotColor: '#C99063' },
  { key: 'nationalParks', label: '국립공원 (23)', dotColor: '#6CC776' },
  { key: 'universities', label: '연구중심대학', dotColor: '#6BB5FF' },
  { key: 'rivers', label: '주요 하천' },
  { key: 'railways', label: 'KTX 고속철도' },
  { key: 'provinceBorders', label: '시도 공식 경계 (SGIS)' },
  { key: 'sigunguBorders', label: '시군구 공식 경계 (SGIS)' },
];

export const LensSidebar: React.FC<LensSidebarProps> = ({
  activeLens,
  onSelectLens,
  layers,
  onToggleLayer,
  cities,
  facilities,
  vworldEnabled = false,
  historyCtx = null,
  historyLoading = false,
  historyError = null,
  onChangeHistoryMode,
  onChangeHistoryYear,
  onChangeHistoryRange,
  onToggleHistoryCompareCurrent,
  onPinPlace,
  onJumpToCity,
  onJumpToFacility,
  collapsed,
  onToggleCollapse,
}) => {
  const [query, setQuery] = useState('');
  const [layersOpen, setLayersOpen] = useState(true);
  const [vworldHits, setVworldHits] = useState<GeocodedPlaceResult[]>([]);
  const [vworldBusy, setVworldBusy] = useState(false);
  const [vworldErr, setVworldErr] = useState<string | null>(null);

  const handleQuickVWorld = async () => {
    const q = query.trim();
    if (!q || !vworldEnabled) return;
    setVworldBusy(true);
    setVworldErr(null);
    try {
      const res = await searchVWorldPlaces(q, 'place');
      setVworldHits(res.results.slice(0, 5));
      if (res.results.length === 0) setVworldErr('VWorld 장소 검색 결과가 없습니다.');
    } catch (err) {
      setVworldErr(err instanceof Error ? err.message : 'VWorld 검색 오류');
    } finally {
      setVworldBusy(false);
    }
  };

  const activeLensDef = useMemo(
    () => LENS_DEFINITIONS.find((l) => l.id === activeLens) ?? LENS_DEFINITIONS[0],
    [activeLens]
  );

  const coreLenses = useMemo(
    () => LENS_DEFINITIONS.filter((l) => l.category === 'core'),
    []
  );
  const societyLenses = useMemo(
    () => LENS_DEFINITIONS.filter((l) => l.category === 'society'),
    []
  );
  const infraLenses = useMemo(
    () => LENS_DEFINITIONS.filter((l) => l.category === 'infra'),
    []
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { cities: [] as CityComputed[], facilities: [] as FacilityPoint[] };
    const matchedCities = cities
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.enName.toLowerCase().includes(q) ||
          c.provinceName.toLowerCase().includes(q)
      )
      .slice(0, 6);
    const matchedFacilities = facilities
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 4);
    return { cities: matchedCities, facilities: matchedFacilities };
  }, [query, cities, facilities]);

  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute top-4 left-4 z-20">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex cursor-pointer items-center gap-2 rounded border border-[#273A4F] bg-[#0D1A28]/95 px-3 py-2 text-xs font-medium text-[#E8E6DF] backdrop-blur-sm transition-colors hover:border-[#D4A84B]/60"
          aria-label="렌즈 패널 펼치기"
        >
          <Layers className="h-4 w-4 text-[#D4A84B]" />
          <span className="whitespace-nowrap">{activeLensDef.shortName}</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#8FA4B8]" />
        </button>
      </div>
    );
  }

  return (
    <aside className="pointer-events-auto absolute top-3 bottom-3 left-3 z-20 flex w-[272px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded border border-[#24364B] bg-[#0D1927]/94 backdrop-blur-md">
      {/* 상단 검색창 + 접기 버튼 */}
      <div className="flex items-center gap-2 border-b border-[#1E2F42] px-3 py-2.5">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#7C93AA]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="시·군, 발전소, 대학 검색..."
            className="w-full rounded border border-[#24374C] bg-[#0A131E] py-1.5 pr-7 pl-8 text-xs text-[#E8E6DF] placeholder-[#6B8299] focus:border-[#D4A84B] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[#7C93AA] hover:text-[#E8E6DF]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="패널 접기"
          aria-label="렌즈 패널 접기"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-[#24374C] bg-[#112030] text-[#9BB0C4] transition-colors hover:border-[#D4A84B]/50 hover:text-[#E8E6DF]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* 검색 결과 드롭다운 */}
      {query.trim().length > 0 && (
        <div className="max-h-72 overflow-y-auto border-b border-[#1E2F42] bg-[#0A141F] px-2 py-2">
          {searchResults.cities.length === 0 &&
          searchResults.facilities.length === 0 &&
          vworldHits.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-[#7C93AA]">
              내장 시·군·시설에 일치 항목이 없습니다.
            </p>
          ) : (
            <div className="space-y-1">
              {searchResults.cities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onJumpToCity(c.id);
                    setQuery('');
                    setVworldHits([]);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#16273A]"
                >
                  <span className="font-medium text-[#ECEAE2]">{c.name}</span>
                  <span className="text-[11px] text-[#7F95AA]">
                    {PROVINCE_META[c.province].shortName}
                  </span>
                </button>
              ))}
              {searchResults.facilities.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onJumpToFacility(f);
                    setQuery('');
                    setVworldHits([]);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#16273A]"
                >
                  <span className="truncate font-medium text-[#F5D684]">{f.name}</span>
                  <span className="shrink-0 pl-2 text-[11px] text-[#7F95AA]">
                    {f.subCategory.split(' ')[0]}
                  </span>
                </button>
              ))}
              {vworldHits.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    onPinPlace?.(place, true);
                    setQuery('');
                    setVworldHits([]);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#16273A]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 text-[#F26B5B]" />
                    <span className="truncate font-medium text-[#FFE4DE]">
                      {place.name}
                    </span>
                  </span>
                  <span className="shrink-0 pl-2 text-[10.5px] text-[#859BB0]">
                    VWorld
                  </span>
                </button>
              ))}
            </div>
          )}

          {vworldEnabled && (
            <div className="mt-2 border-t border-[#182738] pt-2">
              <button
                type="button"
                disabled={vworldBusy}
                onClick={() => void handleQuickVWorld()}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-[#283E56] bg-[#122234] px-2.5 py-1.5 text-[11px] font-medium text-[#F5D684] transition-colors hover:border-[#D4A84B]/60 disabled:opacity-50"
              >
                {vworldBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                <span>VWorld 지오코딩으로 &quot;{query.trim()}&quot; 찾기</span>
              </button>
              {vworldErr && (
                <p className="mt-1 px-1 text-[10.5px] text-[#F0A39A]">{vworldErr}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 활성 렌즈 범례 */}
        <div className="mb-4 border-b border-[#1D2D3F] pb-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold text-[#F0DFB3]">
              {activeLensDef.nameKo}
            </h2>
            <span className="font-mono-num text-[11px] text-[#8399AE]">
              {activeLens === 'history' && historyCtx
                ? historyCtx.mode === 'density'
                  ? `${historyCtx.activeYear} 명/km²`
                  : historyCtx.mode === 'boundaries'
                    ? `${historyCtx.activeYear} 경계`
                    : `${historyCtx.baseYear}→${historyCtx.targetYear} %`
                : activeLensDef.unit}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#9DB0C2]">
            {activeLens === 'history' && historyCtx
              ? historyCtx.mode === 'change'
                ? `${historyCtx.baseYear}년 대비 ${historyCtx.targetYear}년 시군구별 인구 증감률(%)입니다. 신도시 성장축과 인구 감소 지역이 선명하게 대비됩니다.`
                : historyCtx.mode === 'density'
                  ? `${historyCtx.activeYear}년 인구주택총조사 기준 5km 타일 인구밀도(명/km²)입니다. 연도를 전환하며 도시화 변화를 비교하세요.`
                  : `${historyCtx.activeYear}년 SGIS 공식 행정경계(황색)를 현재 2024년 경계(청록색)와 대조합니다. 세종 신설(2012)·청주청원 통합(2014)·군위 대구 편입(2023) 등의 변화를 확인할 수 있습니다.`
              : activeLensDef.description}
          </p>

          {/* 역사 렌즈 전용 타임라인 & 비교 모드 컨트롤 */}
          {activeLens === 'history' && historyCtx && (
            <div className="mt-3 space-y-2.5 border-t border-[#182738] pt-2.5">
              {/* 보기 모드 전환 (기능형 세그먼트 컨트롤) */}
              <div className="grid grid-cols-3 gap-1 rounded bg-[#09121C] p-0.5">
                {[
                  { id: 'change' as const, label: '인구 증감' },
                  { id: 'density' as const, label: '과거 밀도' },
                  { id: 'boundaries' as const, label: '경계 변천' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeHistoryMode?.(m.id)}
                    className={`cursor-pointer rounded-xs py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                      historyCtx.mode === m.id
                        ? 'bg-[#1A2D42] text-[#F5D684]'
                        : 'text-[#8499AE] hover:text-[#DCE4EC]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* 연도 선택 컨트롤 */}
              {historyCtx.mode === 'change' ? (
                <div className="space-y-1.5">
                  <div className="text-[10.5px] text-[#7D93A8]">비교 구간 선택 (SGIS 센서스)</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['2010', '2020'],
                        ['2010', '2024'],
                        ['2015', '2024'],
                      ] as [HistoryCensusYear, HistoryCensusYear][]
                    ).map(([b, t]) => {
                      const active =
                        historyCtx.baseYear === b && historyCtx.targetYear === t;
                      return (
                        <button
                          key={`${b}-${t}`}
                          type="button"
                          onClick={() => onChangeHistoryRange?.(b, t)}
                          className={`font-mono-num cursor-pointer rounded border py-1 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
                            active
                              ? 'border-[#D4A84B] bg-[#1D3147] text-[#F5D684]'
                              : 'border-[#213347] bg-[#0B1622] text-[#A2B4C6] hover:border-[#39536E] hover:text-[#E8E6DF]'
                          }`}
                        >
                          {b}→{t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[10.5px] text-[#7D93A8]">센서스 기준연도</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['2010', '2015', '2020', '2024'] as HistoryCensusYear[]).map((yr) => {
                      const active = historyCtx.activeYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => onChangeHistoryYear?.(yr)}
                          className={`font-mono-num cursor-pointer rounded border py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                            active
                              ? 'border-[#D4A84B] bg-[#1D3147] text-[#F5D684]'
                              : 'border-[#213347] bg-[#0B1622] text-[#A2B4C6] hover:border-[#39536E] hover:text-[#E8E6DF]'
                          }`}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 과거-현재 경계 중첩 토글 */}
              <label className="flex cursor-pointer items-center justify-between text-[11px] text-[#BCCBD9]">
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={historyCtx.compareCurrentBoundaries}
                    onChange={() => onToggleHistoryCompareCurrent?.()}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-[#344B63] bg-[#0B1622] accent-[#D4A84B]"
                  />
                  <span>
                    {historyCtx.mode === 'boundaries'
                      ? '2024 현재 경계와 겹쳐 비교'
                      : `${historyCtx.mode === 'change' ? historyCtx.baseYear : historyCtx.activeYear}년 과거 경계선 표시`}
                  </span>
                </span>
              </label>

              {/* 스냅샷 요약 메타데이터 (무장식 텍스트) */}
              <div className="font-mono-num flex items-center justify-between text-[10.5px] text-[#7E94AA]">
                {historyLoading ? (
                  <span className="flex items-center gap-1.5 text-[#F5D684]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>SGIS 센서스 자료 불러오는 중...</span>
                  </span>
                ) : (
                  <span>
                    {historyCtx.mode === 'change'
                      ? `${historyCtx.baseYear}(${historyCtx.baseSnapshot.sidoCount}시도) → ${historyCtx.targetYear}(${historyCtx.targetSnapshot.sidoCount}시도)`
                      : `${historyCtx.activeYear}년 ${historyCtx.activeSnapshot.sidoCount}개 시도 · ${historyCtx.activeSnapshot.sigunguCount}개 시군구`}
                  </span>
                )}
              </div>
              {historyError && (
                <p className="text-[10.5px] text-[#F0A39A]">{historyError}</p>
              )}
            </div>
          )}

          {/* 색상 범례 바 */}
          <div className="mt-2.5">
            {activeLens === 'history' && historyCtx?.mode === 'boundaries' ? (
              <div className="space-y-1 text-[10.5px] text-[#9EB2C5]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-5 bg-[#F2B84B]" aria-hidden="true" />
                  <span>{historyCtx.activeYear}년 SGIS 과거 행정경계</span>
                </div>
                {historyCtx.compareCurrentBoundaries && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-5 bg-[#67D4E8]" aria-hidden="true" />
                    <span>2024년 SGIS 현재 행정경계</span>
                  </div>
                )}
              </div>
            ) : (
              (() => {
                const stops =
                  activeLens === 'history' && historyCtx?.mode === 'density'
                    ? (LENS_DEFINITIONS.find((l) => l.id === 'population_density')?.legendStops ??
                        activeLensDef.legendStops)
                    : activeLensDef.legendStops;
                return (
                  <>
                    <div className="grid gap-0.5 overflow-hidden rounded-xs" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}>
                      {stops.map((stop) => (
                        <div
                          key={stop.label}
                          className="h-2"
                          style={{ backgroundColor: stop.color }}
                        />
                      ))}
                    </div>
                    <div className="mt-1 grid gap-0.5 text-center" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}>
                      {stops.map((stop) => (
                        <span
                          key={stop.label}
                          className="font-mono-num truncate text-[10px] text-[#8BA0B4]"
                        >
                          {stop.label}
                        </span>
                      ))}
                    </div>
                  </>
                );
              })()
            )}
          </div>

          <p className="mt-2 text-[10.5px] text-[#6D849B]">
            출처: {activeLensDef.sourceLabel}
          </p>
        </div>

        {/* 핵심 문명 렌즈 (5) */}
        <div className="mb-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[#7C93AA]">
            <span>핵심 문명 렌즈</span>
            <span className="font-mono-num">{coreLenses.length}</span>
          </div>
          <div className="space-y-0.5">
            {coreLenses.map((lens) => {
              const isSelected = lens.id === activeLens;
              return (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => onSelectLens(lens.id)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#1D3147] font-semibold text-[#F5D684]'
                      : 'text-[#C2D0DD] hover:bg-[#142334] hover:text-[#F0EEE6]'
                  }`}
                >
                  <span className="truncate">{lens.nameKo}</span>
                  <span
                    className={`font-mono-num ml-2 shrink-0 text-[10.5px] ${
                      isSelected ? 'text-[#D4A84B]' : 'text-[#6D849B]'
                    }`}
                  >
                    {lens.civTerm.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 소득 · 학위 · 문화 · 사회 렌즈 (9) */}
        <div className="mb-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[#7C93AA]">
            <span>소득 · 학위 · 문화 · 사회</span>
            <span className="font-mono-num">{societyLenses.length}</span>
          </div>
          <div className="space-y-0.5">
            {societyLenses.map((lens) => {
              const isSelected = lens.id === activeLens;
              return (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => onSelectLens(lens.id)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#1D3147] font-semibold text-[#F5D684]'
                      : 'text-[#C2D0DD] hover:bg-[#142334] hover:text-[#F0EEE6]'
                  }`}
                >
                  <span className="truncate">{lens.nameKo}</span>
                  <span
                    className={`font-mono-num ml-2 shrink-0 text-[10.5px] ${
                      isSelected ? 'text-[#D4A84B]' : 'text-[#6D849B]'
                    }`}
                  >
                    {lens.unit}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 인프라 · 물류 · 재난 · 역사 렌즈 (6) */}
        <div className="mb-4 border-b border-[#1D2D3F] pb-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[#7C93AA]">
            <span>인프라 · 물류 · 재난 · 역사</span>
            <span className="font-mono-num">{infraLenses.length}</span>
          </div>
          <div className="space-y-0.5">
            {infraLenses.map((lens) => {
              const isSelected = lens.id === activeLens;
              return (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => onSelectLens(lens.id)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#1D3147] font-semibold text-[#F5D684]'
                      : 'text-[#C2D0DD] hover:bg-[#142334] hover:text-[#F0EEE6]'
                  }`}
                >
                  <span className="truncate">{lens.nameKo}</span>
                  <span
                    className={`font-mono-num ml-2 shrink-0 text-[10.5px] ${
                      isSelected ? 'text-[#D4A84B]' : 'text-[#6D849B]'
                    }`}
                  >
                    {lens.unit}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 지도 레이어 토글 */}
        <div>
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            className="mb-2 flex w-full cursor-pointer items-center justify-between text-[11px] font-medium text-[#8FA4B8] hover:text-[#E8E6DF]"
          >
            <span>표시 레이어 · 시설물</span>
            <span>{layersOpen ? '접기' : '펼치기'}</span>
          </button>

          {layersOpen && (
            <div className="space-y-1">
              {LAYER_OPTIONS.map((opt) => {
                const checked = layers[opt.key];
                return (
                  <label
                    key={opt.key}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs text-[#BCCBD9] transition-colors hover:bg-[#132234]"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleLayer(opt.key)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-[#344B63] bg-[#0B1622] accent-[#D4A84B]"
                      />
                      <span>{opt.label}</span>
                    </span>
                    {opt.dotColor && (
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-xs"
                        style={{ backgroundColor: opt.dotColor }}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
