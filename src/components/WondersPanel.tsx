import React, { useMemo, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { FacilityPoint } from '../types/civ';
import { PROVINCE_META } from '../data/rules';

interface WondersPanelProps {
  facilities: FacilityPoint[];
  onJumpToFacility: (facility: FacilityPoint) => void;
  onClose: () => void;
}

export const WondersPanel: React.FC<WondersPanelProps> = ({
  facilities,
  onJumpToFacility,
  onClose,
}) => {
  const [tab, setTab] = useState<'wonders' | 'parks' | 'universities' | 'cultural'>('wonders');

  const { naturalWonders, academicWonders, culturalWonders, allParks, allUnivs, allCultural } =
    useMemo(() => {
      const parks = facilities
        .filter((f) => f.type === 'national_park')
        .sort((a, b) => b.metricValue - a.metricValue);
      // 신규 318개 대학은 "교원 1인당 연구비"(만원)라 기존 24개 "연간 총 연구비"
      // (억원)와 단위가 달라 숫자로 바로 비교 불가 — 단위가 같은 것끼리만 모아
      // 정렬하고, 기존 24개(연간 총액) 그룹을 항상 위에 둠
      const univs = facilities
        .filter((f) => f.type === 'university')
        .sort((a, b) => {
          if (a.metricUnit !== b.metricUnit) {
            return a.metricUnit === '억원/년' ? -1 : 1;
          }
          return b.metricValue - a.metricValue;
        });
      const cultural = facilities
        .filter((f) => f.type === 'cultural_site')
        .sort((a, b) => b.metricValue - a.metricValue);
      return {
        naturalWonders: parks.filter((p) => p.isWonder),
        academicWonders: univs.filter((u) => u.isWonder),
        culturalWonders: cultural.filter((c) => c.isWonder),
        allParks: parks,
        allUnivs: univs,
        allCultural: cultural,
      };
    }, [facilities]);

  const totalWonders =
    naturalWonders.length + academicWonders.length + culturalWonders.length;

  const handleClick = (f: FacilityPoint) => {
    onJumpToFacility(f);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040A12]/72 p-4 backdrop-blur-xs">
      <div className="flex h-[min(760px,88vh)] w-[min(1120px,96vw)] flex-col overflow-hidden rounded border border-[#293D54] bg-[#0D1927]">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#1E2F42] px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F5E9C8]">
              대한민국의 불가사의 (Wonders · Top {totalWonders})
            </h2>
            <p className="text-xs text-[#8FA4B8]">
              수동 선정 없이 공개 통계 규칙으로 자동 등재됩니다: 국립공원 탐방객 상위 5곳 · 대학 연구비 상위 5곳 · 문화유산·신앙 거점 방문객 상위 5곳
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="불가사의 패널 닫기"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] hover:border-[#D4A84B]/60 hover:text-[#E8E6DF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 서브 탭 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1E2F42] bg-[#0A141F] px-5 py-2 text-xs">
          {[
            { id: 'wonders' as const, label: `등재 불가사의 (${totalWonders})` },
            { id: 'parks' as const, label: `전체 국립공원 (${allParks.length})` },
            { id: 'universities' as const, label: `주요 연구대학 (${allUnivs.length})` },
            { id: 'cultural' as const, label: `문화·신앙 유산 (${allCultural.length})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`cursor-pointer rounded px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                tab === item.id
                  ? 'bg-[#1A2D42] text-[#F5D684]'
                  : 'text-[#8DA2B7] hover:text-[#ECEAE2]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'wonders' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* 자연 불가사의 */}
              <div>
                <div className="mb-3 flex items-baseline justify-between border-b border-[#1E2F42] pb-2">
                  <h3 className="text-sm font-semibold text-[#6CC776]">
                    자연 불가사의
                  </h3>
                  <span className="text-[11px] text-[#7D93A8]">
                    국립공원 탐방객 Top 5
                  </span>
                </div>
                <div className="divide-y divide-[#1A293B]">
                  {naturalWonders.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleClick(w)}
                      className="flex w-full cursor-pointer items-center justify-between px-2 py-3 text-left transition-colors hover:bg-[#142334]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-xs font-semibold text-[#F5D684]">
                            #{w.wonderRank}
                          </span>
                          <span className="font-display truncate text-sm font-bold text-[#F3ECD6]">
                            {w.name}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate pl-6 text-[11px] text-[#859BB0]">
                          {PROVINCE_META[w.province].shortName} · {w.subCategory}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-right">
                        <div>
                          <div className="font-mono-num text-xs font-semibold text-[#6CC776]">
                            {w.metricValue.toLocaleString('ko-KR')} {w.metricUnit}
                          </div>
                          <div className="text-[10px] text-[#6E859C]">지도 이동</div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#7D93A8]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 학문 불가사의 */}
              <div>
                <div className="mb-3 flex items-baseline justify-between border-b border-[#1E2F42] pb-2">
                  <h3 className="text-sm font-semibold text-[#6BB5FF]">
                    학문 불가사의
                  </h3>
                  <span className="text-[11px] text-[#7D93A8]">
                    대학 연구비 총액 Top 5
                  </span>
                </div>
                <div className="divide-y divide-[#1A293B]">
                  {academicWonders.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleClick(w)}
                      className="flex w-full cursor-pointer items-center justify-between px-2 py-3 text-left transition-colors hover:bg-[#142334]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-xs font-semibold text-[#F5D684]">
                            #{w.wonderRank}
                          </span>
                          <span className="font-display truncate text-sm font-bold text-[#F3ECD6]">
                            {w.name}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate pl-6 text-[11px] text-[#859BB0]">
                          {PROVINCE_META[w.province].shortName} · {w.subCategory}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-right">
                        <div>
                          <div className="font-mono-num text-xs font-semibold text-[#6BB5FF]">
                            {w.metricValue.toLocaleString('ko-KR')} {w.metricUnit}
                          </div>
                          <div className="text-[10px] text-[#6E859C]">지도 이동</div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#7D93A8]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 문화·신앙 불가사의 */}
              <div>
                <div className="mb-3 flex items-baseline justify-between border-b border-[#1E2F42] pb-2">
                  <h3 className="text-sm font-semibold text-[#D694F2]">
                    문화·신앙 불가사의
                  </h3>
                  <span className="text-[11px] text-[#7D93A8]">
                    유네스코·유산 방문 Top 5
                  </span>
                </div>
                <div className="divide-y divide-[#1A293B]">
                  {culturalWonders.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleClick(w)}
                      className="flex w-full cursor-pointer items-center justify-between px-2 py-3 text-left transition-colors hover:bg-[#142334]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-xs font-semibold text-[#F5D684]">
                            #{w.wonderRank}
                          </span>
                          <span className="font-display truncate text-sm font-bold text-[#F3ECD6]">
                            {w.name}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate pl-6 text-[11px] text-[#859BB0]">
                          {PROVINCE_META[w.province].shortName} · {w.subCategory}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-right">
                        <div>
                          <div className="font-mono-num text-xs font-semibold text-[#D694F2]">
                            {w.metricValue.toLocaleString('ko-KR')} {w.metricUnit}
                          </div>
                          <div className="text-[10px] text-[#6E859C]">지도 이동</div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#7D93A8]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'parks' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#223449] text-[11px] text-[#8FA4B8]">
                  <th className="py-2 px-2 font-medium">순위</th>
                  <th className="py-2 px-2 font-medium">국립공원</th>
                  <th className="py-2 px-2 font-medium">소재 시도</th>
                  <th className="py-2 px-2 font-medium">유형</th>
                  <th className="py-2 px-2 text-right font-medium">연간 탐방객</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182738]">
                {allParks.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => handleClick(p)}
                    className="cursor-pointer hover:bg-[#142334]"
                  >
                    <td className="font-mono-num py-2 px-2 text-[#859BB0]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2 font-medium text-[#ECEAE2]">
                      {p.isWonder && (
                        <span className="mr-1.5 text-[#F5D684]">★</span>
                      )}
                      {p.name}
                    </td>
                    <td className="py-2 px-2 text-[#8FA4B8]">
                      {PROVINCE_META[p.province].shortName}
                    </td>
                    <td className="py-2 px-2 text-[#859BB0]">{p.subCategory}</td>
                    <td className="font-mono-num py-2 px-2 text-right font-semibold text-[#6CC776]">
                      {p.metricValue.toLocaleString('ko-KR')} {p.metricUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'universities' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#223449] text-[11px] text-[#8FA4B8]">
                  <th className="py-2 px-2 font-medium">순위</th>
                  <th className="py-2 px-2 font-medium">대학명</th>
                  <th className="py-2 px-2 font-medium">소재 시도</th>
                  <th className="py-2 px-2 font-medium">분류</th>
                  <th className="py-2 px-2 text-right font-medium">연간 연구비</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182738]">
                {allUnivs.map((u, idx) => (
                  <tr
                    key={u.id}
                    onClick={() => handleClick(u)}
                    className="cursor-pointer hover:bg-[#142334]"
                  >
                    <td className="font-mono-num py-2 px-2 text-[#859BB0]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2 font-medium text-[#ECEAE2]">
                      {u.isWonder && (
                        <span className="mr-1.5 text-[#F5D684]">★</span>
                      )}
                      {u.name}
                    </td>
                    <td className="py-2 px-2 text-[#8FA4B8]">
                      {PROVINCE_META[u.province].shortName}
                    </td>
                    <td className="py-2 px-2 text-[#859BB0]">{u.subCategory}</td>
                    <td className="font-mono-num py-2 px-2 text-right font-semibold text-[#6BB5FF]">
                      {u.metricValue.toLocaleString('ko-KR')} {u.metricUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'cultural' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#223449] text-[11px] text-[#8FA4B8]">
                  <th className="py-2 px-2 font-medium">순위</th>
                  <th className="py-2 px-2 font-medium">문화유산 · 신앙 거점</th>
                  <th className="py-2 px-2 font-medium">소재 시도</th>
                  <th className="py-2 px-2 font-medium">지정 구분</th>
                  <th className="py-2 px-2 text-right font-medium">연간 방문객</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182738]">
                {allCultural.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => handleClick(c)}
                    className="cursor-pointer hover:bg-[#142334]"
                  >
                    <td className="font-mono-num py-2 px-2 text-[#859BB0]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2 font-medium text-[#ECEAE2]">
                      {c.isWonder && (
                        <span className="mr-1.5 text-[#F5D684]">★</span>
                      )}
                      {c.name}
                    </td>
                    <td className="py-2 px-2 text-[#8FA4B8]">
                      {PROVINCE_META[c.province].shortName}
                    </td>
                    <td className="py-2 px-2 text-[#859BB0]">{c.subCategory}</td>
                    <td className="font-mono-num py-2 px-2 text-right font-semibold text-[#D694F2]">
                      {c.metricValue.toLocaleString('ko-KR')} {c.metricUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
