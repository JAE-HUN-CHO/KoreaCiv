import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type {
  FacilityPoint,
  HexTile,
  HistoryCensusYear,
  HistoryViewMode,
  LayerVisibility,
  LensId,
} from './types/civ';
import {
  getKoreaCivWorld,
  rebuildWorldWithLiveApiData,
  type KoreaCivWorld,
} from './engine/hexGrid';
import {
  buildCurrentYearSnapshotFromWorld,
  buildFallbackHistoricalSnapshot,
  buildHistoricalSnapshotFromApi,
  type HistoricalSnapshot,
  type HistoryRenderContext,
} from './engine/history';
import { latLonToKm } from './data/koreaGeography';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { HexMapCanvas, type CameraTarget } from './components/HexMapCanvas';
import { LensSidebar } from './components/LensSidebar';
import { CityViewDrawer } from './components/CityViewDrawer';
import { HoverTooltipCard } from './components/HoverTooltipCard';
import {
  fetchApiStatus,
  fetchLiveBootstrap,
  fetchSgisHistorySnapshot,
  type ApiStatusResponse,
  type CustomMapPin,
  type GeocodedPlaceResult,
  type SgisBoundaryOverlay,
  type SgisHistoryResponse,
} from './services/publicApis';

// 탭을 열 때만 필요한 패널은 별도 청크로 분리해 첫 로딩 JS를 줄임
const AdvisorsModal = lazy(() => import('./components/AdvisorsModal').then((m) => ({ default: m.AdvisorsModal })));
const ExplorerDrawer = lazy(() => import('./components/ExplorerDrawer').then((m) => ({ default: m.ExplorerDrawer })));
const WondersPanel = lazy(() => import('./components/WondersPanel').then((m) => ({ default: m.WondersPanel })));
const SourcesModal = lazy(() => import('./components/SourcesModal').then((m) => ({ default: m.SourcesModal })));
const LiveApiPanel = lazy(() => import('./components/LiveApiPanel').then((m) => ({ default: m.LiveApiPanel })));

const REGION_PRESETS: { id: string; label: string; lat: number; lon: number; zoom: number }[] = [
  { id: 'all', label: '전국', lat: 35.85, lon: 127.75, zoom: 1.28 },
  { id: 'capital', label: '수도권', lat: 37.45, lon: 127.05, zoom: 3.1 },
  { id: 'gangwon', label: '강원', lat: 37.72, lon: 128.45, zoom: 2.3 },
  { id: 'chungcheong', label: '충청', lat: 36.58, lon: 127.15, zoom: 2.5 },
  { id: 'honam', label: '호남', lat: 35.15, lon: 126.95, zoom: 2.3 },
  { id: 'yeongnam', label: '영남', lat: 35.72, lon: 128.78, zoom: 2.3 },
  { id: 'jeju', label: '제주', lat: 33.38, lon: 126.55, zoom: 4.5 },
];

export default function App() {
  const [world, setWorld] = useState<KoreaCivWorld>(() => getKoreaCivWorld());
  const [liveLoading, setLiveLoading] = useState(false);
  const mountedRef = useRef(true);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('map');
  const [activeLens, setActiveLens] = useState<LensId>('terrain');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareCityId, setCompareCityId] = useState<string | null>(null);
  const [pickingCompareFromMap, setPickingCompareFromMap] = useState(false);
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  // 역사 렌즈 상태 (2010 / 2015 / 2020 / 2024 SGIS 센서스)
  const [historyMode, setHistoryMode] = useState<HistoryViewMode>('change');
  const [historyYear, setHistoryYear] = useState<HistoryCensusYear>('2010');
  const [historyBaseYear, setHistoryBaseYear] = useState<HistoryCensusYear>('2010');
  const [historyTargetYear, setHistoryTargetYear] = useState<HistoryCensusYear>('2020');
  const [historyCompareCurrent, setHistoryCompareCurrent] = useState(true);
  const [historyRawByYear, setHistoryRawByYear] = useState<
    Partial<Record<HistoryCensusYear, SgisHistoryResponse>>
  >({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFetchingRef = useRef<Set<string>>(new Set());

  const [hoveredHex, setHoveredHex] = useState<HexTile | null>(null);
  const [hoveredFacility, setHoveredFacility] = useState<FacilityPoint | null>(null);
  const [explorerHoveredCityId, setExplorerHoveredCityId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null);
  const [sgisOverlay, setSgisOverlay] = useState<SgisBoundaryOverlay | null>(null);
  const [customPins, setCustomPins] = useState<CustomMapPin[]>([]);

  const loadLiveWorld = useCallback(async (forceRefresh = false) => {
    setLiveLoading(true);
    try {
      const bootstrap = await fetchLiveBootstrap(forceRefresh);
      if (!mountedRef.current) return;
      const hasAnyLive =
        bootstrap.provinceBoundaries.length > 0 ||
        bootstrap.sigunguBoundaries.length > 0 ||
        bootstrap.sgisStats.length > 0 ||
        bootstrap.kosisLatest.popRows.length > 0 ||
        bootstrap.kosisLatest.grdpBySido.length > 0;
      if (hasAnyLive) {
        const rebuilt = rebuildWorldWithLiveApiData(bootstrap);
        setWorld(rebuilt);
      }
    } catch {
      // 실시간 API 미응답 시 내장 5km 격자 세계를 그대로 유지
    } finally {
      if (mountedRef.current) {
        setLiveLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchApiStatus()
      .then((res) => {
        if (!mountedRef.current) return;
        setApiStatus(res);
        if (res.sgis || res.kosis) {
          void loadLiveWorld(false);
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setApiStatus({
          sgis: false,
          kosis: false,
          vworld: false,
          expectedEnvVars: {
            sgis: ['SGIS_CONSUMER_KEY', 'SGIS_CONSUMER_SECRET'],
            kosis: ['KOSIS_API_KEY'],
            vworld: ['VWORLD_API_KEY'],
          },
        });
      });
    return () => {
      mountedRef.current = false;
    };
  }, [loadLiveWorld]);

  // 역사 렌즈 활성화 또는 연도 변경 시 해당 센서스 연도의 SGIS 실측 데이터 자동 로드
  const ensureHistoryYears = useCallback(
    async (years: HistoryCensusYear[]) => {
      if (!apiStatus?.sgis) return;
      const needed = years.filter(
        (yr) =>
          yr !== '2024' &&
          !historyRawByYear[yr] &&
          !historyFetchingRef.current.has(yr)
      );
      if (needed.length === 0) return;

      needed.forEach((yr) => historyFetchingRef.current.add(yr));
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const results = await Promise.allSettled(
          needed.map(async (yr) => ({ yr, data: await fetchSgisHistorySnapshot(yr) }))
        );
        if (!mountedRef.current) return;
        const nextEntries: Partial<Record<HistoryCensusYear, SgisHistoryResponse>> = {};
        let hadFailure = false;
        for (const res of results) {
          if (res.status === 'fulfilled') {
            nextEntries[res.value.yr] = res.value.data;
          } else {
            hadFailure = true;
          }
        }
        if (Object.keys(nextEntries).length > 0) {
          setHistoryRawByYear((prev) => ({ ...prev, ...nextEntries }));
        }
        if (hadFailure && Object.keys(nextEntries).length === 0) {
          setHistoryError('SGIS 과거 센서스 데이터를 불러오지 못해 추정치로 표시 중입니다.');
        }
      } finally {
        needed.forEach((yr) => historyFetchingRef.current.delete(yr));
        if (mountedRef.current && historyFetchingRef.current.size === 0) {
          setHistoryLoading(false);
        }
      }
    },
    [apiStatus?.sgis, historyRawByYear]
  );

  useEffect(() => {
    if (activeLens !== 'history' || !apiStatus?.sgis) return;
    if (historyMode === 'change') {
      void ensureHistoryYears([historyBaseYear, historyTargetYear]);
    } else {
      void ensureHistoryYears([historyYear]);
    }
  }, [
    activeLens,
    apiStatus?.sgis,
    historyMode,
    historyYear,
    historyBaseYear,
    historyTargetYear,
    ensureHistoryYears,
  ]);

  const historySnapshots = useMemo(() => {
    const out: Record<HistoryCensusYear, HistoricalSnapshot> = {
      '2010': historyRawByYear['2010']
        ? buildHistoricalSnapshotFromApi(historyRawByYear['2010'], world.cities)
        : buildFallbackHistoricalSnapshot('2010', world),
      '2015': historyRawByYear['2015']
        ? buildHistoricalSnapshotFromApi(historyRawByYear['2015'], world.cities)
        : buildFallbackHistoricalSnapshot('2015', world),
      '2020': historyRawByYear['2020']
        ? buildHistoricalSnapshotFromApi(historyRawByYear['2020'], world.cities)
        : buildFallbackHistoricalSnapshot('2020', world),
      '2024': buildCurrentYearSnapshotFromWorld(world),
    };
    return out;
  }, [historyRawByYear, world]);

  const historyCtx: HistoryRenderContext = useMemo(
    () => ({
      mode: historyMode,
      activeYear: historyYear,
      baseYear: historyBaseYear,
      targetYear: historyTargetYear,
      compareCurrentBoundaries: historyCompareCurrent,
      activeSnapshot: historySnapshots[historyYear],
      baseSnapshot: historySnapshots[historyBaseYear],
      targetSnapshot: historySnapshots[historyTargetYear],
    }),
    [
      historyMode,
      historyYear,
      historyBaseYear,
      historyTargetYear,
      historyCompareCurrent,
      historySnapshots,
    ]
  );

  const [layers, setLayers] = useState<LayerVisibility>({
    cityBanners: true,
    wonders: true,
    powerPlants: false,
    ports: false,
    airports: false,
    mines: false,
    nationalParks: false,
    universities: false,
    defenseHubs: false,
    culturalSites: false,
    freightFlows: false,
    rivers: true,
    railways: false,
    provinceBorders: true,
    sigunguBorders: true,
  });

  const handleToggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const flyTo = useCallback((x: number, y: number, zoom: number) => {
    setCameraTarget({ x, y, zoom, nonce: Date.now() + Math.random() });
  }, []);

  const handleSelectCity = useCallback((cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedFacilityId(null);
    setCompareCityId((prev) => (prev === cityId ? null : prev));
  }, []);

  const handlePickCompareCity = useCallback(
    (cityId: string) => {
      if (cityId === selectedCityId) return;
      setCompareCityId(cityId);
      setCompareMode(true);
      setPickingCompareFromMap(false);
    },
    [selectedCityId]
  );

  const handleToggleCompareMode = useCallback(() => {
    setCompareMode((prev) => {
      const next = !prev;
      if (!next) {
        setPickingCompareFromMap(false);
      } else if (!compareCityId && selectedCityId) {
        // 기본 비교 도시 자동 제안 (서울↔부산, 그 외에는 서울 또는 인접 규모 도시)
        const fallbackId = selectedCityId === 'seoul' ? 'busan' : 'seoul';
        if (world.cityMap.has(fallbackId)) {
          setCompareCityId(fallbackId);
        }
      }
      return next;
    });
  }, [compareCityId, selectedCityId, world.cityMap]);

  const handleSwapCompareCities = useCallback(() => {
    if (!selectedCityId || !compareCityId) return;
    const prevA = selectedCityId;
    const prevB = compareCityId;
    setSelectedCityId(prevB);
    setCompareCityId(prevA);
    const nextPrimary = world.cityMap.get(prevB);
    setSelectedHexId(nextPrimary?.centerHexId ?? null);
  }, [selectedCityId, compareCityId, world.cityMap]);

  const handleJumpToCity = useCallback(
    (cityId: string, lens?: LensId) => {
      const city = world.cityMap.get(cityId);
      if (!city) return;
      if (lens) setActiveLens(lens);
      setSelectedCityId(city.id);
      setSelectedHexId(city.centerHexId ?? null);
      setSelectedFacilityId(null);
      flyTo(city.centerX, city.centerY, city.tier === 1 ? 3.2 : 3.6);
    },
    [world.cityMap, flyTo]
  );

  const handleSelectFacility = useCallback(
    (facility: FacilityPoint) => {
      setSelectedFacilityId(facility.id);
      setSelectedCityId(facility.cityId);
      if (facility.hexId) setSelectedHexId(facility.hexId);
      if (facility.x !== undefined && facility.y !== undefined) {
        flyTo(facility.x, facility.y, 3.8);
      }
    },
    [flyTo]
  );

  const handleJumpToFacility = useCallback(
    (facility: FacilityPoint) => {
      // 해당 시설 레이어가 꺼져 있으면 자동으로 활성화
      setLayers((prev) => {
        if (facility.isWonder) return { ...prev, wonders: true };
        if (facility.type === 'power_plant') return { ...prev, powerPlants: true };
        if (facility.type === 'port') return { ...prev, ports: true };
        if (facility.type === 'airport') return { ...prev, airports: true };
        if (facility.type === 'mine') return { ...prev, mines: true };
        if (facility.type === 'national_park') return { ...prev, nationalParks: true };
        if (facility.type === 'university') return { ...prev, universities: true };
        if (facility.type === 'defense_hub') return { ...prev, defenseHubs: true };
        if (facility.type === 'cultural_site') return { ...prev, culturalSites: true };
        return prev;
      });
      handleSelectFacility(facility);
    },
    [handleSelectFacility]
  );

  const handleSelectHex = useCallback((hex: HexTile) => {
    setSelectedHexId(hex.id);
    setSelectedCityId(hex.cityId);
    setSelectedFacilityId(null);
  }, []);

  const handleZoomPreset = useCallback(
    (preset: (typeof REGION_PRESETS)[number]) => {
      const pt = latLonToKm(preset.lat, preset.lon);
      flyTo(pt.x, pt.y, preset.zoom);
    },
    [flyTo]
  );

  // VWorld 지오코딩 결과를 가장 가까운 5km 육각 타일에 스냅하여 핀 추가
  const toCustomPin = useCallback(
    (place: GeocodedPlaceResult): CustomMapPin => {
      const pt = latLonToKm(place.lat, place.lon);
      let nearestHex: HexTile | undefined;
      let bestD2 = Infinity;
      for (const h of world.hexes) {
        const dx = h.x - pt.x;
        const dy = h.y - pt.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          nearestHex = h;
        }
      }
      return {
        ...place,
        x: pt.x,
        y: pt.y,
        hexId: nearestHex?.id,
        cityId: nearestHex?.cityId,
      };
    },
    [world.hexes]
  );

  const handlePinPlace = useCallback(
    (place: GeocodedPlaceResult, shouldFly: boolean) => {
      const pin = toCustomPin(place);
      setCustomPins((prev) => {
        const filtered = prev.filter((p) => p.id !== pin.id && p.name !== pin.name);
        return [...filtered, pin].slice(-30);
      });
      if (pin.hexId) setSelectedHexId(pin.hexId);
      if (pin.cityId) setSelectedCityId(pin.cityId);
      setSelectedFacilityId(null);
      if (shouldFly) {
        flyTo(pin.x, pin.y, 4.0);
      }
    },
    [toCustomPin, flyTo]
  );

  const handlePinBatchPlaces = useCallback(
    (places: GeocodedPlaceResult[]) => {
      const pins = places.map(toCustomPin);
      setCustomPins((prev) => [...prev, ...pins].slice(-40));
      if (pins.length > 0) {
        const first = pins[0];
        if (first.cityId) setSelectedCityId(first.cityId);
        if (first.hexId) setSelectedHexId(first.hexId);
        flyTo(first.x, first.y, 2.2);
      }
    },
    [toCustomPin, flyTo]
  );

  const handleApplySgisOverlay = useCallback(
    (overlay: SgisBoundaryOverlay | null) => {
      setSgisOverlay(overlay);
      if (overlay && overlay.rings.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let cnt = 0;
        for (const ring of overlay.rings) {
          for (const p of ring.points) {
            sumX += p.x;
            sumY += p.y;
            cnt++;
          }
        }
        if (cnt > 0) {
          flyTo(sumX / cnt, sumY / cnt, 2.8);
        }
      }
    },
    [flyTo]
  );

  const dispatchZoomStep = (factor: number) => {
    window.dispatchEvent(new CustomEvent('koreaciv-zoom-step', { detail: { factor } }));
  };

  // ESC 키로 열려있는 모달/드로어 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (sourcesOpen) {
        setSourcesOpen(false);
      } else if (activeTab !== 'map') {
        setActiveTab('map');
      } else if (selectedCityId) {
        setSelectedCityId(null);
        setSelectedHexId(null);
        setSelectedFacilityId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sourcesOpen, activeTab, selectedCityId]);

  const selectedCity = useMemo(
    () => (selectedCityId ? world.cityMap.get(selectedCityId) ?? null : null),
    [selectedCityId, world.cityMap]
  );

  const compareCity = useMemo(
    () => (compareCityId ? world.cityMap.get(compareCityId) ?? null : null),
    [compareCityId, world.cityMap]
  );

  const selectedHex = useMemo(
    () => (selectedHexId ? world.hexMap.get(selectedHexId) ?? null : null),
    [selectedHexId, world.hexMap]
  );

  const selectedFacility = useMemo(
    () =>
      selectedFacilityId
        ? world.facilities.find((f) => f.id === selectedFacilityId) ?? null
        : null,
    [selectedFacilityId, world.facilities]
  );

  const cityFacilities = useMemo(() => {
    if (!selectedCityId) return [];
    return world.facilities.filter((f) => f.cityId === selectedCityId);
  }, [selectedCityId, world.facilities]);

  const hoveredCity = useMemo(
    () => (hoveredHex ? world.cityMap.get(hoveredHex.cityId) : undefined),
    [hoveredHex, world.cityMap]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0B1622] text-[#E8E6DF]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenSources={() => setSourcesOpen(true)}
      />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {/* 풀-뷰포트 5km 육각 격자 지도 */}
        <HexMapCanvas
          world={world}
          activeLens={activeLens}
          layers={layers}
          selectedCityId={selectedCityId}
          compareCityId={compareMode ? compareCityId : null}
          explorerHoveredCityId={activeTab === 'explorer' ? explorerHoveredCityId : null}
          pickingCompareFromMap={pickingCompareFromMap}
          selectedHexId={selectedHexId}
          selectedFacilityId={selectedFacilityId}
          cameraTarget={cameraTarget}
          sgisOverlay={sgisOverlay}
          historyCtx={activeLens === 'history' ? historyCtx : null}
          customPins={customPins}
          onSelectHex={handleSelectHex}
          onSelectCity={handleSelectCity}
          onPickCompareCity={handlePickCompareCity}
          onSelectFacility={handleSelectFacility}
          onHoverHex={setHoveredHex}
          onHoverFacility={setHoveredFacility}
        />

        {/* 좌측 렌즈 · 레이어 사이드바 */}
        {activeTab !== 'explorer' && (
          <LensSidebar
            activeLens={activeLens}
            onSelectLens={setActiveLens}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            cities={world.cities}
            facilities={world.facilities}
            vworldEnabled={Boolean(apiStatus?.vworld)}
            historyCtx={historyCtx}
            historyLoading={historyLoading}
            historyError={historyError}
            onChangeHistoryMode={setHistoryMode}
            onChangeHistoryYear={setHistoryYear}
            onChangeHistoryRange={(base, target) => {
              setHistoryBaseYear(base);
              setHistoryTargetYear(target);
            }}
            onToggleHistoryCompareCurrent={() => setHistoryCompareCurrent((v) => !v)}
            onPinPlace={handlePinPlace}
            onJumpToCity={(id) => handleJumpToCity(id)}
            onJumpToFacility={handleJumpToFacility}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
        )}

        {/* 좌하단 타일/시설 호버 인스펙터 */}
        {activeTab === 'map' && (
          <HoverTooltipCard
            hex={hoveredHex}
            city={hoveredCity}
            facility={hoveredFacility}
            activeLens={activeLens}
            historyCtx={activeLens === 'history' ? historyCtx : null}
            sidebarCollapsed={sidebarCollapsed}
          />
        )}

        {/* 우측 시·군 City View 드로어 (단일 / 분할 비교) */}
        {activeTab !== 'explorer' && (
          <CityViewDrawer
            city={selectedCity}
            compareCity={compareCity}
            compareMode={compareMode}
            pickingCompareFromMap={pickingCompareFromMap}
            allCities={world.cities}
            allFacilities={world.facilities}
            selectedHex={selectedHex}
            selectedFacility={selectedFacility}
            cityFacilities={cityFacilities}
            liveSubdistricts={
              selectedCityId
                ? world.liveMeta?.sgisSubdistrictsByCityId.get(selectedCityId)
                : undefined
            }
            sgisYear={world.liveMeta?.sgisYear ?? null}
            sgisEnabled={Boolean(apiStatus?.sgis)}
            vworldEnabled={Boolean(apiStatus?.vworld)}
            historyCtx={historyCtx}
            onToggleCompareMode={handleToggleCompareMode}
            onTogglePickCompareFromMap={() => setPickingCompareFromMap((v) => !v)}
            onSelectCompareCity={(id) => {
              setCompareCityId(id);
              setPickingCompareFromMap(false);
            }}
            onSwapCompareCities={handleSwapCompareCities}
            onApplySgisOverlay={handleApplySgisOverlay}
            onClose={() => {
              setSelectedCityId(null);
              setCompareMode(false);
              setCompareCityId(null);
              setPickingCompareFromMap(false);
              setSelectedHexId(null);
              setSelectedFacilityId(null);
            }}
            onFocusCity={(c) => flyTo(c.centerX, c.centerY, c.tier === 1 ? 3.2 : 3.7)}
            onFocusFacility={handleJumpToFacility}
          />
        )}

        {/* 우하단 권역 빠른 이동 및 줌 컨트롤 */}
        {activeTab === 'map' && (
          <div
            className={`pointer-events-auto absolute bottom-4 z-20 flex flex-col items-end gap-2 transition-all ${
              selectedCity
                ? compareMode
                  ? 'right-[756px]'
                  : 'right-[376px]'
                : 'right-4'
            }`}
          >
            {/* 권역 점프 바 */}
            <div className="hidden items-center gap-0.5 rounded border border-[#24364B] bg-[#0C1826]/92 p-1 backdrop-blur-md sm:flex">
              {REGION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleZoomPreset(preset)}
                  className="cursor-pointer rounded-xs px-2 py-1 text-[11px] font-medium whitespace-nowrap text-[#A8BACD] transition-colors hover:bg-[#192B40] hover:text-[#F5D684]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* 줌 버튼 + 격자 요약 */}
            <div className="flex items-center gap-2">
              <div className="hidden rounded border border-[#223449] bg-[#0C1826]/88 px-2.5 py-1.5 font-mono-num text-[11px] text-[#8EA4BA] backdrop-blur-sm lg:block">
                5km Hex · {world.stats.totalLandHexes.toLocaleString('ko-KR')}칸
                {world.liveMeta?.isLive
                  ? ` · SGIS ${world.liveMeta.sgisYear ?? '최신'} 경계 · KOSIS ${world.liveMeta.kosisPopYear ?? '최신'}/${world.liveMeta.kosisGrdpYear ?? '최신'}`
                  : liveLoading
                    ? ' · 최신 SGIS·KOSIS 경계 동기화 중'
                    : ` · ${world.stats.totalCities}개 시·군`}
              </div>
              <div className="flex items-center overflow-hidden rounded border border-[#24364B] bg-[#0C1826]/94 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => dispatchZoomStep(1.25)}
                  aria-label="지도 확대"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center text-[#B8C7D6] transition-colors hover:bg-[#192B40] hover:text-[#F5D684]"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => dispatchZoomStep(1 / 1.25)}
                  aria-label="지도 축소"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center border-x border-[#1E2F42] text-[#B8C7D6] transition-colors hover:bg-[#192B40] hover:text-[#F5D684]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoomPreset(REGION_PRESETS[0])}
                  aria-label="한반도 전체 보기"
                  title="한반도 전체 보기"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center text-[#B8C7D6] transition-colors hover:bg-[#192B40] hover:text-[#F5D684]"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 자문관 모달 (9명의 전략 자문관) */}
        {activeTab === 'advisors' && (
          <Suspense fallback={null}>
            <AdvisorsModal
              cities={world.cities}
              facilities={world.facilities}
              onClose={() => setActiveTab('map')}
              onJumpToCity={(cityId, lens) => handleJumpToCity(cityId, lens)}
              onJumpToFacility={handleJumpToFacility}
            />
          </Suspense>
        )}

        {/* 탐색기 (산점도 + 표, 지도 실시간 연동) */}
        {activeTab === 'explorer' && (
          <Suspense fallback={null}>
            <ExplorerDrawer
              cities={world.cities}
              selectedCityId={selectedCityId}
              onSelectCityOnMap={(cityId) => {
                const city = world.cityMap.get(cityId);
                if (!city) return;
                setSelectedCityId(city.id);
                setSelectedHexId(city.centerHexId ?? null);
                // 탐색기 하단 패널에 가리지 않도록 지도를 살짝 위로 올려 중심 배치
                flyTo(city.centerX, city.centerY + 45, 2.8);
              }}
              onHoverCityOnMap={setExplorerHoveredCityId}
              onApplyLens={(lens) => setActiveLens(lens)}
              onClose={() => {
                setExplorerHoveredCityId(null);
                setActiveTab('map');
              }}
            />
          </Suspense>
        )}

        {/* 불가사의 패널 */}
        {activeTab === 'wonders' && (
          <Suspense fallback={null}>
            <WondersPanel
              facilities={world.facilities}
              onJumpToFacility={handleJumpToFacility}
              onClose={() => setActiveTab('map')}
            />
          </Suspense>
        )}

        {/* 실시간 공공 API 패널 (SGIS · KOSIS · VWorld) */}
        {activeTab === 'live_api' && (
          <Suspense fallback={null}>
            <LiveApiPanel
              apiStatus={apiStatus}
              liveMeta={world.liveMeta}
              liveLoading={liveLoading}
              onRefreshLiveWorld={() => void loadLiveWorld(true)}
              activeSgisOverlay={sgisOverlay}
              customPins={customPins}
              onApplySgisOverlay={handleApplySgisOverlay}
              onPinPlace={handlePinPlace}
              onPinBatchPlaces={handlePinBatchPlaces}
              onClearCustomPins={() => setCustomPins([])}
              onClose={() => setActiveTab('map')}
            />
          </Suspense>
        )}

        {/* 출처 및 규칙 모달 ("?") */}
        {sourcesOpen && (
          <Suspense fallback={null}>
            <SourcesModal
              stats={world.stats}
              onClose={() => setSourcesOpen(false)}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}
