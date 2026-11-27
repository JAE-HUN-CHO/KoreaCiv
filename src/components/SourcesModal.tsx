import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { GridStats } from '../types/civ';
import { DATA_SOURCES, EXCLUDED_ITEMS } from '../data/koreaFacilities';
import { CIV_RULES, LENS_DEFINITIONS } from '../data/rules';

interface SourcesModalProps {
  stats: GridStats;
  onClose: () => void;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({ stats, onClose }) => {
  const totalWonders =
    stats.naturalWondersCount +
    stats.academicWondersCount +
    stats.culturalWondersCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040A12]/76 p-4 backdrop-blur-xs">
      <div className="flex h-[min(820px,90vh)] w-[min(980px,96vw)] flex-col overflow-hidden rounded border border-[#293D54] bg-[#0D1927]">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#1E2F42] px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F5E9C8]">
              데이터 출처 · Civ 변환 규칙 (SOURCES &amp; RULES)
            </h2>
            <p className="text-xs text-[#8FA4B8]">
              대한민국 {DATA_SOURCES.length}개 공공데이터를 5km 정육각 격자 위에 통합한 문명 지도 · {LENS_DEFINITIONS.length}개 렌즈 · 9명의 자문관 · {totalWonders}대 불가사의
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="출처 패널 닫기"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] hover:border-[#D4A84B]/60 hover:text-[#E8E6DF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4 text-xs leading-relaxed text-[#C4D3E0]">
          {/* 격자 검증 요약 */}
          <section className="border-b border-[#1E2F42] pb-4">
            <h3 className="mb-2.5 text-sm font-semibold text-[#F0DFB3]">
              01. 격자 구성 및 합계 보존 검증
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-[11px] text-[#7E94AA]">5km 육지 타일 수</div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-[#ECEAE2]">
                  {stats.totalLandHexes.toLocaleString('ko-KR')}칸
                </div>
                <div className="font-mono-num text-[10.5px] text-[#738A9F]">
                  약 {stats.totalLandAreaKm2.toLocaleString('ko-KR')}km² ({stats.hexAreaKm2}km²/칸)
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">집계 도시 (시·군)</div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-[#ECEAE2]">
                  {stats.totalCities}개 도시
                </div>
                <div className="text-[10.5px] text-[#738A9F]">
                  자치구·일반구 통합, 17개 시도
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">GRDP 합계 오차</div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-[#6CC776]">
                  {stats.grdpConservationErrorPct.toFixed(4)}%
                </div>
                <div className="text-[10.5px] text-[#738A9F]">기준: 0.1% 이내 통과</div>
              </div>
              <div>
                <div className="text-[11px] text-[#7E94AA]">시설물 · 불가사의</div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-[#ECEAE2]">
                  {stats.totalFacilities}개 지점
                </div>
                <div className="text-[10.5px] text-[#738A9F]">
                  불가사의 {totalWonders}곳 · 화물축 14노선
                </div>
              </div>
            </div>
          </section>

          {/* Civ 변환 규칙 */}
          <section className="border-b border-[#1E2F42] pb-4">
            <h3 className="mb-2.5 text-sm font-semibold text-[#F0DFB3]">
              02. Civilization 변환 규칙 (rules.ts)
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="border-b border-[#182738] pb-2">
                <div className="font-semibold text-[#ECEAE2]">지형 · 기복 (Terrain &amp; Relief)</div>
                <p className="mt-0.5 text-[#9BB0C4]">
                  토지피복 최다 유형을 Urban·Farmland·Forest·Grassland·Marsh·Barren으로 매핑하고, 칸 내 기복 ≥{CIV_RULES.relief.hillsThresholdM}m는 Hills, ≥{CIV_RULES.relief.mountainThresholdM}m는 Mountain으로 판정합니다.
                </p>
              </div>
              <div className="border-b border-[#182738] pb-2">
                <div className="font-semibold text-[#ECEAE2]">Gold · Production · Science · Faith</div>
                <p className="mt-0.5 text-[#9BB0C4]">
                  시군구 GRDP(Gold)·근로소득·제조업(Production)·대학 R&amp;D·대졸 학위(Science)·종교/유산(Faith·Culture)·기대수명·주택가격·화물 물동량을 20개 렌즈로 변환합니다.
                </p>
              </div>
              <div className="border-b border-[#182738] pb-2 sm:border-b-0">
                <div className="font-semibold text-[#ECEAE2]">특화 지구 (Districts)</div>
                <p className="mt-0.5 text-[#9BB0C4]">
                  입지계수(LQ) {CIV_RULES.district.minLocationQuotient}배 이상이면서 종사자 {CIV_RULES.district.minWorkers.toLocaleString('ko-KR')}명 이상인 산업 상위 {CIV_RULES.district.maxDistrictsPerCity}개를 자동 부여합니다. (Harbor는 무역항 소재 도시 한정)
                </p>
              </div>
              <div>
                <div className="font-semibold text-[#ECEAE2]">불가사의 (15곳) · 시설 아이콘</div>
                <p className="mt-0.5 text-[#9BB0C4]">
                  국립공원 탐방객 상위 {CIV_RULES.wonders.naturalTopN}곳(자연), 대학 연구비 상위 {CIV_RULES.wonders.academicTopN}곳(학문), 유네스코·문화유산 방문객 상위 {CIV_RULES.wonders.culturalTopN}곳(문화·신앙)을 자동 등재하며 발전소는 {CIV_RULES.facilities.powerPlantMinMw}MW 이상만 표시합니다.
                </p>
              </div>
            </div>
          </section>

          {/* 데이터 원천 표 + 공식 포털 링크 */}
          <section className="border-b border-[#1E2F42] pb-4">
            <h3 className="mb-2.5 text-sm font-semibold text-[#F0DFB3]">
              03. {DATA_SOURCES.length}개 공공데이터 출처 (클릭 시 공식 포털 이동)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#223449] text-[11px] text-[#8FA4B8]">
                    <th className="py-2 pr-3 font-medium">항목</th>
                    <th className="py-2 pr-3 font-medium">출처 기관</th>
                    <th className="py-2 pr-3 font-medium">기준연도</th>
                    <th className="py-2 pr-3 font-medium">상태</th>
                    <th className="py-2 font-medium">적용 방식</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#172536]">
                  {DATA_SOURCES.map((src) => (
                    <tr key={src.id} className="hover:bg-[#122132]/60">
                      <td className="py-2 pr-3 font-medium whitespace-nowrap text-[#ECEAE2]">
                        {src.url ? (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#F0DFB3] underline-offset-2 hover:text-[#67D4E8] hover:underline"
                          >
                            <span>{src.item}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                          </a>
                        ) : (
                          src.item
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-[#A8BACD]">
                        {src.agency}
                      </td>
                      <td className="font-mono-num py-2 pr-3 whitespace-nowrap text-[#889EB3]">
                        {src.refYear}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span
                          className={
                            src.status === 'estimated'
                              ? 'font-medium text-[#E8C15A]'
                              : 'font-medium text-[#6CC776]'
                          }
                        >
                          {src.status === 'estimated' ? '추정 반영' : '반영 완료'}
                        </span>
                      </td>
                      <td className="py-2 text-[#94A9BE]">{src.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 제외 항목 및 사유 */}
          <section>
            <h3 className="mb-2.5 text-sm font-semibold text-[#F0DFB3]">
              04. 제외 및 제한 공개 항목 사유
            </h3>
            <div className="space-y-2">
              {EXCLUDED_ITEMS.map((ex) => (
                <div
                  key={ex.item}
                  className="flex flex-col gap-0.5 border-b border-[#172536] pb-2 last:border-b-0 sm:flex-row sm:gap-4"
                >
                  <div className="w-48 shrink-0 font-semibold text-[#D6E0EA]">
                    {ex.item}
                  </div>
                  <div className="text-[#96ABC0]">{ex.reason}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
