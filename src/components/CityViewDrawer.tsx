import React, { useEffect, useState } from 'react';
import { Columns2, Compass, Loader2, X } from 'lucide-react';
import type { CityComputed, FacilityPoint, HexTile } from '../types/civ';
import {
  DISTRICT_META,
  PROVINCE_META,
  RELIEF_META,
  TERRAIN_META,
} from '../data/rules';
import {
  formatGrdp100M,
  formatManwon,
  formatPopulation,
} from '../utils/formatters';
import {
  CITY_TO_SGIS_ADM_CD,
  fetchSgisBoundaryOverlay,
  fetchSgisSubdistricts,
  reverseGeocodeVWorld,
  type LiveSgisStatItem,
  type SgisBoundaryOverlay,
  type SgisSubdistrictItem,
  type VWorldReverseResult,
} from '../services/publicApis';
import type { HistoryRenderContext } from '../engine/history';
import { CityCompareSplitView } from './CityCompareSplitView';
import { PolicyCardBanner } from './PolicyCardBanner';

interface CityViewDrawerProps {
  city: CityComputed | null;
  compareCity?: CityComputed | null;
  compareMode?: boolean;
  pickingCompareFromMap?: boolean;
  allCities?: CityComputed[];
  allFacilities?: FacilityPoint[];
  selectedHex: HexTile | null;
  selectedFacility: FacilityPoint | null;
  cityFacilities: FacilityPoint[];
  liveSubdistricts?: LiveSgisStatItem[];
  sgisYear?: string | null;
  sgisEnabled?: boolean;
  vworldEnabled?: boolean;
  historyCtx?: HistoryRenderContext | null;
  onToggleCompareMode?: () => void;
  onTogglePickCompareFromMap?: () => void;
  onSelectCompareCity?: (cityId: string | null) => void;
  onSwapCompareCities?: () => void;
  onApplySgisOverlay?: (overlay: SgisBoundaryOverlay | null) => void;
  onClose: () => void;
  onFocusCity: (city: CityComputed) => void;
  onFocusFacility: (facility: FacilityPoint) => void;
}

const FACILITY_TYPE_LABEL: Record<FacilityPoint['type'], string> = {
  power_plant: '발전소',
  port: '무역항',
  airport: '공항',
  mine: '광산',
  national_park: '국립공원',
  university: '연구대학',
  defense_hub: '안보·방위 권역',
  cultural_site: '문화유산·박물관',
};

export const CityViewDrawer: React.FC<CityViewDrawerProps> = ({
  city,
  compareCity = null,
  compareMode = false,
  pickingCompareFromMap = false,
  allCities = [],
  allFacilities = [],
  selectedHex,
  selectedFacility,
  cityFacilities,
  liveSubdistricts,
  sgisYear = null,
  sgisEnabled = false,
  vworldEnabled = false,
  historyCtx = null,
  onToggleCompareMode,
  onTogglePickCompareFromMap,
  onSelectCompareCity,
  onSwapCompareCities,
  onApplySgisOverlay,
  onClose,
  onFocusCity,
  onFocusFacility,
}) => {
  const [viewMode, setViewMode] = useState<'city' | 'tile'>('city');
  const [sgisRows, setSgisRows] = useState<SgisSubdistrictItem[] | null>(null);
  const [sgisLoading, setSgisLoading] = useState(false);
  const [sgisError, setSgisError] = useState<string | null>(null);
  const [revAddr, setRevAddr] = useState<VWorldReverseResult | null>(null);
  const [revLoading, setRevLoading] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);

  useEffect(() => {
    setSgisRows(null);
    setSgisError(null);
  }, [city?.id]);

  useEffect(() => {
    setRevAddr(null);
    setRevError(null);
  }, [selectedHex?.id]);

  if (!city) return null;

  const sgisCityMeta = CITY_TO_SGIS_ADM_CD[city.id];
  const activeSgisYear = sgisYear || '2024';
  const displayedSubdistricts: SgisSubdistrictItem[] | null =
    sgisRows ??
    (liveSubdistricts && liveSubdistricts.length > 0
      ? liveSubdistricts.slice().sort((a, b) => b.totPpltn - a.totPpltn)
      : null);

  const handleLoadCitySgis = async (withBoundary: boolean) => {
    if (!sgisCityMeta) return;
    setSgisLoading(true);
    setSgisError(null);
    try {
      const res = await fetchSgisSubdistricts(sgisCityMeta.code, activeSgisYear);
      setSgisRows(res.items.slice().sort((a, b) => b.totPpltn - a.totPpltn));
      if (withBoundary && onApplySgisOverlay) {
        const overlay = await fetchSgisBoundaryOverlay(
          sgisCityMeta.code,
          city.name,
          activeSgisYear
        );
        onApplySgisOverlay(overlay);
      }
    } catch (err) {
      setSgisError(err instanceof Error ? err.message : 'SGIS 조회 실패');
    } finally {
      setSgisLoading(false);
    }
  };

  const provMeta = PROVINCE_META[city.province];
  const compareFacilities = compareCity
    ? allFacilities.filter((f) => f.cityId === compareCity.id)
    : [];

  return (
    <aside
      className={`pointer-events-auto absolute top-3 right-3 bottom-3 z-20 flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded border border-[#24364B] bg-[#0D1927]/96 backdrop-blur-md ${
        compareMode ? 'w-[min(740px,calc(100vw-24px))]' : 'w-[360px]'
      }`}
    >
      {/* 도시 헤더 */}
      <div className="border-b border-[#1E2F42] px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {compareMode ? (
              <>
                <div className="text-[11px] text-[#8FA4B8]">
                  시·군 분할 비교 (Split-Screen Comparison)
                </div>
                <h2 className="font-display mt-0.5 truncate text-lg font-bold text-[#F5E9C8]">
                  {city.name}
                  <span className="mx-2 text-sm font-normal text-[#7D93A8]">vs</span>
                  <span className="text-[#8CE6F5]">
                    {compareCity ? compareCity.name : '비교 도시 선택'}
                  </span>
                </h2>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8FA4B8]">
                  <span>{provMeta.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{provMeta.regionGroup}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    {city.hexCount}칸 ({city.areaKm2.toLocaleString('ko-KR')}km²)
                  </span>
                </div>
                <h2 className="font-display mt-0.5 text-xl font-bold text-[#F5E9C8]">
                  {city.name}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#A7B9CA]">
                  {city.summary}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleCompareMode && (
              <button
                type="button"
                onClick={onToggleCompareMode}
                title={compareMode ? '단일 도시 보기로 전환' : '다른 도시와 나란히 비교'}
                className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  compareMode
                    ? 'border-[#67D4E8]/70 bg-[#143040] text-[#9BE8F7]'
                    : 'border-[#26394E] bg-[#122233] text-[#C2D0DD] hover:border-[#D4A84B]/60 hover:text-[#F5D684]'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span>{compareMode ? '단일 보기' : '비교'}</span>
              </button>
            )}
            {!compareMode && (
              <button
                type="button"
                onClick={() => onFocusCity(city)}
                title="이 도시로 지도 이동"
                aria-label="이 도시로 지도 이동"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] transition-colors hover:border-[#D4A84B]/60 hover:text-[#F5D684]"
              >
                <Compass className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="도시 패널 닫기"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] transition-colors hover:border-[#D4A84B]/60 hover:text-[#E8E6DF]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 보기 전환 탭 (단일 도시 모드에서 타일 선택 시) */}
        {!compareMode && selectedHex && (
          <div className="mt-3 flex gap-1 rounded bg-[#09121C] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('city')}
              className={`flex-1 cursor-pointer rounded-xs py-1 text-xs font-medium transition-colors ${
                viewMode === 'city'
                  ? 'bg-[#1A2D42] text-[#F5D684]'
                  : 'text-[#8499AE] hover:text-[#DCE4EC]'
              }`}
            >
              City View (시·군 종합)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tile')}
              className={`flex-1 cursor-pointer rounded-xs py-1 text-xs font-medium transition-colors ${
                viewMode === 'tile'
                  ? 'bg-[#1A2D42] text-[#F5D684]'
                  : 'text-[#8499AE] hover:text-[#DCE4EC]'
              }`}
            >
              선택 타일 ({selectedHex.q}, {selectedHex.r})
            </button>
          </div>
        )}
      </div>

      {/* 본문: 분할 비교 모드 vs 단일 도시 모드 */}
      {compareMode ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <CityCompareSplitView
            cityA={city}
            cityB={compareCity}
            allCities={allCities}
            facilitiesA={cityFacilities}
            facilitiesB={compareFacilities}
            pickingFromMap={pickingCompareFromMap}
            historyCtx={historyCtx}
            onTogglePickFromMap={() => onTogglePickCompareFromMap?.()}
            onSelectCityB={(id) => onSelectCompareCity?.(id)}
            onSwapCities={() => onSwapCompareCities?.()}
            onFocusCity={onFocusCity}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        {/* 선택된 시설물 강조 안내 */}
        {selectedFacility && selectedFacility.cityId === city.id && (
          <div className="mb-4 rounded border border-[#D4A84B]/45 bg-[#192431] p-3">
            <div className="flex items-center justify-between text-[11px] text-[#D4A84B]">
              <span>
                {selectedFacility.isWonder
                  ? selectedFacility.wonderKind === 'natural'
                    ? `자연 불가사의 #${selectedFacility.wonderRank}`
                    : selectedFacility.wonderKind === 'academic'
                      ? `학문 불가사의 #${selectedFacility.wonderRank}`
                      : `문화·신앙 불가사의 #${selectedFacility.wonderRank}`
                  : FACILITY_TYPE_LABEL[selectedFacility.type]}
              </span>
              <span className="text-[#8FA4B8]">{selectedFacility.subCategory}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-[#F7EBC6]">
                {selectedFacility.name}
              </div>
              <div className="font-mono-num text-xs font-semibold text-[#F5D684]">
                {selectedFacility.metricValue.toLocaleString('ko-KR')}{' '}
                {selectedFacility.metricUnit}
              </div>
            </div>
            <div className="mt-1 text-[10.5px] text-[#7D93A8]">
              {selectedFacility.metricLabel} · {selectedFacility.sourceNote}
            </div>
          </div>
        )}

        {viewMode === 'tile' && selectedHex ? (
          /* ===================== 타일 상세 탭 ===================== */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 border-b border-[#1E2F42] pb-3.5">
              <div>
                <div className="text-[11px] text-[#7E94AA]">지형 (토지피복)</div>
                <div className="mt-0.5 text-sm font-semibold text-[#ECEAE2]">
                  {TERRAIN_META[selectedHex.terrain].nameKo}
                </div>
                <div className="font-mono-num text-[11px] text-[#8FA4B8]">
                  {TERRAIN_META[selectedHex.terrain].civName}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">기복 · 표고 (DEM)</div>
                <div className="mt-0.5 text-sm font-semibold text-[#ECEAE2]">
                  {RELIEF_META[selectedHex.relief].civName}
                </div>
                <div className="font-mono-num text-[11px] text-[#8FA4B8]">
                  평균 {selectedHex.elevationM}m · 기복 Δ{selectedHex.reliefM}m
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-[#D6E0EA]">
                5km 타일 배분 산출량
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-[#1E2F42] pb-3.5 text-xs">
                <div>
                  <span className="text-[#889EB3]">Gold (타일 GRDP)</span>
                  <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#E8C15A]">
                    {formatGrdp100M(selectedHex.grdp100M)}
                  </div>
                </div>
                <div>
                  <span className="text-[#889EB3]">Population (격자 인구)</span>
                  <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#E8E6DF]">
                    {formatPopulation(selectedHex.population)}
                  </div>
                </div>
                <div>
                  <span className="text-[#889EB3]">Production (제조 종사자)</span>
                  <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#E68A3E]">
                    {selectedHex.manufacturingWorkers.toLocaleString('ko-KR')}명
                  </div>
                </div>
                <div>
                  <span className="text-[#889EB3]">인구밀도</span>
                  <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#78B5E8]">
                    {selectedHex.populationDensity.toLocaleString('ko-KR')}명/km²
                  </div>
                </div>
                <div>
                  <span className="text-[#889EB3]">Culture (문화유산 밀도)</span>
                  <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#E884B8]">
                    {selectedHex.cultureDensity}점
                  </div>
                </div>
                <div>
                  <span className="text-[#889EB3]">반경 25km 문화 거점</span>
                  <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#F0D4A8]">
                    {selectedHex.nearbyCulturalCount}곳
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-[11.5px] text-[#8FA4B8]">
              <div className="flex justify-between">
                <span>격자 ID (q, r)</span>
                <span className="font-mono-num text-[#D6E0EA]">
                  ({selectedHex.q}, {selectedHex.r})
                </span>
              </div>
              <div className="flex justify-between">
                <span>중심 좌표 (WGS84)</span>
                <span className="font-mono-num text-[#D6E0EA]">
                  {selectedHex.lat.toFixed(3)}°N, {selectedHex.lon.toFixed(3)}°E
                </span>
              </div>
              <div className="flex justify-between">
                <span>육지 비율 · 해안 여부</span>
                <span className="font-mono-num text-[#D6E0EA]">
                  {Math.round(selectedHex.landFraction * 100)}% ·{' '}
                  {selectedHex.isCoastal ? '해안' : '내륙'}
                </span>
              </div>
            </div>

            {vworldEnabled && (
              <div className="border-t border-[#1E2F42] pt-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#D6E0EA]">
                    VWorld 실제 주소 확인 (역지오코딩)
                  </h3>
                  <button
                    type="button"
                    disabled={revLoading}
                    onClick={async () => {
                      setRevLoading(true);
                      setRevError(null);
                      try {
                        const res = await reverseGeocodeVWorld(selectedHex.lat, selectedHex.lon);
                        setRevAddr(res);
                      } catch (err) {
                        setRevError(err instanceof Error ? err.message : 'VWorld 역지오코딩 실패');
                      } finally {
                        setRevLoading(false);
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#2B4057] bg-[#132436] px-2 py-1 text-[11px] font-medium text-[#F5D684] hover:border-[#D4A84B]/60 disabled:opacity-50"
                  >
                    {revLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>주소 조회</span>
                  </button>
                </div>
                {revError && (
                  <p className="text-[11px] text-[#F0A39A]">{revError}</p>
                )}
                {revAddr && (
                  <div className="space-y-1 text-[11.5px] text-[#C6D3DF]">
                    {revAddr.roadAddress && (
                      <div>
                        <span className="text-[#7E94AA]">도로명: </span>
                        <span>{revAddr.roadAddress}</span>
                      </div>
                    )}
                    {revAddr.parcelAddress && (
                      <div>
                        <span className="text-[#7E94AA]">지번: </span>
                        <span>{revAddr.parcelAddress}</span>
                      </div>
                    )}
                    {!revAddr.roadAddress && !revAddr.parcelAddress && (
                      <div className="text-[#8FA4B8]">
                        해당 타일 중심(수역·산악 경계)에 일치하는 필지 주소가 없습니다.
                      </div>
                    )}
                    <div className="pt-0.5 text-[10.5px] text-[#6E859C]">
                      출처: {revAddr.source}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ===================== 시·군 종합 City View ===================== */
          <div className="space-y-5">
            {/* 핵심 4대 지표 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[#1E2F42] pb-4">
              <div>
                <div className="text-[11px] text-[#7E94AA]">
                  인구 {city.livePopYear ? `(${city.livePopYear} 실측)` : '(Population)'}
                </div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-[#F0EEE6]">
                  {formatPopulation(city.population)}
                </div>
                <div className="font-mono-num text-[10.5px] text-[#788FA4]">
                  밀도 {city.populationDensity.toLocaleString('ko-KR')}명/km²
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">
                  GRDP {city.liveGrdpYear ? `(${city.liveGrdpYear} 최신)` : '(Gold)'}
                </div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-[#E8C15A]">
                  {formatGrdp100M(city.grdpBillionKrw)}
                </div>
                <div className="font-mono-num text-[10.5px] text-[#788FA4]">
                  1인당 {formatManwon(city.grdpPerCapitaManwon)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">종사자 · 제조업</div>
                <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#E68A3E]">
                  {city.shares.manufacturing.toFixed(1)}% 제조업
                </div>
                <div className="font-mono-num text-[10.5px] text-[#788FA4]">
                  총 {(city.totalWorkers / 10000).toFixed(1)}만명
                  {city.liveCorpCnt && city.liveCorpCnt > 0
                    ? ` · 사업체 ${(city.liveCorpCnt / 1000).toFixed(1)}천`
                    : ' 종사'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">
                  고령화율 {city.liveAgingYear ? `(${city.liveAgingYear})` : '(65세+)'}
                </div>
                <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#DCE4EC]">
                  {city.agingRate.toFixed(1)}%
                </div>
                <div className="font-mono-num text-[10.5px] text-[#788FA4]">
                  {city.liveAvgAge && city.liveAvgAge > 0
                    ? `평균연령 ${city.liveAvgAge.toFixed(1)}세`
                    : city.agingRate >= 35
                      ? '초고령 지역'
                      : city.agingRate >= 20
                        ? '초고령 사회'
                        : '청년·생산연령 우세'}
                </div>
              </div>
            </div>

            {/* 주력 산업 기반 지역 고유 정책 카드 (Policy Card) */}
            <div className="border-b border-[#1E2F42] pb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-[#F0DFB3]">
                  지역 정책 카드 (Policy Card)
                </h3>
                <span className="text-[10.5px] text-[#738A9F]">
                  주력 산업 패시브 보너스
                </span>
              </div>
              <PolicyCardBanner card={city.policyCard} />
            </div>

            {/* 규칙 기반 특화 지구 (Districts) */}
            <div className="border-b border-[#1E2F42] pb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-[#F0DFB3]">
                  특화 지구 (Districts)
                </h3>
                <span className="font-mono-num text-[10.5px] text-[#738A9F]">
                  규칙: LQ ≥ 1.5 · 5천명+
                </span>
              </div>

              {city.districts.length === 0 ? (
                <p className="text-xs leading-relaxed text-[#7F95AA]">
                  입지계수 1.5 이상이면서 종사자 5,000명을 넘는 특화 산업 지구가 없습니다 (균형형 또는 소규모 지역).
                </p>
              ) : (
                <div className="space-y-2">
                  {city.districts.map((dist) => {
                    const meta = DISTRICT_META[dist.type];
                    return (
                      <div
                        key={dist.type}
                        className="flex items-center justify-between border-b border-[#182636] pb-2 last:border-b-0 last:pb-0"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2.5 w-2.5 rounded-xs"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="text-xs font-semibold text-[#ECEAE2]">
                              {meta.nameEn}
                            </span>
                            <span className="text-[11px] text-[#8FA4B8]">
                              {meta.nameKo}
                            </span>
                          </div>
                          <div className="mt-0.5 pl-4.5 text-[11px] text-[#7D93A8]">
                            {meta.yieldLabel} · 종사자{' '}
                            <span className="font-mono-num text-[#B5C6D6]">
                              {dist.workers.toLocaleString('ko-KR')}명
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="font-mono-num text-xs font-semibold"
                            style={{ color: meta.color }}
                          >
                            LQ {dist.lq.toFixed(2)}×
                          </div>
                          <div className="font-mono-num text-[10.5px] text-[#7B91A6]">
                            비중 {dist.sharePct.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 시민 구성 ("N명 중 1명" vs 전국 평균) */}
            <div className="border-b border-[#1E2F42] pb-4">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-[#F0DFB3]">
                  시민 구성 (Citizens)
                </h3>
                <span className="text-[10.5px] text-[#738A9F]">
                  지역 비중 vs 전국 평균
                </span>
              </div>

              <div className="space-y-2.5">
                {city.citizens.map((cit) => {
                  const maxBar = Math.max(cit.sharePct, cit.nationalSharePct, 35);
                  const localW = Math.min(100, (cit.sharePct / maxBar) * 100);
                  const natW = Math.min(100, (cit.nationalSharePct / maxBar) * 100);
                  const isSpecialized = cit.lq >= 1.5;

                  return (
                    <div key={cit.industry}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate text-[#D2DDE8]">
                          {cit.labelKo}
                        </span>
                        <span className="font-mono-num shrink-0 text-[11px]">
                          <span
                            className={
                              isSpecialized
                                ? 'font-semibold text-[#F5D684]'
                                : 'text-[#DCE4EC]'
                            }
                          >
                            {cit.oneInN < 100 ? `${cit.oneInN}명 중 1명` : `${cit.sharePct.toFixed(1)}%`}
                          </span>
                          <span className="text-[#6F869C]">
                            {' '}
                            / 전국 {cit.nationalOneInN}명 중 1명
                          </span>
                        </span>
                      </div>
                      <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-[#132234]">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${localW}%`,
                            backgroundColor: isSpecialized ? '#D4A84B' : '#4E779E',
                          }}
                        />
                        {/* 전국 평균 기준선 */}
                        <div
                          title={`전국 평균 ${cit.nationalSharePct}%`}
                          className="absolute top-0 bottom-0 w-[2px] bg-[#E8E6DF]/80"
                          style={{ left: `${natW}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10.5px] text-[#6E859C]">
                흰색 세로선은 전국 평균 비중입니다. 금색 막대는 입지계수(LQ) 1.5배 이상 특화 산업입니다.
              </p>
            </div>

            {/* 소득 · 교육 · 보건 · 주거 · 신앙 · 물류 6대 사회지표 */}
            <div className="border-b border-[#1E2F42] pb-4">
              <h3 className="mb-2 text-xs font-semibold text-[#F0DFB3]">
                생활 · 사회 · 물류 지표 (6대 렌즈)
              </h3>
              <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 text-xs">
                <div>
                  <div className="text-[10.5px] text-[#7D93A8]">평균 근로소득</div>
                  <div className="font-mono-num mt-0.5 font-semibold text-[#6CC776]">
                    {city.avgIncomeManwon.toLocaleString('ko-KR')}만원
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#7D93A8]">대졸+ 학위</div>
                  <div className="font-mono-num mt-0.5 font-semibold text-[#6BB5FF]">
                    {city.collegeDegreePct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#7D93A8]">기대수명</div>
                  <div className="font-mono-num mt-0.5 font-semibold text-[#67D4E8]">
                    {city.lifeExpectancy.toFixed(1)}세
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#7D93A8]">주택가(3.3m²)</div>
                  <div className="font-mono-num mt-0.5 font-semibold text-[#E8C15A]">
                    {city.housingPriceManwon.toLocaleString('ko-KR')}만
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#7D93A8]">종교인구</div>
                  <div className="font-mono-num mt-0.5 font-semibold text-[#D694F2]">
                    {city.faithRatePct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#7D93A8]">화물 물동량</div>
                  <div className="font-mono-num mt-0.5 font-semibold text-[#8CE6F5]">
                    {city.freightVolumeMt.toFixed(1)} Mt
                  </div>
                </div>
              </div>
            </div>

            {/* 인프라 · 연구 · 문화 · 재해 지표 */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-[#1E2F42] pb-4 text-xs">
              <div>
                <div className="text-[10.5px] text-[#7D93A8]">문화유산 밀도 · 거점</div>
                <div className="font-mono-num mt-0.5 font-semibold text-[#E884B8]">
                  {city.cultureScore}점
                  <span className="ml-1.5 text-[10.5px] font-normal text-[#8FA4B8]">
                    ({city.culturalSiteCount}곳 소재)
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[#7D93A8]">발전 설비</div>
                <div className="font-mono-num mt-0.5 font-semibold text-[#F5B547]">
                  {city.powerCapacityMw.toLocaleString('ko-KR')} MW
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[#7D93A8]">대학 연구비</div>
                <div className="font-mono-num mt-0.5 font-semibold text-[#6BB5FF]">
                  {city.universityRd100M.toLocaleString('ko-KR')}억
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[#7D93A8]">10년 재해피해</div>
                <div className="font-mono-num mt-0.5 font-semibold text-[#E87A5D]">
                  {city.disasterDamage100M.toLocaleString('ko-KR')}억
                </div>
              </div>
            </div>

            {/* 지역 내 불가사의 & 시설물 목록 */}
            {cityFacilities.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold text-[#F0DFB3]">
                  소재 불가사의 · 주요 시설 ({cityFacilities.length})
                </h3>
                <div className="space-y-1.5">
                  {cityFacilities.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onFocusFacility(f)}
                      className="flex w-full cursor-pointer items-center justify-between rounded border border-[#1E2F42] bg-[#101E2E] px-2.5 py-2 text-left transition-colors hover:border-[#D4A84B]/50 hover:bg-[#16273B]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-xs font-medium text-[#ECEAE2]">
                          {f.isWonder && (
                            <span className="mr-1.5 text-[#F5D684]">★</span>
                          )}
                          {f.name}
                        </div>
                        <div className="text-[10.5px] text-[#7F95AA]">
                          {FACILITY_TYPE_LABEL[f.type]} · {f.subCategory}
                        </div>
                      </div>
                      <div className="font-mono-num shrink-0 text-right text-[11px] font-medium text-[#D4A84B]">
                        {f.metricValue.toLocaleString('ko-KR')} {f.metricUnit}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SGIS 실시간 자치구·일반구 세분화 조회 */}
            {(sgisCityMeta || (displayedSubdistricts && displayedSubdistricts.length > 1)) && (
              <div className="border-t border-[#1E2F42] pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#F0DFB3]">
                    SGIS {activeSgisYear} 자치구 · 일반구 실측
                    {displayedSubdistricts && displayedSubdistricts.length > 1
                      ? ` (${displayedSubdistricts.length}개)`
                      : sgisCityMeta
                        ? ` (${sgisCityMeta.label})`
                        : ''}
                  </h3>
                  {sgisCityMeta && (
                    <span className="font-mono-num text-[10px] text-[#788FA4]">
                      코드 {sgisCityMeta.code}
                    </span>
                  )}
                </div>

                {sgisCityMeta && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      disabled={sgisLoading || !sgisEnabled}
                      onClick={() => void handleLoadCitySgis(false)}
                      className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-[#283E56] bg-[#122234] px-2.5 py-1.5 text-[11px] font-medium text-[#DCE4EC] transition-colors hover:border-[#D4A84B]/60 hover:text-[#F5D684] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sgisLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>구별 실측 새로고침</span>
                    </button>
                    <button
                      type="button"
                      disabled={sgisLoading || !sgisEnabled}
                      onClick={() => void handleLoadCitySgis(true)}
                      className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-[#283E56] bg-[#122234] px-2.5 py-1.5 text-[11px] font-medium text-[#8BE4F2] transition-colors hover:border-[#8BE4F2]/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>구별 경계 라벨 겹치기</span>
                    </button>
                  </div>
                )}

                {!sgisEnabled && !displayedSubdistricts && (
                  <p className="mt-1.5 text-[10.5px] text-[#7D93A8]">
                    SGIS 키가 설정되면 이 도시의 하위 자치구·일반구 실측 인구와 경계를 불러올 수 있습니다.
                  </p>
                )}

                {sgisError && (
                  <p className="mt-1.5 text-[11px] text-[#F0A39A]">{sgisError}</p>
                )}

                {displayedSubdistricts && displayedSubdistricts.length > 0 && (
                  <div className="mt-2.5 max-h-48 divide-y divide-[#182738] overflow-auto border-y border-[#1E2F42] text-[11px]">
                    {displayedSubdistricts.map((row) => (
                      <div
                        key={row.admCd}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="truncate pr-2 text-[#DCE4EC]">
                          {row.admNm.split(' ').pop() || row.admNm}
                        </span>
                        <span className="font-mono-num shrink-0 text-[#9BB0C4]">
                          <strong className="text-[#F5D684]">
                            {(row.totPpltn / 10000).toFixed(1)}만
                          </strong>{' '}
                          · 평균 {row.avgAge.toFixed(1)}세
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 출처 각주 */}
            <div className="pt-1 text-[10.5px] leading-relaxed text-[#677D93]">
              출처:{' '}
              {city.livePopYear || city.liveGrdpYear
                ? `실시간 반영 — SGIS ${activeSgisYear} 공식 행정경계·통계 · KOSIS 주민등록인구(${city.livePopYear || '2025'}) · 고령화율(${city.liveAgingYear || '2025'}) · GRDP(${city.liveGrdpYear || '2024'}) · EPSIS · 대학알리미`
                : '국가데이터처 KOSIS (GRDP, 사업체조사) · 행정안전부 주민등록인구 · SGIS OpenAPI · EPSIS · 대학알리미'}
            </div>
          </div>
        )}
      </div>
      )}
    </aside>
  );
};
