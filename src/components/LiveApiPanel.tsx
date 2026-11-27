import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { ProvinceCode } from '../types/civ';
import type { LiveWorldMeta } from '../engine/hexGrid';
import {
  batchGeocodeVWorld,
  fetchKosisTimeseries,
  fetchSgisBoundaryOverlay,
  fetchSgisSubdistricts,
  searchKosisTables,
  searchVWorldPlaces,
  SGIS_PROVINCE_CODES,
  type ApiStatusResponse,
  type CustomMapPin,
  type GeocodedPlaceResult,
  type KosisSearchItem,
  type KosisTimeseriesResponse,
  type SgisBoundaryOverlay,
  type SgisSubdistrictsResponse,
} from '../services/publicApis';

interface LiveApiPanelProps {
  apiStatus: ApiStatusResponse | null;
  liveMeta?: LiveWorldMeta;
  liveLoading?: boolean;
  onRefreshLiveWorld?: () => void;
  activeSgisOverlay: SgisBoundaryOverlay | null;
  customPins: CustomMapPin[];
  onApplySgisOverlay: (overlay: SgisBoundaryOverlay | null) => void;
  onPinPlace: (place: GeocodedPlaceResult, flyToPin: boolean) => void;
  onPinBatchPlaces: (places: GeocodedPlaceResult[]) => void;
  onClearCustomPins: () => void;
  onClose: () => void;
}

type ApiTab = 'sgis' | 'kosis' | 'vworld';

const BATCH_PRESETS: { id: string; label: string; queries: string[] }[] = [
  {
    id: 'semiconductor_clusters',
    label: '첨단 산업단지 · 반도체 클러스터 (8곳)',
    queries: [
      '삼성전자 평택캠퍼스',
      'SK하이닉스 이천캠퍼스',
      '판교테크노밸리',
      '대덕연구개발특구',
      '오송생명과학단지',
      '구미국가산업단지',
      '창원국가산업단지',
      '여수국가산업단지',
    ],
  },
  {
    id: 'mines_energy',
    label: '주요 광산 · 발전 · 에너지 거점 (8곳)',
    queries: [
      '영월 상동광산',
      '태백 장성광업소',
      '단양 한일시멘트',
      '신한울원자력발전소',
      '태안화력발전소',
      '당진화력발전소',
      '양양양수발전소',
      '광양제철소',
    ],
  },
];

function formatSnapshotTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' });
}

export const LiveApiPanel: React.FC<LiveApiPanelProps> = ({
  apiStatus,
  liveMeta,
  liveLoading = false,
  onRefreshLiveWorld,
  activeSgisOverlay,
  customPins,
  onApplySgisOverlay,
  onPinPlace,
  onPinBatchPlaces,
  onClearCustomPins,
  onClose,
}) => {
  const statusLabel = (ok: boolean) =>
    apiStatus?.staticMode ? (ok ? '스냅샷' : '정적 배포 미지원') : ok ? '연결됨' : '키 필요';
  const [tab, setTab] = useState<ApiTab>('sgis');

  // --- SGIS State ---
  const [sgisProvince, setSgisProvince] = useState<ProvinceCode>('seoul');
  const [sgisYear, setSgisYear] = useState(liveMeta?.sgisYear || '2024');
  const [sgisData, setSgisData] = useState<SgisSubdistrictsResponse | null>(null);
  const [sgisLoading, setSgisLoading] = useState(false);
  const [sgisBoundaryLoading, setSgisBoundaryLoading] = useState(false);
  const [sgisError, setSgisError] = useState<string | null>(null);

  // --- KOSIS State ---
  const [kosisIndicator, setKosisIndicator] = useState<
    'grdp_sido' | 'grdp_pc_sido' | 'pop_sido' | 'aging_sido'
  >('grdp_sido');
  const [kosisData, setKosisData] = useState<KosisTimeseriesResponse | null>(null);
  const [kosisLoading, setKosisLoading] = useState(false);
  const [kosisError, setKosisError] = useState<string | null>(null);
  const [kosisQuery, setKosisQuery] = useState('지역내총생산');
  const [kosisSearchItems, setKosisSearchItems] = useState<KosisSearchItem[]>([]);
  const [kosisSearchLoading, setKosisSearchLoading] = useState(false);

  // --- VWorld State ---
  const [vworldQuery, setVworldQuery] = useState('');
  const [vworldMode, setVworldMode] = useState<'place' | 'address'>('place');
  const [vworldResults, setVworldResults] = useState<GeocodedPlaceResult[]>([]);
  const [vworldLoading, setVworldLoading] = useState(false);
  const [vworldError, setVworldError] = useState<string | null>(null);
  const [vworldNotice, setVworldNotice] = useState<string | null>(null);
  const [batchText, setBatchText] = useState('');
  const [batchResult, setBatchResult] = useState<{
    total: number;
    matchedCount: number;
    failed: string[];
    successRatePct: number;
  } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // SGIS 조회 실행
  const handleFetchSgis = async (prov: ProvinceCode = sgisProvince, yr: string = sgisYear) => {
    const meta = SGIS_PROVINCE_CODES[prov];
    setSgisLoading(true);
    setSgisError(null);
    try {
      const res = await fetchSgisSubdistricts(meta.code, yr);
      setSgisData(res);
    } catch (err) {
      setSgisError(err instanceof Error ? err.message : 'SGIS 조회에 실패했습니다.');
    } finally {
      setSgisLoading(false);
    }
  };

  const handleLoadSgisBoundary = async () => {
    const meta = SGIS_PROVINCE_CODES[sgisProvince];
    setSgisBoundaryLoading(true);
    setSgisError(null);
    try {
      const overlay = await fetchSgisBoundaryOverlay(meta.code, meta.name, sgisYear);
      onApplySgisOverlay(overlay);
      onClose();
    } catch (err) {
      setSgisError(err instanceof Error ? err.message : 'SGIS 경계 조회에 실패했습니다.');
    } finally {
      setSgisBoundaryLoading(false);
    }
  };

  // KOSIS 시계열 조회 실행
  const handleFetchKosis = async (
    ind: 'grdp_sido' | 'grdp_pc_sido' | 'pop_sido' | 'aging_sido' = kosisIndicator
  ) => {
    setKosisLoading(true);
    setKosisError(null);
    try {
      const res = await fetchKosisTimeseries(ind, '2018', '2026');
      setKosisData(res);
    } catch (err) {
      setKosisError(err instanceof Error ? err.message : 'KOSIS 조회에 실패했습니다.');
    } finally {
      setKosisLoading(false);
    }
  };

  const handleKosisSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kosisQuery.trim()) return;
    setKosisSearchLoading(true);
    setKosisError(null);
    try {
      const res = await searchKosisTables(kosisQuery.trim());
      setKosisSearchItems(res.items);
    } catch (err) {
      setKosisError(err instanceof Error ? err.message : 'KOSIS 검색에 실패했습니다.');
    } finally {
      setKosisSearchLoading(false);
    }
  };

  // VWorld 단일 지오코딩
  const handleVWorldSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vworldQuery.trim()) return;
    setVworldLoading(true);
    setVworldError(null);
    setVworldNotice(null);
    try {
      const res = await searchVWorldPlaces(vworldQuery.trim(), vworldMode);
      setVworldResults(res.results);
      if (res.fallbackNotice) setVworldNotice(res.fallbackNotice);
      if (res.results.length === 0) {
        setVworldError('일치하는 장소 또는 주소를 찾지 못했습니다.');
      }
    } catch (err) {
      setVworldError(err instanceof Error ? err.message : 'VWorld 검색에 실패했습니다.');
    } finally {
      setVworldLoading(false);
    }
  };

  // VWorld 일괄 지오코딩
  const handleRunBatch = async (queries: string[]) => {
    if (queries.length === 0) return;
    setBatchLoading(true);
    setVworldError(null);
    setVworldNotice(null);
    setBatchResult(null);
    try {
      const res = await batchGeocodeVWorld(queries);
      if (res.fallbackNotice) setVworldNotice(res.fallbackNotice);
      setBatchResult({
        total: res.total,
        matchedCount: res.matchedCount,
        failed: res.failed,
        successRatePct: res.successRatePct,
      });
      if (res.matched.length > 0) {
        onPinBatchPlaces(
          res.matched.map((m, idx) => ({
            id: `batch_${Date.now()}_${idx}`,
            name: m.name,
            address: m.address,
            category: m.category,
            lat: m.lat,
            lon: m.lon,
          }))
        );
      }
    } catch (err) {
      setVworldError(err instanceof Error ? err.message : '일괄 지오코딩에 실패했습니다.');
    } finally {
      setBatchLoading(false);
    }
  };

  // 처음 탭 진입 시 키가 연결되어 있으면 자동 1회 로드
  useEffect(() => {
    if (tab === 'sgis' && apiStatus?.sgis && !apiStatus.staticMode && !sgisData && !sgisLoading) {
      void handleFetchSgis();
    }
    if (tab === 'kosis' && apiStatus?.kosis && !kosisData && !kosisLoading) {
      void handleFetchKosis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, apiStatus]);

  // KOSIS 시계열 피벗 (지역별 연도 목록)
  const kosisPivot = useMemo(() => {
    if (!kosisData) return { years: [] as string[], regions: [] as { name: string; byYear: Record<string, number>; latest: number }[] };
    const yearSet = new Set<string>();
    const regMap = new Map<string, Record<string, number>>();
    for (const r of kosisData.rows) {
      yearSet.add(r.year);
      const map = regMap.get(r.region) ?? {};
      map[r.year] = r.value;
      regMap.set(r.region, map);
    }
    const years = Array.from(yearSet).sort();
    const latestYear = years[years.length - 1];
    const regions = Array.from(regMap.entries())
      .map(([name, byYear]) => ({
        name,
        byYear,
        latest: byYear[latestYear] ?? 0,
      }))
      .sort((a, b) => b.latest - a.latest);
    return { years, regions };
  }, [kosisData]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040A12]/74 p-4 backdrop-blur-xs">
      <div className="flex h-[min(780px,90vh)] w-[min(1040px,96vw)] flex-col overflow-hidden rounded border border-[#293D54] bg-[#0D1927]">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 border-b border-[#1E2F42] px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F5E9C8]">
              실시간 공공 API 연동 (SGIS · KOSIS · VWorld)
            </h2>
            <p className="mt-0.5 text-xs text-[#8FA4B8]">
              {liveMeta?.isLive
                ? `현재 지도에 SGIS ${liveMeta.sgisYear ?? '최신'} 공식 경계(${liveMeta.provinceBoundaries.length}시도·${liveMeta.sigunguBoundaries.length}시군구) 및 KOSIS ${liveMeta.kosisPopYear ?? '최신'} 인구 / ${liveMeta.kosisGrdpYear ?? '최신'} GRDP가 자동 반영되어 있습니다.`
                : apiStatus?.staticMode
                  ? '정적 배포 버전입니다. GitHub Actions가 하루 한 번 받아 둔 공공 API 스냅샷을 읽습니다.'
                  : '서버 프록시(/api/*)를 통해 API 키를 브라우저에 노출하지 않고 최신 통계·행정경계·국토 좌표를 5km 격자에 자동 반영합니다.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onRefreshLiveWorld && !apiStatus?.staticMode && (
              <button
                type="button"
                disabled={liveLoading}
                onClick={onRefreshLiveWorld}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#2C4259] bg-[#132436] px-2.5 py-1.5 text-xs font-medium text-[#F5D684] transition-colors hover:border-[#D4A84B]/70 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
                <span>{liveLoading ? '동기화 중...' : '지도 최신 데이터 새로고침'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="실시간 API 패널 닫기"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] hover:border-[#D4A84B]/60 hover:text-[#E8E6DF]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 탭 바 & 키 연결 상태 요약 (텍스트 전용, 알약 배지 금지) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2F42] bg-[#0A141F] px-5 py-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'sgis' as const, label: 'SGIS 자치구 · 공식경계', ok: apiStatus?.sgis },
              { id: 'kosis' as const, label: 'KOSIS 시계열 · 통계검색', ok: apiStatus?.kosis },
              { id: 'vworld' as const, label: 'VWorld 지오코딩 · 격자 핀', ok: apiStatus?.vworld },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`cursor-pointer rounded px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                  tab === item.id
                    ? 'bg-[#1A2D42] text-[#F5D684]'
                    : 'text-[#96ABC0] hover:bg-[#132234] hover:text-[#ECEAE2]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {apiStatus && (
            <div className="font-mono-num flex items-center gap-2 text-[11px] text-[#859BB0]">
              <span>
                SGIS: <strong className={apiStatus.sgis ? 'text-[#6CC776]' : 'text-[#D97A36]'}>{statusLabel(apiStatus.sgis)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                KOSIS: <strong className={apiStatus.kosis ? 'text-[#6CC776]' : 'text-[#D97A36]'}>{statusLabel(apiStatus.kosis)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                VWorld: <strong className={apiStatus.vworld ? 'text-[#6CC776]' : 'text-[#D97A36]'}>{statusLabel(apiStatus.vworld)}</strong>
              </span>
            </div>
          )}
        </div>

        {apiStatus?.staticMode && (
          <div className="border-b border-[#1E2F42] bg-[#122132] px-5 py-2.5 text-xs text-[#C9D6E2]">
            <span className="font-semibold text-[#F5D684]">정적 배포 모드</span>
            <span className="text-[#9AB0C4]">
              {' '}
              · 키가 필요한 실시간 조회(SGIS 자치구 조회·경계, KOSIS 통계표 검색, VWorld 지오코딩)는 꺼져 있습니다.
              {apiStatus.snapshotGeneratedAt
                ? ` 지도·역사 렌즈·KOSIS 시계열은 ${formatSnapshotTime(apiStatus.snapshotGeneratedAt)} 스냅샷을 사용합니다.`
                : ' 아직 수집된 스냅샷이 없어 내장 데이터로 표시합니다.'}
            </span>
          </div>
        )}

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* ===================== 1. SGIS 탭 ===================== */}
          {tab === 'sgis' && (
            <div className="space-y-4">
              {!apiStatus?.sgis && !apiStatus?.staticMode && (
                <div className="rounded border border-[#3B4E64] bg-[#122132] p-3.5 text-[#C9D6E2]">
                  <div className="font-semibold text-[#F5D684]">SGIS 환경변수 확인</div>
                  <p className="mt-1 text-[#9AB0C4]">
                    AI Studio Secrets에{' '}
                    <code className="font-mono-num text-[#ECEAE2]">SGIS_CONSUMER_KEY</code> (서비스 ID)와{' '}
                    <code className="font-mono-num text-[#ECEAE2]">SGIS_CONSUMER_SECRET</code> (보안 Key) 두 값이 모두 설정되어 있어야 SGIS 실시간 조회가 동작합니다.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 border-b border-[#1E2F42] pb-3.5">
                <select
                  value={sgisProvince}
                  onChange={(e) => setSgisProvince(e.target.value as ProvinceCode)}
                  aria-label="시도 선택"
                  className="rounded border border-[#263A50] bg-[#0A131E] px-2.5 py-1.5 text-xs text-[#ECEAE2] focus:border-[#D4A84B] focus:outline-none"
                >
                  {(Object.keys(SGIS_PROVINCE_CODES) as ProvinceCode[]).map((p) => (
                    <option key={p} value={p}>
                      {SGIS_PROVINCE_CODES[p].name} (코드 {SGIS_PROVINCE_CODES[p].code})
                    </option>
                  ))}
                </select>

                <select
                  value={sgisYear}
                  onChange={(e) => setSgisYear(e.target.value)}
                  aria-label="기준연도 선택"
                  className="font-mono-num rounded border border-[#263A50] bg-[#0A131E] px-2.5 py-1.5 text-xs text-[#ECEAE2] focus:border-[#D4A84B] focus:outline-none"
                >
                  {['2024', '2023', '2022', '2021', '2020', '2019', '2018'].map((y) => (
                    <option key={y} value={y}>
                      {y}년 기준
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void handleFetchSgis()}
                  disabled={sgisLoading}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-[#D4A84B] px-3.5 py-1.5 text-xs font-semibold text-[#0C1622] transition-colors hover:bg-[#E4BC62] disabled:opacity-50"
                >
                  {sgisLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>시군구·자치구 실측 조회</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleLoadSgisBoundary()}
                  disabled={sgisBoundaryLoading}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#2C4259] bg-[#132436] px-3.5 py-1.5 text-xs font-medium text-[#ECEAE2] transition-colors hover:border-[#D4A84B]/60 hover:text-[#F5D684] disabled:opacity-50"
                >
                  {sgisBoundaryLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>공식 SGIS 경계 지도에 겹쳐 보기</span>
                </button>

                {activeSgisOverlay && (
                  <button
                    type="button"
                    onClick={() => onApplySgisOverlay(null)}
                    className="cursor-pointer rounded border border-[#3B2E36] bg-[#1F1820] px-2.5 py-1.5 text-xs text-[#E89B8B] hover:border-[#E87A5D]"
                  >
                    경계 오버레이 해제 ({activeSgisOverlay.label})
                  </button>
                )}
              </div>

              {sgisError && (
                <div className="rounded border border-[#5C2B2B] bg-[#211317] px-3.5 py-2.5 text-[#F0A39A]">
                  {sgisError}
                </div>
              )}

              {sgisData && (
                <div>
                  <div className="mb-2 flex items-baseline justify-between text-[11px] text-[#8FA4B8]">
                    <span>
                      {SGIS_PROVINCE_CODES[sgisProvince].name} 하위 행정구역 {sgisData.count}개 ·{' '}
                      {sgisData.year}년 실측
                    </span>
                    <span>출처: {sgisData.source}</span>
                  </div>
                  <div className="max-h-[440px] overflow-auto border-y border-[#1E2F42]">
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 bg-[#101E2E] text-[11px] text-[#8FA4B8]">
                        <tr className="border-b border-[#223449]">
                          <th className="px-3 py-2 font-medium">자치구 · 시군</th>
                          <th className="px-2 py-2 font-medium">SGIS 코드</th>
                          <th className="px-2.5 py-2 text-right font-medium">총인구 (명)</th>
                          <th className="px-2.5 py-2 text-right font-medium">인구밀도 (/km²)</th>
                          <th className="px-2.5 py-2 text-right font-medium">평균연령</th>
                          <th className="px-2.5 py-2 text-right font-medium">노령화지수</th>
                          <th className="px-2.5 py-2 text-right font-medium">종사자 수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#172536]">
                        {sgisData.items
                          .slice()
                          .sort((a, b) => b.totPpltn - a.totPpltn)
                          .map((row) => (
                            <tr key={row.admCd} className="hover:bg-[#142334]">
                              <td className="px-3 py-1.5 font-medium text-[#ECEAE2]">
                                {row.admNm}
                              </td>
                              <td className="font-mono-num px-2 py-1.5 text-[#7D93A8]">
                                {row.admCd}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-right text-[#F5D684]">
                                {row.totPpltn.toLocaleString('ko-KR')}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-right text-[#D2DDE8]">
                                {Math.round(row.ppltnDnsty).toLocaleString('ko-KR')}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-right text-[#D2DDE8]">
                                {row.avgAge.toFixed(1)}세
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-right text-[#C2D0DD]">
                                {row.agedChildIdx.toFixed(1)}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-right text-[#8DC3E8]">
                                {row.employeeCnt > 0
                                  ? row.employeeCnt.toLocaleString('ko-KR')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== 2. KOSIS 탭 ===================== */}
          {tab === 'kosis' && (
            <div className="space-y-5">
              {!apiStatus?.kosis && !apiStatus?.staticMode && (
                <div className="rounded border border-[#3B4E64] bg-[#122132] p-3.5 text-[#C9D6E2]">
                  <div className="font-semibold text-[#F5D684]">KOSIS 환경변수 확인</div>
                  <p className="mt-1 text-[#9AB0C4]">
                    AI Studio Secrets에{' '}
                    <code className="font-mono-num text-[#ECEAE2]">KOSIS_API_KEY</code>를 등록하면 시도별 GRDP·인구·고령화 실시간 시계열과 KOSIS 통계표 검색이 활성화됩니다.
                  </p>
                </div>
              )}

              {/* 시계열 지표 선택 */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#1E2F42] pb-3.5">
                {[
                  { id: 'grdp_sido' as const, label: '시도별 GRDP' },
                  { id: 'grdp_pc_sido' as const, label: '시도별 1인당 GRDP' },
                  { id: 'pop_sido' as const, label: '시도별 주민등록인구' },
                  { id: 'aging_sido' as const, label: '시도별 고령인구비율' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setKosisIndicator(opt.id);
                      void handleFetchKosis(opt.id);
                    }}
                    className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                      kosisIndicator === opt.id
                        ? 'border-[#D4A84B] bg-[#1F3145] text-[#F5D684]'
                        : 'border-[#24374C] bg-[#0F1D2C] text-[#AFC0D1] hover:text-[#ECEAE2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleFetchKosis()}
                  disabled={kosisLoading}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded bg-[#D4A84B] px-3 py-1.5 text-xs font-semibold text-[#0C1622] hover:bg-[#E4BC62] disabled:opacity-50"
                >
                  {kosisLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>새로고침</span>
                </button>
              </div>

              {kosisError && (
                <div className="rounded border border-[#5C2B2B] bg-[#211317] px-3.5 py-2.5 text-[#F0A39A]">
                  {kosisError}
                </div>
              )}

              {kosisData && kosisPivot.regions.length > 0 && (
                <div>
                  <div className="mb-2 flex items-baseline justify-between text-[11px] text-[#8FA4B8]">
                    <span>
                      {kosisData.label} (단위: {kosisData.unit})
                    </span>
                    <span className="font-mono-num">{kosisData.source}</span>
                  </div>
                  <div className="max-h-64 overflow-auto border-y border-[#1E2F42]">
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 bg-[#101E2E] text-[11px] text-[#8FA4B8]">
                        <tr className="border-b border-[#223449]">
                          <th className="px-3 py-2 font-medium">지역</th>
                          {kosisPivot.years.map((y) => (
                            <th key={y} className="font-mono-num px-2.5 py-2 text-right font-medium">
                              {y}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#172536]">
                        {kosisPivot.regions.slice(0, 20).map((reg) => (
                          <tr key={reg.name} className="hover:bg-[#142334]">
                            <td className="px-3 py-1.5 font-medium whitespace-nowrap text-[#ECEAE2]">
                              {reg.name}
                            </td>
                            {kosisPivot.years.map((y) => (
                              <td
                                key={y}
                                className="font-mono-num px-2.5 py-1.5 text-right whitespace-nowrap text-[#CFDCE8]"
                              >
                                {reg.byYear[y] !== undefined
                                  ? reg.byYear[y].toLocaleString('ko-KR')
                                  : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* KOSIS 통계표 키워드 검색 */}
              <div className="border-t border-[#1E2F42] pt-4">
                <h3 className="mb-2 text-xs font-semibold text-[#F0DFB3]">
                  KOSIS 국가통계표 실시간 검색
                </h3>
                <form onSubmit={handleKosisSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={kosisQuery}
                    onChange={(e) => setKosisQuery(e.target.value)}
                    placeholder="예: 지역내총생산, 시군구 제조업, 고령인구..."
                    className="flex-1 rounded border border-[#24374C] bg-[#0A131E] px-3 py-1.5 text-xs text-[#ECEAE2] placeholder-[#6B8299] focus:border-[#D4A84B] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={kosisSearchLoading}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#2C4259] bg-[#132436] px-3.5 py-1.5 text-xs font-medium text-[#ECEAE2] hover:border-[#D4A84B]/60 hover:text-[#F5D684] disabled:opacity-50"
                  >
                    {kosisSearchLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>통계표 검색</span>
                  </button>
                </form>

                {kosisSearchItems.length > 0 && (
                  <div className="mt-3 max-h-52 divide-y divide-[#172536] overflow-auto border-y border-[#1E2F42]">
                    {kosisSearchItems.map((it) => (
                      <div key={`${it.orgId}-${it.tblId}`} className="py-2 px-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-[#ECEAE2]">{it.tblNm}</span>
                          <span className="font-mono-num shrink-0 text-[10.5px] text-[#D4A84B]">
                            {it.tblId}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#7D93A8]">
                          {it.orgNm} · {it.statNm} · 수록기간 {it.startDe}~{it.endDe}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 3. VWorld 지오코딩 탭 ===================== */}
          {tab === 'vworld' && (
            <div className="space-y-5">
              {!apiStatus?.vworld && !apiStatus?.staticMode && (
                <div className="rounded border border-[#3B4E64] bg-[#122132] p-3.5 text-[#C9D6E2]">
                  <div className="font-semibold text-[#F5D684]">VWorld API 키 확인</div>
                  <p className="mt-1 text-[#9AB0C4]">
                    AI Studio Secrets에{' '}
                    <code className="font-mono-num text-[#ECEAE2]">VWORLD_API_KEY</code>를 설정하면 국토교통부 브이월드 OpenAPI로 장소·주소 좌표 변환, 5km 타일 역지오코딩, 다중 시설 일괄 배치가 동작합니다.
                  </p>
                </div>
              )}

              {/* 단일 검색 → 지도에 핀 꽂기 */}
              <div>
                <h3 className="mb-2 text-xs font-semibold text-[#F0DFB3]">
                  국토교통부 VWorld 장소 · 주소 지오코딩 → 5km 육각 타일 매핑
                </h3>
                <form onSubmit={handleVWorldSearch} className="flex flex-wrap gap-2">
                  <select
                    value={vworldMode}
                    onChange={(e) => setVworldMode(e.target.value as 'place' | 'address')}
                    aria-label="검색 모드"
                    className="rounded border border-[#263A50] bg-[#0A131E] px-2.5 py-1.5 text-xs text-[#ECEAE2]"
                  >
                    <option value="place">장소·시설명</option>
                    <option value="address">도로명·지번 주소</option>
                  </select>
                  <input
                    type="text"
                    value={vworldQuery}
                    onChange={(e) => setVworldQuery(e.target.value)}
                    placeholder="예: 판교테크노밸리, 신한울원자력발전소, 세종시 어진동..."
                    className="min-w-[240px] flex-1 rounded border border-[#24374C] bg-[#0A131E] px-3 py-1.5 text-xs text-[#ECEAE2] placeholder-[#6B8299] focus:border-[#D4A84B] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={vworldLoading}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-[#D4A84B] px-3.5 py-1.5 text-xs font-semibold text-[#0C1622] hover:bg-[#E4BC62] disabled:opacity-50"
                  >
                    {vworldLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>좌표 변환</span>
                  </button>
                </form>

                {vworldNotice && (
                  <div className="mt-2.5 rounded border border-[#3B4E64] bg-[#122132] px-3 py-2 text-[11px] text-[#AFC2D5]">
                    {vworldNotice}
                  </div>
                )}

                {vworldError && (
                  <div className="mt-2.5 rounded border border-[#5C2B2B] bg-[#211317] px-3.5 py-2 text-[#F0A39A]">
                    {vworldError}
                  </div>
                )}

                {vworldResults.length > 0 && (
                  <div className="mt-3 max-h-52 divide-y divide-[#172536] overflow-auto border-y border-[#1E2F42]">
                    {vworldResults.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => {
                          onPinPlace(place, true);
                          onClose();
                        }}
                        className="flex w-full cursor-pointer items-center justify-between px-2.5 py-2 text-left transition-colors hover:bg-[#142334]"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="font-medium text-[#ECEAE2]">{place.name}</div>
                          <div className="truncate text-[11px] text-[#7D93A8]">
                            {place.address || '상세 주소 미표기'} · {place.category}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-right">
                          <span className="font-mono-num text-[11px] text-[#8FA4B8]">
                            {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E
                          </span>
                          <span className="inline-flex items-center gap-1 text-[#F5D684]">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>지도에 표시</span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 일괄 지오코딩 (기획서 M4 기준: 성공률 및 실패 목록 표시) */}
              <div className="border-t border-[#1E2F42] pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#F0DFB3]">
                    시설 목록 일괄 지오코딩 (최대 20건 → 5km 격자 일괄 배치)
                  </h3>
                  {customPins.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearCustomPins}
                      className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-[#E89B8B] hover:text-[#FFBFB2]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>지도 핀 모두 지우기 ({customPins.length}개)</span>
                    </button>
                  )}
                </div>

                <div className="mb-2.5 flex flex-wrap gap-2">
                  {BATCH_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={batchLoading}
                      onClick={() => {
                        setBatchText(preset.queries.join('\n'));
                        void handleRunBatch(preset.queries);
                      }}
                      className="cursor-pointer rounded border border-[#263A50] bg-[#112030] px-2.5 py-1.5 text-[11.5px] text-[#CBD7E3] transition-colors hover:border-[#D4A84B]/60 hover:text-[#F5D684] disabled:opacity-50"
                    >
                      {preset.label} 바로 배치
                    </button>
                  ))}
                </div>

                <textarea
                  rows={4}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="한 줄에 하나씩 발전소·광산·산업단지·주소를 입력하고 일괄 지오코딩을 실행하세요 (최대 20줄)"
                  className="w-full rounded border border-[#24374C] bg-[#0A131E] p-2.5 text-xs text-[#ECEAE2] placeholder-[#657C92] focus:border-[#D4A84B] focus:outline-none"
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={batchLoading || !batchText.trim()}
                    onClick={() =>
                      void handleRunBatch(
                        batchText
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#2C4259] bg-[#132436] px-3.5 py-1.5 text-xs font-medium text-[#ECEAE2] hover:border-[#D4A84B]/60 hover:text-[#F5D684] disabled:opacity-50"
                  >
                    {batchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>입력 목록 일괄 지오코딩 실행</span>
                  </button>

                  {batchResult && (
                    <div className="font-mono-num text-[11px] text-[#A8BACD]">
                      성공 {batchResult.matchedCount}/{batchResult.total}건 (성공률{' '}
                      <strong className="text-[#6CC776]">{batchResult.successRatePct}%</strong>)
                      {batchResult.failed.length > 0 && (
                        <span className="ml-2 text-[#E89B8B]">
                          · 실패: {batchResult.failed.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
