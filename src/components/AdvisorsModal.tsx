import React, { useMemo, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { CityComputed, FacilityPoint, LensId } from '../types/civ';
import { DISTRICT_META, PROVINCE_META } from '../data/rules';
import {
  formatGrdp100M,
  formatManwon,
  formatPopulation,
} from '../utils/formatters';

interface AdvisorsModalProps {
  cities: CityComputed[];
  facilities: FacilityPoint[];
  onClose: () => void;
  onJumpToCity: (cityId: string, lens?: LensId) => void;
  onJumpToFacility?: (facility: FacilityPoint) => void;
}

type AdvisorId =
  | 'economy'
  | 'industry'
  | 'science'
  | 'demographics'
  | 'food_nature'
  | 'energy_logistics'
  | 'culture_faith'
  | 'defense_admin'
  | 'disasters';

const ADVISOR_TABS: { id: AdvisorId; title: string; role: string; lens: LensId }[] = [
  { id: 'economy', title: '경제 자문관', role: 'Gold · GRDP · 소득', lens: 'grdp' },
  { id: 'industry', title: '산업 자문관', role: 'Production · 제조업', lens: 'manufacturing_share' },
  { id: 'science', title: '과학·교육 자문관', role: 'Science · R&D · 학위', lens: 'education' },
  { id: 'demographics', title: '인구·보건 자문관', role: 'Pop · 고령화 · 수명', lens: 'health' },
  { id: 'food_nature', title: '식량·환경 자문관', role: 'Food · 국립공원', lens: 'agriculture_food' },
  { id: 'energy_logistics', title: '에너지·물류 자문관', role: '발전 · 항만 · 화물', lens: 'freight_logistics' },
  { id: 'culture_faith', title: '문화·신앙 자문관', role: 'Culture · Faith · 유산', lens: 'culture' },
  { id: 'defense_admin', title: '안보·행정 자문관', role: 'Defense · 공공행정', lens: 'terrain' },
  { id: 'disasters', title: '재난·안전 자문관', role: 'Disasters · 피해액', lens: 'disaster_damage' },
];

export const AdvisorsModal: React.FC<AdvisorsModalProps> = ({
  cities,
  facilities,
  onClose,
  onJumpToCity,
  onJumpToFacility,
}) => {
  const [activeId, setActiveId] = useState<AdvisorId>('economy');

  const analytics = useMemo(() => {
    const totalPop = cities.reduce((s, c) => s + c.population, 0);
    const totalGrdp = cities.reduce((s, c) => s + c.grdpBillionKrw, 0);
    const metroPop = cities
      .filter((c) => c.province === 'seoul' || c.province === 'incheon' || c.province === 'gyeonggi')
      .reduce((s, c) => s + c.population, 0);
    const metroGrdp = cities
      .filter((c) => c.province === 'seoul' || c.province === 'incheon' || c.province === 'gyeonggi')
      .reduce((s, c) => s + c.grdpBillionKrw, 0);
    const totalPowerMw = cities.reduce((s, c) => s + c.powerCapacityMw, 0);
    const totalRd = cities.reduce((s, c) => s + c.universityRd100M, 0);
    const totalDisaster = cities.reduce((s, c) => s + c.disasterDamage100M, 0);
    const totalFreightMt = cities.reduce((s, c) => s + c.freightVolumeMt, 0);

    const weightedAging =
      cities.reduce((s, c) => s + c.agingRate * c.population, 0) / totalPop;
    const weightedIncome =
      cities.reduce((s, c) => s + c.avgIncomeManwon * c.population, 0) / totalPop;
    const weightedDegree =
      cities.reduce((s, c) => s + c.collegeDegreePct * c.population, 0) / totalPop;
    const weightedLifeExp =
      cities.reduce((s, c) => s + c.lifeExpectancy * c.population, 0) / totalPop;
    const weightedFaith =
      cities.reduce((s, c) => s + c.faithRatePct * c.population, 0) / totalPop;

    const byGrdp = [...cities].sort((a, b) => b.grdpBillionKrw - a.grdpBillionKrw);
    const byIncome = [...cities].sort((a, b) => b.avgIncomeManwon - a.avgIncomeManwon);
    const byMfgShare = [...cities].sort((a, b) => b.shares.manufacturing - a.shares.manufacturing);
    const byMfgWorkers = [...cities].sort(
      (a, b) =>
        b.totalWorkers * b.shares.manufacturing - a.totalWorkers * a.shares.manufacturing
    );
    const byDegree = [...cities].sort((a, b) => b.collegeDegreePct - a.collegeDegreePct);
    const byRd = [...cities].sort((a, b) => b.universityRd100M - a.universityRd100M);
    const byLifeExp = [...cities].sort((a, b) => b.lifeExpectancy - a.lifeExpectancy);
    const byOldest = [...cities].sort((a, b) => b.agingRate - a.agingRate);
    const byAgriShare = [...cities].sort((a, b) => b.shares.agriculture - a.shares.agriculture);
    const byPower = [...cities].sort((a, b) => b.powerCapacityMw - a.powerCapacityMw);
    const byFreight = [...cities].sort((a, b) => b.freightVolumeMt - a.freightVolumeMt);
    const byFaith = [...cities].sort((a, b) => b.faithRatePct - a.faithRatePct);
    const byCulture = [...cities].sort((a, b) => b.cultureScore - a.cultureScore);
    const byHospitality = [...cities].sort((a, b) => b.shares.hospitality - a.shares.hospitality);
    const byPublicAdmin = [...cities].sort((a, b) => b.shares.publicAdmin - a.shares.publicAdmin);
    const byHousing = [...cities].sort((a, b) => b.housingPriceManwon - a.housingPriceManwon);
    const byDisaster = [...cities].sort((a, b) => b.disasterDamage100M - a.disasterDamage100M);

    const industrialCitiesCount = cities.filter((c) =>
      c.districts.some((d) => d.type === 'industrial_zone')
    ).length;
    const campusCitiesCount = cities.filter((c) =>
      c.districts.some((d) => d.type === 'campus')
    ).length;
    const govCitiesCount = cities.filter((c) =>
      c.districts.some((d) => d.type === 'government_plaza')
    ).length;
    const portsCount = facilities.filter((f) => f.type === 'port').length;
    const airportsCount = facilities.filter((f) => f.type === 'airport').length;
    const defenseHubs = facilities
      .filter((f) => f.type === 'defense_hub')
      .sort((a, b) => b.metricValue - a.metricValue);
    const culturalSites = facilities
      .filter((f) => f.type === 'cultural_site')
      .sort((a, b) => b.metricValue - a.metricValue);

    return {
      totalPop,
      totalGrdp,
      metroPopShare: (metroPop / totalPop) * 100,
      metroGrdpShare: (metroGrdp / totalGrdp) * 100,
      avgPerCapita: Math.round((totalGrdp * 10000) / totalPop),
      totalPowerMw,
      totalRd,
      totalDisaster,
      totalFreightMt,
      weightedAging,
      weightedIncome,
      weightedDegree,
      weightedLifeExp,
      weightedFaith,
      byGrdp,
      byIncome,
      byMfgShare,
      byMfgWorkers,
      byDegree,
      byRd,
      byLifeExp,
      byOldest,
      byAgriShare,
      byPower,
      byFreight,
      byFaith,
      byCulture,
      byHospitality,
      byPublicAdmin,
      byHousing,
      byDisaster,
      industrialCitiesCount,
      campusCitiesCount,
      govCitiesCount,
      portsCount,
      airportsCount,
      defenseHubs,
      culturalSites,
    };
  }, [cities, facilities]);

  const activeAdvisor = ADVISOR_TABS.find((t) => t.id === activeId)!;

  const renderRankList = (
    title: string,
    items: CityComputed[],
    metricFn: (c: CityComputed) => string,
    lens: LensId
  ) => (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-[#F0DFB3]">{title}</h4>
      <div className="divide-y divide-[#1A293B] border-y border-[#1E2F42]">
        {items.slice(0, 8).map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              onJumpToCity(c.id, lens);
              onClose();
            }}
            className="flex w-full cursor-pointer items-center justify-between px-2 py-2 text-left text-xs transition-colors hover:bg-[#142334]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="font-mono-num w-5 text-[11px] text-[#6E859C]">
                {idx + 1}
              </span>
              <span className="truncate font-medium text-[#ECEAE2]">{c.name}</span>
              <span className="shrink-0 text-[11px] text-[#788FA4]">
                {PROVINCE_META[c.province].shortName}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono-num font-semibold text-[#E8C15A]">
                {metricFn(c)}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#6F869C]" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040A12]/72 p-4 backdrop-blur-xs">
      <div className="flex h-[min(800px,90vh)] w-[min(1080px,96vw)] flex-col overflow-hidden rounded border border-[#293D54] bg-[#0D1927]">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#1E2F42] px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F5E9C8]">
              국가 전략 자문관 회의 (9명의 자문관)
            </h2>
            <p className="text-xs text-[#8FA4B8]">
              161개 시·군과 20개 공공통계를 바탕으로 9개 국정 분야의 전국 현황과 핵심 거점을 요약합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="자문관 패널 닫기"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] hover:border-[#D4A84B]/60 hover:text-[#E8E6DF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 본문 2단 레이아웃 */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* 좌측 9명의 자문관 목록 */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#1E2F42] bg-[#0A141F] p-2.5 md:w-[228px] md:flex-col md:overflow-y-auto md:border-r md:border-b-0">
            {ADVISOR_TABS.map((tab) => {
              const selected = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveId(tab.id)}
                  className={`shrink-0 cursor-pointer rounded px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-[#192C40] text-[#F5D684]'
                      : 'text-[#A9BCCF] hover:bg-[#122030] hover:text-[#ECEAE2]'
                  }`}
                >
                  <div className="text-xs font-semibold whitespace-nowrap">
                    {tab.title}
                  </div>
                  <div className="mt-0.5 text-[10.5px] whitespace-nowrap text-[#788FA4]">
                    {tab.role}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* 우측 자문관 리포트 */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1E2F42] pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#F5E9C8]">
                  {activeAdvisor.title} 브리핑
                </h3>
                <p className="mt-0.5 text-xs text-[#8FA4B8]">
                  항목을 클릭하면 해당 도시 또는 거점으로 지도가 이동하고 관련 렌즈가 활성화됩니다.
                </p>
              </div>
              <span className="font-mono-num text-[11px] text-[#7D93A8]">
                기준연도: 2022–2025 공공통계
              </span>
            </div>

            {activeId === 'economy' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 border-b border-[#1E2F42] pb-4 sm:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 총 GRDP</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#E8C15A]">
                      {formatGrdp100M(analytics.totalGrdp)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 1인당 GRDP</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {formatManwon(analytics.avgPerCapita)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">평균 근로소득</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#6CC776]">
                      {Math.round(analytics.weightedIncome).toLocaleString('ko-KR')}만원
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">수도권 GRDP 비중</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {analytics.metroGrdpShare.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '총 GRDP 상위 도시 (Gold 규모)',
                    analytics.byGrdp,
                    (c) => formatGrdp100M(c.grdpBillionKrw),
                    'grdp'
                  )}
                  {renderRankList(
                    '1인당 근로소득 상위 도시 (국세청 기준)',
                    analytics.byIncome,
                    (c) => `${c.avgIncomeManwon.toLocaleString('ko-KR')}만원`,
                    'income'
                  )}
                </div>
              </div>
            )}

            {activeId === 'industry' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">산업구역 보유 도시</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#E68A3E]">
                      {analytics.industrialCitiesCount}곳
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">선정 기준</div>
                    <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#ECEAE2]">
                      제조업 LQ ≥ 1.5 · 5천명+
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">핵심 산업 벨트</div>
                    <div className="mt-0.5 text-xs text-[#C4D3E0]">
                      경기 남부 · 충남 북부 · 경북 · 동남권
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '제조업 종사자 비중 최상위 (Production 특화)',
                    analytics.byMfgShare,
                    (c) => `${c.shares.manufacturing.toFixed(1)}%`,
                    'manufacturing_share'
                  )}
                  {renderRankList(
                    '제조업 종사자 총규모 상위 도시',
                    analytics.byMfgWorkers,
                    (c) => `${Math.round((c.totalWorkers * c.shares.manufacturing) / 100000) / 10}만명`,
                    'manufacturing_share'
                  )}
                </div>
              </div>
            )}

            {activeId === 'science' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 주요 대학 연구비</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#6BB5FF]">
                      {(analytics.totalRd / 10000).toFixed(2)}조원
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 대졸+ 학위 비중</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {analytics.weightedDegree.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">Campus 지구 보유 도시</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {analytics.campusCitiesCount}곳
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '대졸 이상 학위 비중 상위 (교육·인적자본)',
                    analytics.byDegree,
                    (c) => `${c.collegeDegreePct.toFixed(1)}%`,
                    'education'
                  )}
                  {renderRankList(
                    '소재 대학 연구비 총액 상위 도시',
                    analytics.byRd,
                    (c) => `${c.universityRd100M.toLocaleString('ko-KR')}억원`,
                    'university_rd'
                  )}
                </div>
              </div>
            )}

            {activeId === 'demographics' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 border-b border-[#1E2F42] pb-4 sm:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 총인구</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {formatPopulation(analytics.totalPop)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 평균 기대수명</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#67D4E8]">
                      {analytics.weightedLifeExp.toFixed(1)}세
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 평균 고령화율</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#E08A52]">
                      {analytics.weightedAging.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">수도권 인구 비중</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#E8C15A]">
                      {analytics.metroPopShare.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '기대수명 최상위 도시 (보건 · 장수 거점)',
                    analytics.byLifeExp,
                    (c) => `${c.lifeExpectancy.toFixed(1)}세`,
                    'health'
                  )}
                  {renderRankList(
                    '고령화율 최상위 지역 (초고령 농어촌)',
                    analytics.byOldest,
                    (c) => `${c.agingRate.toFixed(1)}%`,
                    'aging_rate'
                  )}
                </div>
              </div>
            )}

            {activeId === 'food_nature' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">국립공원 총계</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#6CC776]">
                      23곳 (불가사의 5)
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">농업지구 보유 지역</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {cities.filter((c) => c.districts.some((d) => d.type === 'farming_district')).length}곳
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">핵심 곡창·수산 권역</div>
                    <div className="mt-0.5 text-xs text-[#C4D3E0]">
                      호남평야 · 전남 남해안 · 경북 북부
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '농림어업 종사자 비중 최상위',
                    analytics.byAgriShare,
                    (c) => `${c.shares.agriculture.toFixed(1)}%`,
                    'agriculture_food'
                  )}
                  {renderRankList(
                    '3.3m² 주택 실거래가 상위 (주거 밀집)',
                    analytics.byHousing,
                    (c) => `${c.housingPriceManwon.toLocaleString('ko-KR')}만/평`,
                    'housing'
                  )}
                </div>
              </div>
            )}

            {activeId === 'energy_logistics' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 주요 발전설비 합계</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#F5B547]">
                      {(analytics.totalPowerMw / 1000).toFixed(1)} GW
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">연간 권역 화물 물동량</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#67DAF0]">
                      {Math.round(analytics.totalFreightMt).toLocaleString('ko-KR')} Mt
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">무역항 · 공항 · 화물축</div>
                    <div className="font-mono-num mt-0.5 text-sm font-semibold text-[#ECEAE2]">
                      항만 {analytics.portsCount} · 공항 {analytics.airportsCount} · 14축
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '연간 화물 물동량 상위 (물류 교역 거점)',
                    analytics.byFreight,
                    (c) => `${c.freightVolumeMt.toFixed(1)} Mt`,
                    'freight_logistics'
                  )}
                  {renderRankList(
                    '발전 설비용량 최상위 시·군 (원전·화력·복합)',
                    analytics.byPower,
                    (c) => `${c.powerCapacityMw.toLocaleString('ko-KR')} MW`,
                    'power_capacity'
                  )}
                </div>
              </div>
            )}

            {activeId === 'culture_faith' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">등재 문화유산·박물관 거점</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#E884B8]">
                      {analytics.culturalSites.length}곳 (불가사의 5)
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">전국 평균 종교인구 비중</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#D694F2]">
                      {analytics.weightedFaith.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">핵심 문화 핫스팟 권역</div>
                    <div className="mt-0.5 text-xs text-[#C4D3E0]">
                      서울 궁궐·박물관 · 경주 · 수원 · 전주 · 부여·공주
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '문화유산·박물관 밀도 최상위 (Culture 렌즈)',
                    analytics.byCulture,
                    (c) => `${c.cultureScore}점${c.culturalSiteCount > 0 ? ` · ${c.culturalSiteCount}곳` : ''}`,
                    'culture'
                  )}
                  {renderRankList(
                    '종교인구 비중 상위 지역 (Faith 렌즈)',
                    analytics.byFaith,
                    (c) => `${c.faithRatePct.toFixed(1)}%`,
                    'faith'
                  )}
                </div>
              </div>
            )}

            {activeId === 'defense_admin' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">공개 안보·방위 권역</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#95B574]">
                      {analytics.defenseHubs.length}대 권역
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">Government Plaza 도시</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECEAE2]">
                      {analytics.govCitiesCount}곳
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">공개 범위 원칙</div>
                    <div className="mt-0.5 text-xs text-[#C4D3E0]">
                      보안 좌표 제외, 비기밀 시군구 권역만 표시
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '공공행정·국방 종사자 비중 상위',
                    analytics.byPublicAdmin,
                    (c) => `${c.shares.publicAdmin.toFixed(1)}%`,
                    'terrain'
                  )}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-[#F0DFB3]">
                      10대 공개 안보·전략 권역 (Encampment)
                    </h4>
                    <div className="divide-y divide-[#1A293B] border-y border-[#1E2F42]">
                      {analytics.defenseHubs.slice(0, 8).map((hub, idx) => (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => {
                            if (onJumpToFacility) {
                              onJumpToFacility(hub);
                            } else {
                              onJumpToCity(hub.cityId);
                            }
                            onClose();
                          }}
                          className="flex w-full cursor-pointer items-center justify-between px-2 py-2 text-left text-xs transition-colors hover:bg-[#142334]"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="font-mono-num w-5 text-[11px] text-[#6E859C]">
                              {idx + 1}
                            </span>
                            <span className="truncate font-medium text-[#ECEAE2]">
                              {hub.name}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[11px] text-[#95B574]">
                              {PROVINCE_META[hub.province].shortName}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-[#6F869C]" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeId === 'disasters' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 border-b border-[#1E2F42] pb-4">
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">최근 10년 누적 피해(추정)</div>
                    <div className="font-mono-num mt-0.5 text-lg font-bold text-[#E87A5D]">
                      {(analytics.totalDisaster / 10000).toFixed(1)}조원
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">주요 재해 유형</div>
                    <div className="mt-0.5 text-xs text-[#C4D3E0]">
                      동해안 산불 · 태풍(힌남노 등) · 집중호우
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7E94AA]">데이터 구분</div>
                    <div className="mt-0.5 text-xs text-[#E8C15A]">
                      시도 연보 기반 시군구 추정 배분
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {renderRankList(
                    '10년 누적 자연재해 피해 최상위 지역',
                    analytics.byDisaster,
                    (c) => `${c.disasterDamage100M.toLocaleString('ko-KR')}억원`,
                    'disaster_damage'
                  )}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-[#F0DFB3]">
                      특화 지구(District) 전국 분포 현황
                    </h4>
                    <div className="space-y-2 border-y border-[#1E2F42] py-2.5 text-xs">
                      {(Object.keys(DISTRICT_META) as Array<keyof typeof DISTRICT_META>).map(
                        (dKey) => {
                          const cnt = cities.filter((c) =>
                            c.districts.some((d) => d.type === dKey)
                          ).length;
                          const dm = DISTRICT_META[dKey];
                          return (
                            <div key={dKey} className="flex items-center justify-between">
                              <span className="flex items-center gap-2 text-[#CBD7E3]">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-xs"
                                  style={{ backgroundColor: dm.color }}
                                />
                                <span>{dm.nameEn}</span>
                                <span className="text-[11px] text-[#7D93A8]">
                                  {dm.nameKo}
                                </span>
                              </span>
                              <span className="font-mono-num font-semibold text-[#ECEAE2]">
                                {cnt}개 도시
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
