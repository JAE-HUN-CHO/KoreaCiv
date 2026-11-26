import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Layers, Search, X } from 'lucide-react';
import type { CityComputed, LensId, ProvinceCode } from '../types/civ';
import { PROVINCE_META } from '../data/rules';

interface ExplorerDrawerProps {
  cities: CityComputed[];
  selectedCityId: string | null;
  onSelectCityOnMap: (cityId: string) => void;
  onHoverCityOnMap?: (cityId: string | null) => void;
  onApplyLens?: (lens: LensId) => void;
  onClose: () => void;
}

type ColumnKey =
  | 'population'
  | 'grdpBillionKrw'
  | 'grdpPerCapitaManwon'
  | 'populationDensity'
  | 'avgIncomeManwon'
  | 'collegeDegreePct'
  | 'faithRatePct'
  | 'cultureScore'
  | 'lifeExpectancy'
  | 'housingPriceManwon'
  | 'freightVolumeMt'
  | 'manufacturing'
  | 'ictScience'
  | 'finance'
  | 'hospitality'
  | 'publicAdmin'
  | 'agriculture'
  | 'agingRate'
  | 'universityRd100M'
  | 'powerCapacityMw'
  | 'disasterDamage100M';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  unit: string;
  lensId?: LensId;
  getValue: (c: CityComputed) => number;
  format: (v: number) => string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'population',
    label: '인구',
    unit: '명',
    lensId: 'population_density',
    getValue: (c) => c.population,
    format: (v) => `${(v / 10000).toFixed(1)}만`,
  },
  {
    key: 'grdpBillionKrw',
    label: 'GRDP 총액',
    unit: '억원',
    lensId: 'grdp',
    getValue: (c) => c.grdpBillionKrw,
    format: (v) => (v >= 10000 ? `${(v / 10000).toFixed(1)}조` : `${Math.round(v)}억`),
  },
  {
    key: 'grdpPerCapitaManwon',
    label: '1인당 GRDP',
    unit: '만원',
    lensId: 'grdp_per_capita',
    getValue: (c) => c.grdpPerCapitaManwon,
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}만`,
  },
  {
    key: 'avgIncomeManwon',
    label: '평균 근로소득',
    unit: '만원',
    lensId: 'income',
    getValue: (c) => c.avgIncomeManwon,
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}만`,
  },
  {
    key: 'collegeDegreePct',
    label: '대졸+ 학위 비중',
    unit: '%',
    lensId: 'education',
    getValue: (c) => c.collegeDegreePct,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'faithRatePct',
    label: '종교인구 비중',
    unit: '%',
    lensId: 'faith',
    getValue: (c) => c.faithRatePct,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'cultureScore',
    label: '문화유산 밀도',
    unit: '점',
    lensId: 'culture',
    getValue: (c) => c.cultureScore,
    format: (v) => `${Math.round(v)}점`,
  },
  {
    key: 'lifeExpectancy',
    label: '기대수명',
    unit: '세',
    lensId: 'health',
    getValue: (c) => c.lifeExpectancy,
    format: (v) => `${v.toFixed(1)}세`,
  },
  {
    key: 'housingPriceManwon',
    label: '주택가격 (3.3m²)',
    unit: '만원',
    lensId: 'housing',
    getValue: (c) => c.housingPriceManwon,
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}만`,
  },
  {
    key: 'freightVolumeMt',
    label: '연간 화물 물동량',
    unit: 'Mt',
    lensId: 'freight_logistics',
    getValue: (c) => c.freightVolumeMt,
    format: (v) => `${v.toFixed(1)}Mt`,
  },
  {
    key: 'populationDensity',
    label: '인구밀도',
    unit: '명/km²',
    lensId: 'population_density',
    getValue: (c) => c.populationDensity,
    format: (v) => Math.round(v).toLocaleString('ko-KR'),
  },
  {
    key: 'manufacturing',
    label: '제조업 비중',
    unit: '%',
    lensId: 'manufacturing_share',
    getValue: (c) => c.shares.manufacturing,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'ictScience',
    label: 'IT·과학기술 비중',
    unit: '%',
    lensId: 'science_ict',
    getValue: (c) => c.shares.ictScience,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'finance',
    label: '금융·보험 비중',
    unit: '%',
    lensId: 'finance_share',
    getValue: (c) => c.shares.finance,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'hospitality',
    label: '관광·숙박 비중',
    unit: '%',
    getValue: (c) => c.shares.hospitality,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'publicAdmin',
    label: '공공행정 비중',
    unit: '%',
    getValue: (c) => c.shares.publicAdmin,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'agriculture',
    label: '농림어업 비중',
    unit: '%',
    lensId: 'agriculture_food',
    getValue: (c) => c.shares.agriculture,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'agingRate',
    label: '고령화율 (65세+)',
    unit: '%',
    lensId: 'aging_rate',
    getValue: (c) => c.agingRate,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'universityRd100M',
    label: '대학 연구비',
    unit: '억원',
    lensId: 'university_rd',
    getValue: (c) => c.universityRd100M,
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}억`,
  },
  {
    key: 'powerCapacityMw',
    label: '발전 설비용량',
    unit: 'MW',
    lensId: 'power_capacity',
    getValue: (c) => c.powerCapacityMw,
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}`,
  },
  {
    key: 'disasterDamage100M',
    label: '10년 재해피해',
    unit: '억원',
    lensId: 'disaster_damage',
    getValue: (c) => c.disasterDamage100M,
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}억`,
  },
];

const COL_MAP = new Map<ColumnKey, ColumnDef>(COLUMNS.map((c) => [c.key, c]));

export const ExplorerDrawer: React.FC<ExplorerDrawerProps> = ({
  cities,
  selectedCityId,
  onSelectCityOnMap,
  onHoverCityOnMap,
  onApplyLens,
  onClose,
}) => {
  const [xKey, setXKey] = useState<ColumnKey>('collegeDegreePct');
  const [yKey, setYKey] = useState<ColumnKey>('avgIncomeManwon');
  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(false);
  const [provinceFilter, setProvinceFilter] = useState<ProvinceCode | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<ColumnKey>('avgIncomeManwon');
  const [sortAsc, setSortAsc] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const xCol = COL_MAP.get(xKey)!;
  const yCol = COL_MAP.get(yKey)!;

  const setHovered = (id: string | null) => {
    setHoveredId(id);
    onHoverCityOnMap?.(id);
  };

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cities.filter((c) => {
      if (provinceFilter !== 'all' && c.province !== provinceFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.provinceName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [cities, provinceFilter, search]);

  const sortedTableCities = useMemo(() => {
    const col = COL_MAP.get(sortCol) ?? yCol;
    return [...filteredCities].sort((a, b) => {
      const diff = col.getValue(a) - col.getValue(b);
      return sortAsc ? diff : -diff;
    });
  }, [filteredCities, sortCol, sortAsc, yCol]);

  // 산점도 SVG 좌표 + OLS 선형회귀 추세선 + 상관계수(r) 계산
  const chartW = 540;
  const chartH = 340;
  const padL = 58;
  const padR = 20;
  const padT = 18;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const scatterData = useMemo(() => {
    const transform = (v: number, isLog: boolean) =>
      isLog ? Math.log10(Math.max(1, v)) : v;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const raw = filteredCities.map((c) => {
      const vx = xCol.getValue(c);
      const vy = yCol.getValue(c);
      const tx = transform(vx, logX);
      const ty = transform(vy, logY);
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
      return { city: c, vx, vy, tx, ty };
    });

    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    const xPad = (maxX - minX) * 0.06;
    const yPad = (maxY - minY) * 0.08;
    const domainMinX = minX - xPad;
    const domainMaxX = maxX + xPad;
    const domainMinY = minY - yPad;
    const domainMaxY = maxY + yPad;

    const toSvgX = (tx: number) =>
      padL + ((tx - domainMinX) / (domainMaxX - domainMinX)) * innerW;
    const toSvgY = (ty: number) =>
      padT + innerH - ((ty - domainMinY) / (domainMaxY - domainMinY)) * innerH;

    const points = raw.map((d) => ({
      ...d,
      sx: toSvgX(d.tx),
      sy: toSvgY(d.ty),
    }));

    // Pearson r & OLS 회귀선
    let pearsonR: number | null = null;
    let trendLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (raw.length >= 3) {
      const n = raw.length;
      const meanX = raw.reduce((s, d) => s + d.tx, 0) / n;
      const meanY = raw.reduce((s, d) => s + d.ty, 0) / n;
      let cov = 0;
      let varX = 0;
      let varY = 0;
      for (const d of raw) {
        const dx = d.tx - meanX;
        const dy = d.ty - meanY;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
      }
      if (varX > 1e-9 && varY > 1e-9) {
        pearsonR = cov / Math.sqrt(varX * varY);
        const slope = cov / varX;
        const intercept = meanY - slope * meanX;
        const yAtMin = Math.max(domainMinY, Math.min(domainMaxY, slope * minX + intercept));
        const yAtMax = Math.max(domainMinY, Math.min(domainMaxY, slope * maxX + intercept));
        trendLine = {
          x1: toSvgX(minX),
          y1: toSvgY(yAtMin),
          x2: toSvgX(maxX),
          y2: toSvgY(yAtMax),
        };
      }
    }

    const topY = [...points].sort((a, b) => b.vy - a.vy).slice(0, 6).map((p) => p.city.id);
    const topX = [...points].sort((a, b) => b.vx - a.vx).slice(0, 4).map((p) => p.city.id);
    const lowX = [...points].sort((a, b) => a.vx - b.vx).slice(0, 3).map((p) => p.city.id);
    const labeledIds = new Set([
      'seoul',
      'busan',
      'ulsan',
      'sejong',
      'hwaseong',
      'seongnam',
      ...topY,
      ...topX,
      ...lowX,
    ]);

    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const tv = domainMinX + ((domainMaxX - domainMinX) * i) / 4;
      const val = logX ? Math.pow(10, tv) : tv;
      return { pos: padL + (innerW * i) / 4, label: xCol.format(val) };
    });
    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const tv = domainMinY + ((domainMaxY - domainMinY) * i) / 4;
      const val = logY ? Math.pow(10, tv) : tv;
      return { pos: padT + innerH - (innerH * i) / 4, label: yCol.format(val) };
    });

    return { points, labeledIds, xTicks, yTicks, pearsonR, trendLine };
  }, [filteredCities, xCol, yCol, logX, logY, innerW, innerH]);

  const hoveredPoint = useMemo(
    () => scatterData.points.find((p) => p.city.id === hoveredId) ?? null,
    [scatterData.points, hoveredId]
  );

  const toggleSort = (key: ColumnKey) => {
    if (sortCol === key) setSortAsc((v) => !v);
    else {
      setSortCol(key);
      setSortAsc(false);
    }
  };

  const handleDownloadCsv = () => {
    const header = ['도시명', '시도', ...COLUMNS.map((c) => `${c.label}(${c.unit})`)];
    const rows = sortedTableCities.map((city) => [
      city.name,
      PROVINCE_META[city.province].name,
      ...COLUMNS.map((c) => Number(c.getValue(city).toFixed(2))),
    ]);
    const csv =
      '\uFEFF' +
      [header.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koreaciv-explorer-${provinceFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-30 flex h-[min(540px,64vh)] flex-col overflow-hidden rounded border border-[#2A3F57] bg-[#0C1826]/96 backdrop-blur-md">
      {/* 상단 컨트롤 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#1E2F42] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-sm font-bold text-[#F5E9C8]">
            Explorer · 161개 시·군 20개 지표 탐색기
          </h2>
          {scatterData.pearsonR !== null && (
            <span className="font-mono-num text-xs text-[#9BE8F7]">
              상관계수 r = {scatterData.pearsonR >= 0 ? '+' : ''}
              {scatterData.pearsonR.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-[#9BB0C4]">
            <span>X축</span>
            <select
              value={xKey}
              onChange={(e) => setXKey(e.target.value as ColumnKey)}
              className="rounded border border-[#263A50] bg-[#0A131E] px-2 py-1 text-xs text-[#ECEAE2] focus:border-[#D4A84B] focus:outline-none"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.unit})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setLogX((v) => !v)}
            className={`cursor-pointer rounded border px-2 py-1 font-mono-num text-[11px] ${
              logX
                ? 'border-[#D4A84B] bg-[#243242] text-[#F5D684]'
                : 'border-[#263A50] bg-[#0A131E] text-[#8499AE]'
            }`}
          >
            Log X
          </button>

          <label className="ml-1 flex items-center gap-1.5 text-[#9BB0C4]">
            <span>Y축</span>
            <select
              value={yKey}
              onChange={(e) => setYKey(e.target.value as ColumnKey)}
              className="rounded border border-[#263A50] bg-[#0A131E] px-2 py-1 text-xs text-[#ECEAE2] focus:border-[#D4A84B] focus:outline-none"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.unit})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setLogY((v) => !v)}
            className={`cursor-pointer rounded border px-2 py-1 font-mono-num text-[11px] ${
              logY
                ? 'border-[#D4A84B] bg-[#243242] text-[#F5D684]'
                : 'border-[#263A50] bg-[#0A131E] text-[#8499AE]'
            }`}
          >
            Log Y
          </button>

          {onApplyLens && yCol.lensId && (
            <button
              type="button"
              onClick={() => onApplyLens(yCol.lensId!)}
              title="현재 Y축 지표로 지도 렌즈를 즉시 전환합니다"
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#D4A84B]/55 bg-[#1B2D40] px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-[#F5D684] transition-colors hover:bg-[#243B54]"
            >
              <Layers className="h-3 w-3" />
              <span>Y축 지도 색칠</span>
            </button>
          )}

          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value as ProvinceCode | 'all')}
            aria-label="시도 필터"
            className="rounded border border-[#263A50] bg-[#0A131E] px-2 py-1 text-xs text-[#ECEAE2] focus:border-[#D4A84B] focus:outline-none"
          >
            <option value="all">전국 17개 시도 ({cities.length})</option>
            {(Object.keys(PROVINCE_META) as ProvinceCode[]).map((p) => (
              <option key={p} value={p}>
                {PROVINCE_META[p].name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadCsv}
            title="필터링된 시·군 전체 20개 지표를 CSV로 내려받기"
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#26394E] bg-[#122233] px-2 py-1 text-[11px] font-medium whitespace-nowrap text-[#B8C7D6] transition-colors hover:border-[#67D4E8]/60 hover:text-[#ECEAE2]"
          >
            <Download className="h-3 w-3" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHovered(null);
              onClose();
            }}
            aria-label="탐색기 닫기"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#26394E] bg-[#122233] text-[#9BB0C4] hover:border-[#D4A84B]/60 hover:text-[#E8E6DF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 본문: 좌측 산점도 + 우측 정렬 테이블 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
        {/* 산점도 영역 */}
        <div className="relative flex flex-col border-b border-[#1E2F42] p-3 lg:col-span-6 lg:border-r lg:border-b-0">
          <div className="relative min-h-0 flex-1">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="h-full w-full"
              role="img"
              aria-label={`${xCol.label} 대 ${yCol.label} 산점도`}
            >
              {/* 배경 그리드 */}
              {scatterData.xTicks.map((t, idx) => (
                <g key={`xt-${idx}`}>
                  <line
                    x1={t.pos}
                    y1={padT}
                    x2={t.pos}
                    y2={padT + innerH}
                    stroke="rgba(148, 175, 202, 0.12)"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={t.pos}
                    y={padT + innerH + 15}
                    textAnchor="middle"
                    fill="#7E94AA"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {t.label}
                  </text>
                </g>
              ))}
              {scatterData.yTicks.map((t, idx) => (
                <g key={`yt-${idx}`}>
                  <line
                    x1={padL}
                    y1={t.pos}
                    x2={padL + innerW}
                    y2={t.pos}
                    stroke="rgba(148, 175, 202, 0.12)"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={padL - 8}
                    y={t.pos + 3}
                    textAnchor="end"
                    fill="#7E94AA"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {t.label}
                  </text>
                </g>
              ))}

              {/* OLS 선형회귀 추세선 */}
              {scatterData.trendLine && (
                <line
                  x1={scatterData.trendLine.x1}
                  y1={scatterData.trendLine.y1}
                  x2={scatterData.trendLine.x2}
                  y2={scatterData.trendLine.y2}
                  stroke="rgba(212, 168, 75, 0.65)"
                  strokeWidth="1.4"
                  strokeDasharray="5 4"
                />
              )}

              {/* 축 제목 */}
              <text
                x={padL + innerW / 2}
                y={chartH - 5}
                textAnchor="middle"
                fill="#A7B9CA"
                fontSize="11"
              >
                {xCol.label} ({xCol.unit}){logX ? ' [Log]' : ''}
              </text>
              <text
                x={14}
                y={padT + innerH / 2}
                textAnchor="middle"
                fill="#A7B9CA"
                fontSize="11"
                transform={`rotate(-90 14 ${padT + innerH / 2})`}
              >
                {yCol.label} ({yCol.unit}){logY ? ' [Log]' : ''}
              </text>

              {/* 데이터 점 */}
              {scatterData.points.map((pt) => {
                const isSel = pt.city.id === selectedCityId;
                const isHov = pt.city.id === hoveredId;
                const provColor = PROVINCE_META[pt.city.province].color;
                const r = isSel || isHov ? 6.5 : pt.city.tier === 1 ? 5.2 : 3.6;

                return (
                  <g
                    key={pt.city.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(pt.city.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelectCityOnMap(pt.city.id)}
                  >
                    <circle
                      cx={pt.sx}
                      cy={pt.sy}
                      r={r}
                      fill={provColor}
                      fillOpacity={isSel || isHov ? 1 : 0.78}
                      stroke={isSel ? '#FFF4CE' : isHov ? '#FFFFFF' : '#0B1622'}
                      strokeWidth={isSel || isHov ? 2 : 0.8}
                    />
                    {(scatterData.labeledIds.has(pt.city.id) || isSel || isHov) && (
                      <text
                        x={pt.sx + r + 3}
                        y={pt.sy + 3}
                        fill={isSel || isHov ? '#FFF2C2' : '#B9C8D6'}
                        fontSize={isSel || isHov ? '10.5' : '9'}
                        fontWeight={isSel || isHov ? '600' : '400'}
                        pointerEvents="none"
                      >
                        {pt.city.name.replace(/특별시|광역시|특별자치시|시$|군$/, '') ||
                          pt.city.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* 호버 상세 오버레이 */}
            {hoveredPoint && (
              <div className="pointer-events-none absolute top-2 right-2 rounded border border-[#D4A84B]/50 bg-[#0A141F]/95 px-3 py-2 text-xs">
                <div className="font-semibold text-[#F5E9C8]">
                  {hoveredPoint.city.name}{' '}
                  <span className="font-normal text-[#889EB3]">
                    {PROVINCE_META[hoveredPoint.city.province].shortName}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 font-mono-num text-[11px] text-[#C4D3E0]">
                  <div>
                    {xCol.label}: {xCol.format(hoveredPoint.vx)}
                  </div>
                  <div>
                    {yCol.label}: {yCol.format(hoveredPoint.vy)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측 정렬 테이블 */}
        <div className="flex min-h-0 flex-col lg:col-span-6">
          <div className="flex items-center justify-between gap-2 border-b border-[#1E2F42] px-3 py-2">
            <div className="relative w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#738A9F]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="표 내 시·군 필터..."
                className="w-full rounded border border-[#24374C] bg-[#0A131E] py-1 pr-2 pl-8 text-xs text-[#E8E6DF] placeholder-[#6B8299] focus:border-[#D4A84B] focus:outline-none"
              />
            </div>
            <span className="font-mono-num text-[11px] text-[#7E94AA]">
              {sortedTableCities.length}개 지역 · 행/점 호버 시 지도 실시간 강조
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#101E2E] text-[11px] text-[#8FA4B8]">
                <tr className="border-b border-[#223449]">
                  <th className="px-3 py-2 font-medium">도시 · 시군</th>
                  <th className="px-2 py-2 font-medium">시도</th>
                  {[xKey, yKey, 'population' as ColumnKey, 'grdpPerCapitaManwon' as ColumnKey]
                    .filter((k, idx, arr) => arr.indexOf(k) === idx)
                    .map((colKey) => {
                      const col = COL_MAP.get(colKey)!;
                      const isSorted = sortCol === colKey;
                      return (
                        <th key={colKey} className="px-2.5 py-2 text-right font-medium">
                          <button
                            type="button"
                            onClick={() => toggleSort(colKey)}
                            className="inline-flex cursor-pointer items-center gap-1 hover:text-[#F5D684]"
                          >
                            <span>{col.label}</span>
                            {isSorted &&
                              (sortAsc ? (
                                <ArrowUp className="h-3 w-3 text-[#D4A84B]" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-[#D4A84B]" />
                              ))}
                          </button>
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172536]">
                {sortedTableCities.map((c) => {
                  const isSel = c.id === selectedCityId;
                  const visibleCols = [
                    xKey,
                    yKey,
                    'population' as ColumnKey,
                    'grdpPerCapitaManwon' as ColumnKey,
                  ].filter((k, idx, arr) => arr.indexOf(k) === idx);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCityOnMap(c.id)}
                      onMouseEnter={() => setHovered(c.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-[#1F334A] text-[#FFF4CE]'
                          : 'text-[#D4DFEA] hover:bg-[#142334]'
                      }`}
                    >
                      <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                        {c.name}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] whitespace-nowrap text-[#859BB0]">
                        {PROVINCE_META[c.province].shortName}
                      </td>
                      {visibleCols.map((colKey) => {
                        const col = COL_MAP.get(colKey)!;
                        return (
                          <td
                            key={colKey}
                            className="font-mono-num px-2.5 py-1.5 text-right whitespace-nowrap"
                          >
                            {col.format(col.getValue(c))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
