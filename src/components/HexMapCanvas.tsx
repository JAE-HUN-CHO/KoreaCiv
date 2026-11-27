import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CityComputed,
  FacilityPoint,
  HexTile,
  LayerVisibility,
  LensId,
} from '../types/civ';
import type { KoreaCivWorld } from '../engine/hexGrid';
import { HEX_RADIUS_KM } from '../engine/hexGrid';
import { KOREA_RAILWAYS, KOREA_RIVERS, latLonToKm } from '../data/koreaGeography';
import { DISTRICT_META } from '../data/rules';
import { getHexFillColor } from '../utils/formatters';
import type { CustomMapPin, SgisBoundaryOverlay } from '../services/publicApis';
import type { HistoryRenderContext } from '../engine/history';

export interface CameraTarget {
  x: number;
  y: number;
  zoom: number;
  nonce: number;
}

interface HexMapCanvasProps {
  world: KoreaCivWorld;
  activeLens: LensId;
  layers: LayerVisibility;
  selectedCityId: string | null;
  compareCityId?: string | null;
  explorerHoveredCityId?: string | null;
  pickingCompareFromMap?: boolean;
  selectedHexId: string | null;
  selectedFacilityId: string | null;
  cameraTarget: CameraTarget | null;
  sgisOverlay?: SgisBoundaryOverlay | null;
  historyCtx?: HistoryRenderContext | null;
  customPins?: CustomMapPin[];
  onSelectHex: (hex: HexTile) => void;
  onSelectCity: (cityId: string) => void;
  onPickCompareCity?: (cityId: string) => void;
  onSelectFacility: (facility: FacilityPoint) => void;
  onHoverHex: (hex: HexTile | null) => void;
  onHoverFacility: (facility: FacilityPoint | null) => void;
  onZoomChange?: (zoom: number) => void;
}

// Pointy-top 육각형 단위 꼭짓점 (반지름 1 기준)
const UNIT_HEX_CORNERS: [number, number][] = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return [Math.cos(angle), Math.sin(angle)];
});

const NEIGHBOR_DIRS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

// 각 이웃 방향에 대응하는 변 인덱스 (pointy-top)
const DIR_TO_EDGE: [number, number][] = [
  [0, 1], // (+1, 0) 동쪽 → corner 0..1? 아래 검증: corner 0 = -30deg (우상), corner 1 = +30deg (우하) -> 동쪽 변!
  [5, 0], // (+1, -1) 북동
  [4, 5], // (0, -1) 북서
  [3, 4], // (-1, 0) 서쪽
  [2, 3], // (-1, +1) 남서
  [1, 2], // (0, +1) 남동
];

// 기본 저배율에서 표시할 주요 지역 거점 도시 ID
const MAJOR_ANCHOR_CITIES = new Set([
  'seoul',
  'busan',
  'incheon',
  'daegu',
  'daejeon',
  'gwangju',
  'ulsan',
  'sejong',
  'suwon',
  'seongnam',
  'hwaseong',
  'chuncheon',
  'wonju',
  'gangneung',
  'sokcho',
  'cheongju',
  'cheonan',
  'seosan',
  'jeonju',
  'gunsan',
  'yeosu',
  'mokpo',
  'pohang',
  'gumi',
  'andong',
  'gyeongju',
  'changwon',
  'jinju',
  'geoje',
  'jeju_si',
  'seogwipo',
  'ulleung',
]);

// 시설물 타입별 색상
const FACILITY_STYLE: Record<
  FacilityPoint['type'],
  { color: string; stroke: string; shortTag: string }
> = {
  power_plant: { color: '#F5B547', stroke: '#2D2006', shortTag: '⚡' },
  port: { color: '#45B8D9', stroke: '#07222E', shortTag: '⚓' },
  airport: { color: '#9CC6F5', stroke: '#0E2036', shortTag: '✈' },
  mine: { color: '#C99063', stroke: '#291709', shortTag: '◆' },
  national_park: { color: '#6CC776', stroke: '#0E2B12', shortTag: '▲' },
  university: { color: '#6BB5FF', stroke: '#0B233D', shortTag: '★' },
  defense_hub: { color: '#95B574', stroke: '#1B2A12', shortTag: '⬡' },
  cultural_site: { color: '#D694F2', stroke: '#2A1038', shortTag: '✦' },
};


// 해양 지명 레이블
const SEA_LABELS = [
  { lat: 37.3, lon: 130.15, ko: '동 해', en: 'East Sea' },
  { lat: 36.1, lon: 125.55, ko: '서 해', en: 'Yellow Sea' },
  { lat: 33.95, lon: 127.65, ko: '남 해', en: 'South Sea' },
  { lat: 34.4, lon: 129.3, ko: '대한해협', en: 'Korea Strait' },
];

// 카메라 배율(px/km) 범위. 휴대폰 세로 화면에서도 한반도 전체가 들어가도록 하한을 낮게 둠
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8.5;

export const HexMapCanvas: React.FC<HexMapCanvasProps> = ({
  world,
  activeLens,
  layers,
  selectedCityId,
  compareCityId = null,
  explorerHoveredCityId = null,
  pickingCompareFromMap = false,
  selectedHexId,
  selectedFacilityId,
  cameraTarget,
  sgisOverlay = null,
  historyCtx = null,
  customPins = [],
  onSelectHex,
  onSelectCity,
  onPickCompareCity,
  onSelectFacility,
  onHoverHex,
  onHoverFacility,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 카메라 상태 (centerX, centerY: km 평면좌표, zoom: px per km)
  const cameraRef = useRef({
    x: 28, // 남한 중심 약 127.8°E
    y: 12, // 남한 중심 약 35.9°N
    zoom: 1.25,
  });

  const animRef = useRef<{
    startX: number;
    startY: number;
    startZoom: number;
    targetX: number;
    targetY: number;
    targetZoom: number;
    startTime: number;
    duration: number;
  } | null>(null);

  const dragRef = useRef({
    isDown: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startCamX: 0,
    startCamY: 0,
  });

  const hoveredHexIdRef = useRef<string | null>(null);
  const hoveredFacilityIdRef = useRef<string | null>(null);
  const hasInitializedCameraRef = useRef(false);
  const [, setRenderTick] = useState(0);

  // 미리 투영된 하천 & 철도 경로
  const projectedRivers = useMemo(
    () =>
      KOREA_RIVERS.map((r) => ({
        ...r,
        pts: r.points.map(([lat, lon]) => latLonToKm(lat, lon)),
      })),
    []
  );

  const projectedRailways = useMemo(
    () =>
      KOREA_RAILWAYS.map((r) => ({
        ...r,
        pts: r.points.map(([lat, lon]) => latLonToKm(lat, lon)),
      })),
    []
  );

  const projectedSeaLabels = useMemo(
    () =>
      SEA_LABELS.map((s) => ({
        ...s,
        pt: latLonToKm(s.lat, s.lon),
      })),
    []
  );

  // 시도 경계 변 목록 (1회 사전 계산)
  const provinceBorderEdges = useMemo(() => {
    const edges: [number, number, number, number][] = [];
    for (const h of world.hexes) {
      for (let d = 0; d < 6; d++) {
        const [dq, dr] = NEIGHBOR_DIRS[d];
        const nb = world.hexMap.get(`${h.q + dq},${h.r + dr}`);
        if (nb && nb.province !== h.province && h.id < nb.id) {
          const [c1, c2] = DIR_TO_EDGE[d];
          edges.push([
            h.x + UNIT_HEX_CORNERS[c1][0] * HEX_RADIUS_KM,
            h.y + UNIT_HEX_CORNERS[c1][1] * HEX_RADIUS_KM,
            h.x + UNIT_HEX_CORNERS[c2][0] * HEX_RADIUS_KM,
            h.y + UNIT_HEX_CORNERS[c2][1] * HEX_RADIUS_KM,
          ]);
        }
      }
    }
    return edges;
  }, [world]);

  // 선택된 도시 외곽 경계 변 목록
  const selectedCityEdges = useMemo(() => {
    if (!selectedCityId) return [];
    const edges: [number, number, number, number][] = [];
    for (const h of world.hexes) {
      if (h.cityId !== selectedCityId) continue;
      for (let d = 0; d < 6; d++) {
        const [dq, dr] = NEIGHBOR_DIRS[d];
        const nb = world.hexMap.get(`${h.q + dq},${h.r + dr}`);
        if (!nb || nb.cityId !== selectedCityId) {
          const [c1, c2] = DIR_TO_EDGE[d];
          edges.push([
            h.x + UNIT_HEX_CORNERS[c1][0] * HEX_RADIUS_KM,
            h.y + UNIT_HEX_CORNERS[c1][1] * HEX_RADIUS_KM,
            h.x + UNIT_HEX_CORNERS[c2][0] * HEX_RADIUS_KM,
            h.y + UNIT_HEX_CORNERS[c2][1] * HEX_RADIUS_KM,
          ]);
        }
      }
    }
    return edges;
  }, [world, selectedCityId]);

  // 비교 도시(B) 외곽 경계 변 목록 (SGIS 공식 경계 미로드 시 폴백)
  const compareCityEdges = useMemo(() => {
    if (!compareCityId) return [];
    const edges: [number, number, number, number][] = [];
    for (const h of world.hexes) {
      if (h.cityId !== compareCityId) continue;
      for (let d = 0; d < 6; d++) {
        const [dq, dr] = NEIGHBOR_DIRS[d];
        const nb = world.hexMap.get(`${h.q + dq},${h.r + dr}`);
        if (!nb || nb.cityId !== compareCityId) {
          const [c1, c2] = DIR_TO_EDGE[d];
          edges.push([
            h.x + UNIT_HEX_CORNERS[c1][0] * HEX_RADIUS_KM,
            h.y + UNIT_HEX_CORNERS[c1][1] * HEX_RADIUS_KM,
            h.x + UNIT_HEX_CORNERS[c2][0] * HEX_RADIUS_KM,
            h.y + UNIT_HEX_CORNERS[c2][1] * HEX_RADIUS_KM,
          ]);
        }
      }
    }
    return edges;
  }, [world, compareCityId]);

  // 현재 표시할 시설물 필터
  const visibleFacilities = useMemo(() => {
    return world.facilities.filter((f) => {
      if (f.isWonder && layers.wonders) return true;
      if (f.type === 'power_plant') return layers.powerPlants;
      // 물류 렌즈에서는 항만(물동량)·공항(여객)을 함께 표시 (PLAN.md 9절: 화물 OD 대신)
      if (f.type === 'port') return layers.ports || activeLens === 'freight_logistics';
      if (f.type === 'airport') return layers.airports || activeLens === 'freight_logistics';
      if (f.type === 'mine') return layers.mines;
      if (f.type === 'national_park') return layers.nationalParks;
      if (f.type === 'university') return layers.universities;
      if (f.type === 'defense_hub') return layers.defenseHubs;
      if (f.type === 'cultural_site') return layers.culturalSites || activeLens === 'culture';
      return false;
    });
  }, [world.facilities, layers, activeLens]);


  // 초기 화면 크기에 맞춰 한반도 전체가 쾌적하게 보이도록 최초 1회만 zoom 자동 맞춤
  useEffect(() => {
    if (hasInitializedCameraRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    hasInitializedCameraRef.current = true;
    const h = container.clientHeight || 820;
    const w = container.clientWidth || 1280;
    const spanY = world.bounds.maxY - world.bounds.minY + 70;
    const spanX = world.bounds.maxX - world.bounds.minX + 120;
    const fitZoom = Math.min(h / spanY, w / spanX);
    cameraRef.current = {
      x: (world.bounds.minX + world.bounds.maxX) / 2 - 22, // 울릉도 때문에 치우침 보정
      y: (world.bounds.minY + world.bounds.maxY) / 2,
      zoom: Math.max(MIN_ZOOM, Math.min(2.2, fitZoom * 0.94)),
    };
    onZoomChange?.(cameraRef.current.zoom);
    setRenderTick((t) => t + 1);
  }, [world.bounds, onZoomChange]);

  // 외부에서 cameraTarget 전달 시 부드러운 Fly-To 실행
  useEffect(() => {
    if (!cameraTarget) return;
    const cam = cameraRef.current;
    animRef.current = {
      startX: cam.x,
      startY: cam.y,
      startZoom: cam.zoom,
      targetX: cameraTarget.x,
      targetY: cameraTarget.y,
      targetZoom: cameraTarget.zoom,
      startTime: performance.now(),
      duration: 460,
    };
  }, [cameraTarget]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cam = cameraRef.current;
    const toScreenX = (wx: number) => (wx - cam.x) * cam.zoom + width / 2;
    const toScreenY = (wy: number) => (wy - cam.y) * cam.zoom + height / 2;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. 깊은 바다 배경 + 은은한 해도 그라데이션
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      80,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.78
    );
    bgGrad.addColorStop(0, '#0F2234');
    bgGrad.addColorStop(1, '#08121C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. 해도 위·경도 격자선 (34~38°N, 126~131°E)
    ctx.strokeStyle = 'rgba(130, 170, 205, 0.08)';
    ctx.lineWidth = 1;
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 178, 206, 0.28)';

    for (let lat = 33; lat <= 39; lat++) {
      const y = toScreenY(latLonToKm(lat, 127.5).y);
      if (y > -10 && y < height + 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(`${lat}°N`, width - 38, y - 4);
      }
    }
    for (let lon = 125; lon <= 132; lon++) {
      const x = toScreenX(latLonToKm(36, lon).x);
      if (x > -10 && x < width + 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillText(`${lon}°E`, x + 4, height - 10);
      }
    }

    // 3. 해양 지명 표기
    ctx.save();
    ctx.textAlign = 'center';
    for (const s of projectedSeaLabels) {
      const sx = toScreenX(s.pt.x);
      const sy = toScreenY(s.pt.y);
      if (sx < -80 || sx > width + 80 || sy < -40 || sy > height + 40) continue;
      ctx.font = '600 13px "Noto Serif KR", serif';
      ctx.fillStyle = 'rgba(148, 184, 214, 0.24)';
      ctx.fillText(s.ko, sx, sy);
      ctx.font = '400 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148, 184, 214, 0.16)';
      ctx.fillText(s.en, sx, sy + 14);
    }
    ctx.restore();

    const hexScreenR = HEX_RADIUS_KM * cam.zoom;
    const pad = hexScreenR * 2;

    // 4. 해안 타일 얕은 바다 후광 (한반도 실루엣 강조)
    ctx.save();
    ctx.fillStyle = 'rgba(54, 122, 168, 0.22)';
    for (let i = 0; i < world.hexes.length; i++) {
      const h = world.hexes[i];
      if (!h.isCoastal) continue;
      const sx = toScreenX(h.x);
      const sy = toScreenY(h.y);
      if (sx < -pad || sx > width + pad || sy < -pad || sy > height + pad) continue;
      ctx.beginPath();
      const rHalo = hexScreenR * 1.42;
      for (let c = 0; c < 6; c++) {
        const px = sx + UNIT_HEX_CORNERS[c][0] * rHalo;
        const py = sy + UNIT_HEX_CORNERS[c][1] * rHalo;
        if (c === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 5. 5km 육각 타일 렌더링
    const drawStroke = hexScreenR >= 3.2;
    const drawReliefGlyphs = activeLens === 'terrain' && hexScreenR >= 3.8;

    for (let i = 0; i < world.hexes.length; i++) {
      const h = world.hexes[i];
      const sx = toScreenX(h.x);
      const sy = toScreenY(h.y);
      if (sx < -pad || sx > width + pad || sy < -pad || sy > height + pad) continue;

      const city = world.cityMap.get(h.cityId);
      const fillColor = getHexFillColor(h, city, activeLens, historyCtx);

      ctx.beginPath();
      const rDraw = hexScreenR + 0.35; // 미세 틈 방지
      for (let c = 0; c < 6; c++) {
        const px = sx + UNIT_HEX_CORNERS[c][0] * rDraw;
        const py = sy + UNIT_HEX_CORNERS[c][1] * rDraw;
        if (c === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      if (drawStroke) {
        ctx.strokeStyle =
          activeLens === 'terrain'
            ? 'rgba(12, 22, 30, 0.28)'
            : 'rgba(10, 18, 28, 0.36)';
        ctx.lineWidth = hexScreenR > 10 ? 0.85 : 0.45;
        ctx.stroke();
      }

      // 지형 렌즈: 산악/구릉 지형 기호
      if (drawReliefGlyphs) {
        if (h.relief === 'mountain') {
          const s = hexScreenR * 0.46;
          ctx.beginPath();
          ctx.moveTo(sx - s, sy + s * 0.55);
          ctx.lineTo(sx, sy - s * 0.72);
          ctx.lineTo(sx + s, sy + s * 0.55);
          ctx.closePath();
          ctx.fillStyle = h.elevationM > 1000 ? 'rgba(232, 236, 240, 0.42)' : 'rgba(18, 28, 34, 0.35)';
          ctx.fill();
          if (hexScreenR >= 7) {
            ctx.beginPath();
            ctx.moveTo(sx - s * 0.36, sy - s * 0.22);
            ctx.lineTo(sx, sy - s * 0.72);
            ctx.lineTo(sx + s * 0.36, sy - s * 0.22);
            ctx.closePath();
            ctx.fillStyle = 'rgba(241, 245, 249, 0.46)';
            ctx.fill();
          }
        } else if (h.relief === 'hills' && hexScreenR >= 5.2) {
          const s = hexScreenR * 0.38;
          ctx.beginPath();
          ctx.arc(sx, sy + s * 0.35, s * 0.75, Math.PI, 0);
          ctx.strokeStyle = 'rgba(235, 232, 218, 0.22)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 6. 시군구 공식 경계선 (SGIS 실시간 벡터 폴리곤)
    const liveSigunguBounds = world.liveMeta?.sigunguBoundaries;
    if (layers.sigunguBorders && liveSigunguBounds && liveSigunguBounds.length > 0) {
      ctx.save();
      ctx.strokeStyle =
        cam.zoom >= 1.8
          ? 'rgba(218, 232, 245, 0.28)'
          : 'rgba(205, 222, 238, 0.14)';
      ctx.lineWidth = cam.zoom >= 2.4 ? 0.9 : 0.6;
      ctx.beginPath();
      for (let i = 0; i < liveSigunguBounds.length; i++) {
        const rings = liveSigunguBounds[i].rings;
        for (let r = 0; r < rings.length; r++) {
          const ring = rings[r];
          if (ring.length < 3) continue;
          ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
          for (let k = 1; k < ring.length; k++) {
            ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
          }
          ctx.closePath();
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 6.5 시도 경계선 (SGIS 공식 벡터 우선, 미연결 시 육각 경계 폴백)
    if (layers.provinceBorders) {
      const liveProvBounds = world.liveMeta?.provinceBoundaries;
      ctx.save();
      ctx.strokeStyle =
        activeLens === 'terrain'
          ? 'rgba(242, 228, 190, 0.46)'
          : 'rgba(242, 228, 190, 0.34)';
      ctx.lineWidth = cam.zoom > 2 ? 1.5 : 1.05;
      ctx.beginPath();
      if (liveProvBounds && liveProvBounds.length > 0) {
        for (let i = 0; i < liveProvBounds.length; i++) {
          const rings = liveProvBounds[i].rings;
          for (let r = 0; r < rings.length; r++) {
            const ring = rings[r];
            if (ring.length < 3) continue;
            ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
            for (let k = 1; k < ring.length; k++) {
              ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
            }
            ctx.closePath();
          }
        }
      } else {
        for (let i = 0; i < provinceBorderEdges.length; i++) {
          const [x1, y1, x2, y2] = provinceBorderEdges[i];
          ctx.moveTo(toScreenX(x1), toScreenY(y1));
          ctx.lineTo(toScreenX(x2), toScreenY(y2));
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 6.8 역사 렌즈: 과거 센서스 공식 SGIS 행정경계 오버레이 (황색) + 현재(2024) 경계 대조 (청록)
    if (activeLens === 'history' && historyCtx) {
      const histSnap =
        historyCtx.mode === 'change' ? historyCtx.baseSnapshot : historyCtx.activeSnapshot;
      const showHistoricalOverlay =
        historyCtx.mode === 'boundaries' || historyCtx.compareCurrentBoundaries;

      // 경계 변천 모드에서 현재(2024) 경계 먼저 청록색으로 표시
      if (
        historyCtx.mode === 'boundaries' &&
        historyCtx.compareCurrentBoundaries &&
        world.liveMeta?.sigunguBoundaries.length
      ) {
        ctx.save();
        ctx.strokeStyle = 'rgba(103, 212, 232, 0.52)';
        ctx.lineWidth = cam.zoom >= 2.2 ? 1.15 : 0.85;
        ctx.beginPath();
        for (const feat of world.liveMeta.sigunguBoundaries) {
          for (const ring of feat.rings) {
            if (ring.length < 3) continue;
            ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
            for (let k = 1; k < ring.length; k++) {
              ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
            }
            ctx.closePath();
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      if (showHistoricalOverlay && histSnap.sigunguBoundaries.length > 0) {
        ctx.save();
        ctx.strokeStyle =
          historyCtx.mode === 'boundaries'
            ? 'rgba(242, 184, 75, 0.84)'
            : 'rgba(242, 184, 75, 0.56)';
        ctx.lineWidth =
          historyCtx.mode === 'boundaries'
            ? cam.zoom >= 2.2
              ? 1.45
              : 1.05
            : 0.85;
        if (historyCtx.mode !== 'boundaries') {
          ctx.setLineDash([4, 3]);
        }
        ctx.beginPath();
        for (const feat of histSnap.sigunguBoundaries) {
          for (const ring of feat.rings) {
            if (ring.length < 3) continue;
            ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
            for (let k = 1; k < ring.length; k++) {
              ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
            }
            ctx.closePath();
          }
        }
        ctx.stroke();

        // 과거 시도 경계선은 더 굵게 강조 (예: 2010년 16개 시도)
        if (histSnap.provinceBoundaries.length > 0) {
          ctx.setLineDash([]);
          ctx.strokeStyle =
            historyCtx.mode === 'boundaries'
              ? 'rgba(255, 211, 117, 0.94)'
              : 'rgba(242, 184, 75, 0.75)';
          ctx.lineWidth = cam.zoom >= 2 ? 2.0 : 1.45;
          ctx.beginPath();
          for (const feat of histSnap.provinceBoundaries) {
            for (const ring of feat.rings) {
              if (ring.length < 3) continue;
              ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
              for (let k = 1; k < ring.length; k++) {
                ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
              }
              ctx.closePath();
            }
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 7. 주요 하천
    if (layers.rivers) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const r of projectedRivers) {
        ctx.beginPath();
        r.pts.forEach((pt, idx) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle =
          activeLens === 'terrain'
            ? 'rgba(86, 174, 226, 0.72)'
            : 'rgba(86, 174, 226, 0.34)';
        ctx.lineWidth = Math.max(1.1, r.width * Math.min(cam.zoom * 0.85, 2.2));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 8. KTX 고속철도 축선
    if (layers.railways) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([5, 4]);
      for (const rail of projectedRailways) {
        ctx.beginPath();
        rail.pts.forEach((pt, idx) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle = 'rgba(232, 206, 146, 0.68)';
        ctx.lineWidth = Math.max(1.2, Math.min(2.2, cam.zoom * 0.9));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 9. 선택된 도시 영역 외곽 하이라이트 (SGIS 공식 폴리곤 우선, 없으면 육각 경계)
    const selectedCityRings = selectedCityId
      ? world.liveMeta?.cityBoundariesByCityId.get(selectedCityId)
      : undefined;
    if (selectedCityRings && selectedCityRings.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#F2CA66';
      ctx.fillStyle = 'rgba(242, 202, 102, 0.07)';
      ctx.lineWidth = Math.max(1.8, Math.min(2.8, cam.zoom * 0.95));
      ctx.shadowColor = 'rgba(242, 202, 102, 0.45)';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      for (let r = 0; r < selectedCityRings.length; r++) {
        const ring = selectedCityRings[r];
        if (ring.length < 3) continue;
        ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
        for (let k = 1; k < ring.length; k++) {
          ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (selectedCityEdges.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#F2CA66';
      ctx.lineWidth = Math.max(1.8, Math.min(3.0, cam.zoom * 1.1));
      ctx.shadowColor = 'rgba(242, 202, 102, 0.5)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i < selectedCityEdges.length; i++) {
        const [x1, y1, x2, y2] = selectedCityEdges[i];
        ctx.moveTo(toScreenX(x1), toScreenY(y1));
        ctx.lineTo(toScreenX(x2), toScreenY(y2));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 9.2 비교 도시(B) 영역 외곽 하이라이트 (청록 #67D4E8)
    const compareCityRings = compareCityId
      ? world.liveMeta?.cityBoundariesByCityId.get(compareCityId)
      : undefined;
    if (compareCityRings && compareCityRings.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#67D4E8';
      ctx.fillStyle = 'rgba(103, 212, 232, 0.08)';
      ctx.lineWidth = Math.max(1.8, Math.min(2.8, cam.zoom * 0.95));
      ctx.shadowColor = 'rgba(103, 212, 232, 0.45)';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      for (let r = 0; r < compareCityRings.length; r++) {
        const ring = compareCityRings[r];
        if (ring.length < 3) continue;
        ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
        for (let k = 1; k < ring.length; k++) {
          ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (compareCityEdges.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#67D4E8';
      ctx.lineWidth = Math.max(1.8, Math.min(3.0, cam.zoom * 1.1));
      ctx.shadowColor = 'rgba(103, 212, 232, 0.5)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i < compareCityEdges.length; i++) {
        const [x1, y1, x2, y2] = compareCityEdges[i];
        ctx.moveTo(toScreenX(x1), toScreenY(y1));
        ctx.lineTo(toScreenX(x2), toScreenY(y2));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 9.3 탐색기(Explorer) 호버 도시 실시간 지도 강조
    if (explorerHoveredCityId && explorerHoveredCityId !== selectedCityId) {
      const expRings = world.liveMeta?.cityBoundariesByCityId.get(explorerHoveredCityId);
      const expCity = world.cityMap.get(explorerHoveredCityId);
      if (expRings && expRings.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#FFFFFF';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (const ring of expRings) {
          if (ring.length < 3) continue;
          ctx.moveTo(toScreenX(ring[0][0]), toScreenY(ring[0][1]));
          for (let k = 1; k < ring.length; k++) {
            ctx.lineTo(toScreenX(ring[k][0]), toScreenY(ring[k][1]));
          }
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (expCity) {
        const sx = toScreenX(expCity.centerX);
        const sy = toScreenY(expCity.centerY);
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 9.5 SGIS 공식 행정경계 GeoJSON 오버레이 (실시간 API 로드 시)
    if (sgisOverlay && sgisOverlay.rings.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(116, 224, 240, 0.85)';
      ctx.fillStyle = 'rgba(72, 188, 212, 0.08)';
      ctx.lineWidth = Math.max(1.1, Math.min(2.2, cam.zoom * 0.6));
      for (const ring of sgisOverlay.rings) {
        if (ring.points.length < 3) continue;
        ctx.beginPath();
        let sumX = 0;
        let sumY = 0;
        for (let idx = 0; idx < ring.points.length; idx++) {
          const sx = toScreenX(ring.points[idx].x);
          const sy = toScreenY(ring.points[idx].y);
          sumX += sx;
          sumY += sy;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (cam.zoom >= 2.1 && ring.name) {
          const cx = sumX / ring.points.length;
          const cy = sumY / ring.points.length;
          const shortNm = ring.name.split(' ').pop() || ring.name;
          ctx.font = '500 10px "Noto Sans KR", sans-serif';
          ctx.fillStyle = 'rgba(184, 243, 255, 0.92)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(shortNm, cx, cy);
          ctx.fillStyle = 'rgba(72, 188, 212, 0.08)';
        }
      }
      ctx.restore();
    }

    // 10. 선택된 타일 & 호버 타일 테두리
    const highlightHex = (hexId: string | null, stroke: string, lw: number) => {
      if (!hexId) return;
      const h = world.hexMap.get(hexId);
      if (!h) return;
      const sx = toScreenX(h.x);
      const sy = toScreenY(h.y);
      ctx.beginPath();
      for (let c = 0; c < 6; c++) {
        const px = sx + UNIT_HEX_CORNERS[c][0] * hexScreenR;
        const py = sy + UNIT_HEX_CORNERS[c][1] * hexScreenR;
        if (c === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    };

    highlightHex(selectedHexId, '#FFF4CC', 2.2);
    if (hoveredHexIdRef.current && hoveredHexIdRef.current !== selectedHexId) {
      highlightHex(hoveredHexIdRef.current, 'rgba(255, 255, 255, 0.78)', 1.5);
    }

    // 10.5 문화 렌즈 활성 시 문화유산·박물관 공간 핫스팟 광휘 링 표시
    if (activeLens === 'culture') {
      ctx.save();
      for (const f of visibleFacilities) {
        if (f.type !== 'cultural_site' || f.x === undefined || f.y === undefined) continue;
        const sx = toScreenX(f.x);
        const sy = toScreenY(f.y);
        if (sx < -60 || sx > width + 60 || sy < -60 || sy > height + 60) continue;
        const radiusPx = Math.max(14, (f.isWonder ? 24 : 17) * cam.zoom * 0.72);
        const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, radiusPx);
        grad.addColorStop(0, f.isWonder ? 'rgba(255, 198, 138, 0.36)' : 'rgba(218, 114, 186, 0.28)');
        grad.addColorStop(0.55, 'rgba(196, 77, 156, 0.12)');
        grad.addColorStop(1, 'rgba(196, 77, 156, 0)');
        ctx.beginPath();
        ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();
    }

    // 11. 시설물 & 불가사의(Wonder) 마커
    const drawFacilityMarker = (f: FacilityPoint) => {
      if (f.x === undefined || f.y === undefined) return;
      const sx = toScreenX(f.x);
      const sy = toScreenY(f.y);
      if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) return;

      const isSelected = f.id === selectedFacilityId;
      const isHovered = f.id === hoveredFacilityIdRef.current;

      if (f.isWonder && layers.wonders) {
        // 불가사의: 금빛 다이아몬드 크라운 마커
        const r = isSelected || isHovered ? 9.5 : 7.5;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r * 0.85, sy);
        ctx.lineTo(sx, sy + r);
        ctx.lineTo(sx - r * 0.85, sy);
        ctx.closePath();
        ctx.fillStyle =
          f.wonderKind === 'natural'
            ? '#4EC978'
            : f.wonderKind === 'academic'
              ? '#5EB3F7'
              : '#D48CF2';
        ctx.fill();
        ctx.strokeStyle = '#F7DA82';
        ctx.lineWidth = isSelected ? 2.6 : 1.9;
        ctx.stroke();

        // 내부 별점
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF8DC';
        ctx.fill();

        if (cam.zoom >= 1.5 || isSelected || isHovered) {
          ctx.font = '600 10.5px "Noto Sans KR", sans-serif';
          const text = f.name;
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = 'rgba(12, 22, 34, 0.88)';
          ctx.fillRect(sx - tw / 2 - 5, sy - r - 19, tw + 10, 16);
          ctx.strokeStyle = 'rgba(247, 218, 130, 0.65)';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(sx - tw / 2 - 5, sy - r - 19, tw + 10, 16);
          ctx.fillStyle = '#FAE7A5';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, sx, sy - r - 11);
        }
        ctx.restore();
        return;
      }

      const style = FACILITY_STYLE[f.type];
      const r = isSelected || isHovered ? 6.5 : cam.zoom >= 1.8 ? 5.4 : 4.2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#FFFFFF' : style.stroke;
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.stroke();

      if (cam.zoom >= 2.2 || isHovered || isSelected) {
        ctx.font = '500 10px "Noto Sans KR", sans-serif';
        const tw = ctx.measureText(f.name).width;
        ctx.fillStyle = 'rgba(11, 20, 31, 0.88)';
        ctx.fillRect(sx - tw / 2 - 4, sy - r - 17, tw + 8, 15);
        ctx.fillStyle = '#E8E6DF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name, sx, sy - r - 9.5);
      }
      ctx.restore();
    };

    // 일반 시설 먼저, 불가사의는 최상단에 그리기
    for (const f of visibleFacilities) {
      if (!f.isWonder) drawFacilityMarker(f);
    }
    for (const f of visibleFacilities) {
      if (f.isWonder) drawFacilityMarker(f);
    }

    // 12. 문명 스타일 도시 배너 (줌 레벨별 적응형 LOD + 겹침 방지)
    if (layers.cityBanners) {
      const candidates: CityComputed[] = world.cities.filter((c) => {
        if (c.id === selectedCityId || c.id === compareCityId) return true;
        if (cam.zoom < 1.35) return MAJOR_ANCHOR_CITIES.has(c.id);
        if (cam.zoom < 2.2) return c.tier <= 3 || MAJOR_ANCHOR_CITIES.has(c.id);
        return true;
      });

      // 선택 도시(A) 및 비교 도시(B) 최우선, 그 다음 인구 순 정렬
      candidates.sort((a, b) => {
        if (a.id === selectedCityId) return -1;
        if (b.id === selectedCityId) return 1;
        if (a.id === compareCityId) return -1;
        if (b.id === compareCityId) return 1;
        return b.population - a.population;
      });

      const placedRects: { x1: number; y1: number; x2: number; y2: number }[] = [];

      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      for (const city of candidates) {
        const sx = toScreenX(city.centerX);
        const sy = toScreenY(city.centerY);
        if (sx < -60 || sx > width + 60 || sy < -30 || sy > height + 30) continue;

        const isSel = city.id === selectedCityId;
        const isComp = city.id === compareCityId;
        const isHighlighted = isSel || isComp;
        const shortName = city.name
          .replace('특별자치시', '')
          .replace('특별시', '')
          .replace('광역시', '')
          .replace(/시$|군$/, '');

        const displayName = shortName.length <= 1 ? city.name : shortName;
        const popGrade =
          city.population >= 2000000
            ? Math.round(city.population / 500000) + 12
            : city.population >= 500000
              ? Math.round(city.population / 120000) + 6
              : Math.max(1, Math.round(city.population / 80000) + 1);

        const fontSize = city.tier === 1 || isHighlighted ? 11.5 : 10.2;
        ctx.font = `${city.tier === 1 || isHighlighted ? '600' : '500'} ${fontSize}px "Noto Sans KR", sans-serif`;
        const nameW = ctx.measureText(displayName).width;
        const distCount = city.districts.length;
        const distW = distCount > 0 ? distCount * 7 + 5 : 0;

        const badgeW = 19;
        const bannerW = badgeW + nameW + distW + 10;
        const bannerH = city.tier === 1 || isHighlighted ? 21 : 18;
        const bx = Math.round(sx - bannerW / 2);
        const by = Math.round(sy - bannerH / 2);

        // 충돌 검사 (선택 도시 A/B는 항상 표시)
        if (!isHighlighted) {
          let collides = false;
          const margin = 3;
          for (let r = 0; r < placedRects.length; r++) {
            const pr = placedRects[r];
            if (
              bx - margin < pr.x2 &&
              bx + bannerW + margin > pr.x1 &&
              by - margin < pr.y2 &&
              by + bannerH + margin > pr.y1
            ) {
              collides = true;
              break;
            }
          }
          if (collides) continue;
        }

        placedRects.push({ x1: bx, y1: by, x2: bx + bannerW, y2: by + bannerH });

        // 배너 본체
        ctx.fillStyle = isSel
          ? 'rgba(26, 39, 56, 0.96)'
          : isComp
            ? 'rgba(16, 42, 56, 0.96)'
            : 'rgba(13, 23, 35, 0.86)';
        ctx.strokeStyle = isSel
          ? '#F2CA66'
          : isComp
            ? '#67D4E8'
            : city.tier === 1
              ? 'rgba(212, 168, 75, 0.62)'
              : 'rgba(148, 175, 202, 0.34)';
        ctx.lineWidth = isHighlighted ? 1.5 : 0.9;

        const radius = 3;
        ctx.beginPath();
        ctx.roundRect(bx, by, bannerW, bannerH, radius);
        ctx.fill();
        ctx.stroke();

        // 인구 등급 숫자 블록 (좌측)
        ctx.fillStyle = isSel
          ? '#D4A84B'
          : isComp
            ? '#5AC4D9'
            : city.tier === 1
              ? '#B89242'
              : '#2A3F57';
        ctx.beginPath();
        ctx.roundRect(bx + 1, by + 1, badgeW - 1, bannerH - 2, [2, 0, 0, 2]);
        ctx.fill();

        ctx.font = '600 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = isHighlighted || city.tier === 1 ? '#0E1722' : '#DCE6F0';
        ctx.textAlign = 'center';
        ctx.fillText(String(popGrade), bx + badgeW / 2, by + bannerH / 2 + 0.5);

        // 도시명
        ctx.font = `${city.tier === 1 || isHighlighted ? '600' : '500'} ${fontSize}px "Noto Sans KR", sans-serif`;
        ctx.fillStyle = isSel ? '#FFF4CE' : isComp ? '#B8F0FA' : '#EDEAE0';
        ctx.textAlign = 'left';
        ctx.fillText(displayName, bx + badgeW + 5, by + bannerH / 2 + 0.5);

        // 대표 지구 컬러 마이크로 스퀘어 (최대 3개)
        if (distCount > 0) {
          const startX = bx + badgeW + 5 + nameW + 5;
          for (let d = 0; d < distCount; d++) {
            const dMeta = DISTRICT_META[city.districts[d].type];
            ctx.fillStyle = dMeta.color;
            ctx.fillRect(startX + d * 7, by + bannerH / 2 - 2.5, 5, 5);
          }
        }
      }
      ctx.restore();
    }

    // 13. VWorld 지오코딩 사용자 핀
    if (customPins.length > 0) {
      ctx.save();
      for (const pin of customPins) {
        const sx = toScreenX(pin.x);
        const sy = toScreenY(pin.y);
        if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#F26B5B';
        ctx.fill();
        ctx.strokeStyle = '#FFF5D6';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '600 10.5px "Noto Sans KR", sans-serif';
        const tw = ctx.measureText(pin.name).width;
        ctx.fillStyle = 'rgba(13, 22, 34, 0.92)';
        ctx.fillRect(sx - tw / 2 - 5, sy - 25, tw + 10, 16);
        ctx.strokeStyle = 'rgba(242, 107, 91, 0.75)';
        ctx.lineWidth = 0.9;
        ctx.strokeRect(sx - tw / 2 - 5, sy - 25, tw + 10, 16);
        ctx.fillStyle = '#FFE4DE';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pin.name, sx, sy - 17);
      }
      ctx.restore();
    }

    ctx.restore();
  }, [
    world,
    activeLens,
    layers,
    selectedCityId,
    compareCityId,
    explorerHoveredCityId,
    selectedHexId,
    selectedFacilityId,
    sgisOverlay,
    historyCtx,
    customPins,
    projectedRivers,
    projectedRailways,
    projectedSeaLabels,
    provinceBorderEdges,
    selectedCityEdges,
    compareCityEdges,
    visibleFacilities,
  ]);

  // 애니메이션 루프 (Fly-To 시에만 연속 갱신, 평소에는 상태 변화 시 1회 렌더)
  useEffect(() => {
    let rafId = 0;
    const step = (now: number) => {
      const anim = animRef.current;
      if (anim) {
        const elapsed = now - anim.startTime;
        const t = Math.min(1, elapsed / anim.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        cameraRef.current = {
          x: anim.startX + (anim.targetX - anim.startX) * ease,
          y: anim.startY + (anim.targetY - anim.startY) * ease,
          zoom: anim.startZoom + (anim.targetZoom - anim.startZoom) * ease,
        };
        if (t >= 1) {
          animRef.current = null;
          onZoomChange?.(cameraRef.current.zoom);
        }
        drawScene();
        if (animRef.current) {
          rafId = requestAnimationFrame(step);
        }
      } else {
        drawScene();
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [drawScene, cameraTarget, onZoomChange]);

  // 리사이즈 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      drawScene();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawScene]);

  // 화면 좌표 → 평면 km 좌표 변환
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0, sx: 0, sy: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = cameraRef.current;
    const wx = (sx - rect.width / 2) / cam.zoom + cam.x;
    const wy = (sy - rect.height / 2) / cam.zoom + cam.y;
    return { wx, wy, sx, sy };
  }, []);

  // 최근접 시설물 / 육각 타일 히트 테스트
  const hitTestFacility = useCallback(
    (wx: number, wy: number): FacilityPoint | null => {
      const hitRadiusKm = 11 / cameraRef.current.zoom;
      const r2 = hitRadiusKm * hitRadiusKm;
      let best: FacilityPoint | null = null;
      let bestD2 = r2;
      for (const f of visibleFacilities) {
        if (f.x === undefined || f.y === undefined) continue;
        const dx = f.x - wx;
        const dy = f.y - wy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = f;
        }
      }
      return best;
    },
    [visibleFacilities]
  );

  const hitTestHex = useCallback(
    (wx: number, wy: number): HexTile | null => {
      // 빠른 공간 탐색: 역변환으로 후보 (q, r) 추정 후 주변 7칸 검사
      const rApprox = Math.round(wy / (HEX_RADIUS_KM * 1.5));
      const qApprox = Math.round(wx / (HEX_RADIUS_KM * Math.sqrt(3)) - rApprox / 2);

      let best: HexTile | null = null;
      let bestD2 = HEX_RADIUS_KM * HEX_RADIUS_KM * 1.05;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dq = -1; dq <= 1; dq++) {
          const tile = world.hexMap.get(`${qApprox + dq},${rApprox + dr}`);
          if (!tile) continue;
          const dx = tile.x - wx;
          const dy = tile.y - wy;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = tile;
          }
        }
      }
      return best;
    },
    [world.hexMap]
  );

  // 마우스 휠 줌 (커서 위치 고정)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      animRef.current = null;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = cameraRef.current;
      const wxBefore = (sx - rect.width / 2) / cam.zoom + cam.x;
      const wyBefore = (sy - rect.height / 2) / cam.zoom + cam.y;

      const factor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));

      cameraRef.current = {
        x: wxBefore - (sx - rect.width / 2) / newZoom,
        y: wyBefore - (sy - rect.height / 2) / newZoom,
        zoom: newZoom,
      };
      onZoomChange?.(newZoom);
      drawScene();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [drawScene, onZoomChange]);

  // 터치 핀치 줌: 화면에 닿아 있는 포인터 위치
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ startDist: number; startZoom: number; wx: number; wy: number } | null>(null);

  const startPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const { wx, wy } = screenToWorld(mx, my);
    pinchRef.current = {
      startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      startZoom: cameraRef.current.zoom,
      wx,
      wy,
    };
    // 핀치 중에는 드래그·탭 선택을 멈춤
    dragRef.current.isDown = false;
    dragRef.current.moved = true;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    animRef.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      startPinch();
      return;
    }
    dragRef.current = {
      isDown: true,
      moved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCamX: cameraRef.current.x,
      startCamY: cameraRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinch.startZoom * (dist / pinch.startDist)));
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = (a.x + b.x) / 2 - rect.left;
      const sy = (a.y + b.y) / 2 - rect.top;
      cameraRef.current = {
        x: pinch.wx - (sx - rect.width / 2) / newZoom,
        y: pinch.wy - (sy - rect.height / 2) / newZoom,
        zoom: newZoom,
      };
      onZoomChange?.(newZoom);
      drawScene();
      return;
    }
    if (dragRef.current.isDown) {
      const dx = e.clientX - dragRef.current.startClientX;
      const dy = e.clientY - dragRef.current.startClientY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
      }
      cameraRef.current = {
        ...cameraRef.current,
        x: dragRef.current.startCamX - dx / cameraRef.current.zoom,
        y: dragRef.current.startCamY - dy / cameraRef.current.zoom,
      };
      drawScene();
      return;
    }

    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    const fac = hitTestFacility(wx, wy);
    const facId = fac?.id ?? null;
    const hex = hitTestHex(wx, wy);
    const hexId = hex?.id ?? null;

    let changed = false;
    if (facId !== hoveredFacilityIdRef.current) {
      hoveredFacilityIdRef.current = facId;
      onHoverFacility(fac);
      changed = true;
    }
    if (hexId !== hoveredHexIdRef.current) {
      hoveredHexIdRef.current = hexId;
      onHoverHex(hex);
      changed = true;
    }
    if (changed) drawScene();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current) {
      // 손가락 하나가 남으면 그 위치에서 드래그를 이어감 (탭 선택은 하지 않음)
      pinchRef.current = null;
      const rest = [...pointersRef.current.values()][0];
      if (rest) {
        dragRef.current = {
          isDown: true,
          moved: true,
          startClientX: rest.x,
          startClientY: rest.y,
          startCamX: cameraRef.current.x,
          startCamY: cameraRef.current.y,
        };
      }
      return;
    }
    if (pointersRef.current.size > 0) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.isDown = false;
    dragRef.current.moved = false;

    if (!wasMoved) {
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      if (pickingCompareFromMap || (e.shiftKey && selectedCityId)) {
        const hex = hitTestHex(wx, wy);
        if (hex && onPickCompareCity) {
          onPickCompareCity(hex.cityId);
          return;
        }
      }
      const fac = hitTestFacility(wx, wy);
      if (fac) {
        onSelectFacility(fac);
        return;
      }
      const hex = hitTestHex(wx, wy);
      if (hex) {
        onSelectHex(hex);
        onSelectCity(hex.cityId);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;
    dragRef.current.isDown = false;
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 터치는 손을 떼면 leave가 오므로 호버 정리만 마우스에 적용
    if (e.pointerType === 'touch') return;
    dragRef.current.isDown = false;
    if (hoveredHexIdRef.current !== null || hoveredFacilityIdRef.current !== null) {
      hoveredHexIdRef.current = null;
      hoveredFacilityIdRef.current = null;
      onHoverHex(null);
      onHoverFacility(null);
      drawScene();
    }
  };

  // 외부 버튼으로 줌 조절할 수 있도록 custom event 리스닝
  useEffect(() => {
    const onZoomStep = (ev: Event) => {
      const detail = (ev as CustomEvent<{ factor: number }>).detail;
      const cam = cameraRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * detail.factor));
      cameraRef.current = { ...cam, zoom: newZoom };
      onZoomChange?.(newZoom);
      drawScene();
    };
    window.addEventListener('koreaciv-zoom-step', onZoomStep);
    return () => window.removeEventListener('koreaciv-zoom-step', onZoomStep);
  }, [drawScene, onZoomChange]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        className={`block h-full w-full touch-none ${
          pickingCompareFromMap
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
        }`}
        aria-label="대한민국 5km 육각 격자 문명 지도"
      />
    </div>
  );
};
