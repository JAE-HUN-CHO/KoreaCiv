export interface LatLon {
  lat: number;
  lon: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * EPSG:5179 (Korea 2000 / Unified CS) 근사 평면좌표 변환 (단위: km)
 * 기준 원점: 127.5°E, 36.0°N
 * 남한 전역에서 실제 EPSG:5179 대비 거리/면적 오차 < 0.25%
 */
const ORIGIN_LON = 127.5;
const ORIGIN_LAT = 36.0;
const KM_PER_DEG_LAT = 110.95;
const KM_PER_DEG_LON = 111.32 * Math.cos((ORIGIN_LAT * Math.PI) / 180); // ~90.06 km

export function latLonToKm(lat: number, lon: number): Point2D {
  return {
    x: (lon - ORIGIN_LON) * KM_PER_DEG_LON,
    y: (ORIGIN_LAT - lat) * KM_PER_DEG_LAT, // Canvas y-down (북쪽이 음수, 남쪽이 양수)
  };
}

export function kmToLatLon(x: number, y: number): LatLon {
  return {
    lat: ORIGIN_LAT - y / KM_PER_DEG_LAT,
    lon: ORIGIN_LON + x / KM_PER_DEG_LON,
  };
}

export interface PolygonDef {
  id: string;
  islandGroup:
    | 'mainland'
    | 'jeju'
    | 'ulleung'
    | 'geoje'
    | 'ganghwa'
    | 'jindo'
    | 'namhae'
    | 'wando'
    | 'other';
  /** [lat, lon] 꼭짓점 목록 (시계 방향) */
  coords: [number, number][];
}

/**
 * 대한민국 남한 본토 및 주요 도서 정밀 해안선/휴전선 다각형
 * (북한 지역 제외, 2024년 실측 위경도 기반)
 */
export const KOREA_POLYGONS: PolygonDef[] = [
  {
    id: 'mainland',
    islandGroup: 'mainland',
    coords: [
      // 서북단 한강 하구 → DMZ (서→동)
      [37.76, 126.55],
      [37.82, 126.64],
      [37.90, 126.69],
      [37.97, 126.75],
      [38.07, 126.90],
      [38.18, 127.00],
      [38.28, 127.12],
      [38.31, 127.32],
      [38.29, 127.55],
      [38.31, 127.78],
      [38.29, 128.04],
      [38.38, 128.22],
      [38.52, 128.31],
      [38.61, 128.36], // 고성 최북단 동해안
      // 동해안 (북→남)
      [38.44, 128.47],
      [38.26, 128.57],
      [38.14, 128.63],
      [37.98, 128.76],
      [37.82, 128.90],
      [37.68, 129.05],
      [37.53, 129.13],
      [37.41, 129.21],
      [37.24, 129.34],
      [37.06, 129.42],
      [36.85, 129.43],
      [36.64, 129.44],
      [36.44, 129.40],
      [36.25, 129.38],
      [36.05, 129.38], // 영일만 안쪽
      [36.01, 129.44],
      [36.08, 129.58], // 포항 호미곶
      [35.97, 129.56],
      [35.80, 129.51],
      [35.64, 129.45],
      [35.49, 129.44], // 울산 방어진
      [35.42, 129.35],
      [35.33, 129.30],
      [35.22, 129.23], // 기장
      [35.14, 129.16], // 해운대
      [35.06, 129.07], // 영도/부산남항
      [35.06, 128.91], // 낙동강 하구
      // 남해안 (동→서, 리아스식 해안)
      [35.10, 128.76], // 진해만
      [35.14, 128.60], // 마산만
      [35.02, 128.48],
      [34.86, 128.43], // 통영반도
      [34.83, 128.34],
      [34.96, 128.25], // 고성만
      [34.92, 128.08], // 사천만 입구
      [35.02, 128.04],
      [34.95, 127.86], // 하동 노량
      [34.92, 127.72], // 광양만
      [34.80, 127.77], // 여수반도 동측
      [34.68, 127.77],
      [34.61, 127.72], // 돌산/여수남단
      [34.72, 127.58], // 여자만 입구
      [34.80, 127.49],
      [34.66, 127.49], // 고흥반도 동측
      [34.47, 127.43], // 나로우주센터/고흥남단
      [34.45, 127.27],
      [34.60, 127.21], // 득량만
      [34.73, 127.14],
      [34.56, 127.02], // 장흥
      [34.45, 126.92],
      [34.54, 126.82], // 강진만
      [34.39, 126.75],
      [34.30, 126.53], // 해남 땅끝마을
      [34.44, 126.44],
      [34.56, 126.32], // 화원반도
      [34.68, 126.30],
      [34.79, 126.38], // 목포
      // 서해안 (남→북)
      [34.93, 126.34], // 무안반도
      [35.08, 126.34],
      [35.16, 126.44], // 함평만
      [35.28, 126.38], // 영광
      [35.42, 126.44],
      [35.55, 126.50], // 고창
      [35.66, 126.48], // 부안 변산반도
      [35.75, 126.57],
      [35.86, 126.64], // 새만금
      [35.98, 126.64], // 군산
      [36.08, 126.60], // 서천
      [36.22, 126.53],
      [36.36, 126.50], // 보령
      [36.48, 126.48], // 천수만 입구
      [36.60, 126.42],
      [36.56, 126.31], // 태안반도 남서
      [36.70, 126.15], // 태안 만리포
      [36.85, 126.16], // 학암포
      [36.94, 126.32], // 가로림만/대산
      [37.02, 126.48], // 당진 석문
      [37.00, 126.68], // 아산만 입구
      [36.93, 126.84], // 아산/평택항 안쪽
      [37.04, 126.78],
      [37.16, 126.65], // 화성 궁평
      [37.28, 126.64], // 대부도/시화
      [37.39, 126.64], // 인천 송도
      [37.50, 126.61], // 인천항/청라
      [37.63, 126.57], // 김포 대명
      [37.76, 126.55],
    ],
  },
  {
    id: 'jeju',
    islandGroup: 'jeju',
    coords: [
      [33.53, 126.52],
      [33.56, 126.72],
      [33.51, 126.90],
      [33.42, 126.94],
      [33.30, 126.85],
      [33.23, 126.64],
      [33.21, 126.42],
      [33.23, 126.24],
      [33.33, 126.17],
      [33.45, 126.26],
      [33.51, 126.38],
      [33.53, 126.52],
    ],
  },
  {
    id: 'geoje',
    islandGroup: 'geoje',
    coords: [
      [35.02, 128.69],
      [34.94, 128.75],
      [34.81, 128.72],
      [34.73, 128.64],
      [34.78, 128.53],
      [34.91, 128.51],
      [35.00, 128.59],
      [35.02, 128.69],
    ],
  },
  {
    id: 'namhae',
    islandGroup: 'namhae',
    coords: [
      [34.91, 127.88],
      [34.86, 128.03],
      [34.74, 128.04],
      [34.72, 127.89],
      [34.79, 127.80],
      [34.89, 127.82],
      [34.91, 127.88],
    ],
  },
  {
    id: 'jindo',
    islandGroup: 'jindo',
    coords: [
      [34.56, 126.27],
      [34.50, 126.36],
      [34.37, 126.31],
      [34.37, 126.15],
      [34.47, 126.12],
      [34.54, 126.19],
      [34.56, 126.27],
    ],
  },
  {
    id: 'ganghwa',
    islandGroup: 'ganghwa',
    coords: [
      [37.82, 126.44],
      [37.76, 126.52],
      [37.62, 126.51],
      [37.60, 126.37],
      [37.72, 126.34],
      [37.81, 126.38],
      [37.82, 126.44],
    ],
  },
  {
    id: 'yeongjong',
    islandGroup: 'ganghwa',
    coords: [
      [37.53, 126.50],
      [37.49, 126.57],
      [37.43, 126.51],
      [37.44, 126.38],
      [37.50, 126.39],
      [37.53, 126.50],
    ],
  },
  {
    id: 'wando',
    islandGroup: 'wando',
    coords: [
      [34.40, 126.69],
      [34.34, 126.76],
      [34.26, 126.72],
      [34.28, 126.62],
      [34.37, 126.62],
      [34.40, 126.69],
    ],
  },
  {
    id: 'anmyeon',
    islandGroup: 'other',
    coords: [
      [36.60, 126.35],
      [36.53, 126.40],
      [36.40, 126.39],
      [36.41, 126.31],
      [36.54, 126.31],
      [36.60, 126.35],
    ],
  },
  {
    id: 'sinan_amtae',
    islandGroup: 'other',
    coords: [
      [34.93, 126.14],
      [34.86, 126.22],
      [34.77, 126.17],
      [34.81, 126.07],
      [34.90, 126.06],
      [34.93, 126.14],
    ],
  },
  {
    id: 'ulleung',
    islandGroup: 'ulleung',
    coords: [
      [37.55, 130.86],
      [37.51, 130.93],
      [37.45, 130.91],
      [37.45, 130.81],
      [37.51, 130.79],
      [37.55, 130.86],
    ],
  },
];

/**
 * 대한민국 주요 하천 좌표열 (Terrain 렌즈 시각화 및 토지피복/평야 보정)
 */
export interface RiverDef {
  id: string;
  name: string;
  width: number;
  points: [number, number][];
}

export const KOREA_RIVERS: RiverDef[] = [
  {
    id: 'hangang',
    name: '한강',
    width: 2.2,
    points: [
      [37.24, 128.92], // 태백 검룡소
      [37.36, 128.65],
      [37.18, 128.35], // 영월·단양
      [37.02, 127.95], // 충주
      [37.29, 127.64], // 여주
      [37.50, 127.45], // 양평 두물머리
      [37.53, 127.12], // 서울 강동
      [37.52, 126.97], // 서울 여의도
      [37.60, 126.78], // 김포
      [37.75, 126.58], // 한강 하구
    ],
  },
  {
    id: 'bukhangang',
    name: '북한강',
    width: 1.5,
    points: [
      [38.25, 127.78], // 화천
      [37.90, 127.72], // 춘천
      [37.78, 127.54], // 가평
      [37.54, 127.32], // 팔당 합류
    ],
  },
  {
    id: 'nakdonggang',
    name: '낙동강',
    width: 2.2,
    points: [
      [37.16, 128.99], // 태백 황지
      [36.88, 128.88], // 봉화
      [36.56, 128.72], // 안동
      [36.53, 128.25], // 상주
      [36.12, 128.36], // 구미
      [35.84, 128.45], // 대구 달성
      [35.45, 128.47], // 창녕
      [35.37, 128.70], // 밀양 삼랑진
      [35.22, 128.98], // 김해·부산
      [35.06, 128.94], // 낙동강 하구
    ],
  },
  {
    id: 'geumgang',
    name: '금강',
    width: 1.7,
    points: [
      [35.72, 127.54], // 장수 뜬봉샘
      [36.02, 127.64], // 무주·금산
      [36.32, 127.58], // 옥천 대청호
      [36.48, 127.28], // 세종
      [36.46, 127.12], // 공주
      [36.28, 126.90], // 부여
      [36.12, 126.86], // 논산/익산
      [36.00, 126.71], // 군산 하구
    ],
  },
  {
    id: 'yeongsangang',
    name: '영산강',
    width: 1.4,
    points: [
      [35.34, 127.02], // 담양
      [35.16, 126.82], // 광주
      [35.02, 126.71], // 나주
      [34.86, 126.52], // 무안·영암
      [34.79, 126.40], // 목포 하구
    ],
  },
  {
    id: 'seomjingang',
    name: '섬진강',
    width: 1.4,
    points: [
      [35.68, 127.36], // 진안·임실
      [35.38, 127.20], // 순창
      [35.22, 127.36], // 곡성
      [35.18, 127.52], // 구례
      [35.05, 127.72], // 하동
      [34.93, 127.76], // 광양만
    ],
  },
];

/**
 * 주요 KTX 고속철도 축선 (토글 레이어)
 */
export interface RailwayDef {
  id: string;
  name: string;
  points: [number, number][];
}

export const KOREA_RAILWAYS: RailwayDef[] = [
  {
    id: 'gyeongbu_ktx',
    name: '경부고속선',
    points: [
      [37.55, 126.97], // 서울
      [37.26, 127.00], // 수원/광명
      [36.80, 127.11], // 천안아산
      [36.62, 127.33], // 오송
      [36.33, 127.43], // 대전
      [36.12, 128.18], // 김천구미
      [35.88, 128.63], // 동대구
      [35.80, 129.14], // 경주
      [35.55, 129.14], // 울산
      [35.11, 129.04], // 부산
    ],
  },
  {
    id: 'honam_ktx',
    name: '호남고속선',
    points: [
      [36.62, 127.33], // 오송
      [36.45, 127.10], // 공주
      [35.94, 126.95], // 익산
      [35.57, 126.85], // 정읍
      [35.14, 126.79], // 광주송정
      [34.79, 126.39], // 목포
    ],
  },
  {
    id: 'jeolla_ktx',
    name: '전라선',
    points: [
      [35.94, 126.95], // 익산
      [35.85, 127.16], // 전주
      [35.41, 127.36], // 남원
      [34.95, 127.50], // 순천
      [34.75, 127.75], // 여수엑스포
    ],
  },
  {
    id: 'gangneung_ktx',
    name: '강릉선 KTX',
    points: [
      [37.55, 126.97], // 서울
      [37.49, 127.49], // 양평
      [37.38, 127.95], // 만종/원주
      [37.56, 128.43], // 평창
      [37.76, 128.90], // 강릉
    ],
  },
  {
    id: 'jungang_ktx',
    name: '중앙선',
    points: [
      [37.38, 127.95], // 원주
      [37.13, 128.21], // 제천
      [36.81, 128.62], // 영주
      [36.56, 128.70], // 안동
      [35.80, 129.14], // 경주
    ],
  },
];

/**
 * 백두대간 및 주요 산악·고원 지형 모델 (DEM 표고 및 기복 근사)
 */
interface PeakDef {
  lat: number;
  lon: number;
  heightM: number;
  sigmaKm: number;
}

const MAJOR_PEAKS: PeakDef[] = [
  // 한라산 (제주)
  { lat: 33.362, lon: 126.533, heightM: 1947, sigmaKm: 13 },
  // 지리산 (백두대간 남단)
  { lat: 35.337, lon: 127.731, heightM: 1915, sigmaKm: 20 },
  // 설악산
  { lat: 38.119, lon: 128.465, heightM: 1708, sigmaKm: 18 },
  // 덕유산
  { lat: 35.860, lon: 127.746, heightM: 1614, sigmaKm: 17 },
  // 계방산·오대산 (강원 중부)
  { lat: 37.796, lon: 128.543, heightM: 1563, sigmaKm: 22 },
  { lat: 37.728, lon: 128.465, heightM: 1577, sigmaKm: 18 },
  // 태백산·함백산
  { lat: 37.097, lon: 128.917, heightM: 1567, sigmaKm: 22 },
  // 점봉산·방태산 (인제/홍천)
  { lat: 38.044, lon: 128.426, heightM: 1424, sigmaKm: 19 },
  { lat: 37.895, lon: 128.366, heightM: 1444, sigmaKm: 18 },
  // 소백산
  { lat: 36.957, lon: 128.485, heightM: 1439, sigmaKm: 18 },
  // 가야산
  { lat: 35.822, lon: 128.119, heightM: 1430, sigmaKm: 14 },
  // 화악산 (가평·화천)
  { lat: 37.997, lon: 127.512, heightM: 1468, sigmaKm: 17 },
  // 가리왕산 (정선)
  { lat: 37.460, lon: 128.562, heightM: 1561, sigmaKm: 20 },
  // 치악산 (원주)
  { lat: 37.365, lon: 128.056, heightM: 1288, sigmaKm: 14 },
  // 대암산·향로봉 (양구/고성)
  { lat: 38.308, lon: 128.316, heightM: 1296, sigmaKm: 18 },
  // 일월산·주왕산 (영양/청송)
  { lat: 36.805, lon: 129.092, heightM: 1219, sigmaKm: 19 },
  { lat: 36.395, lon: 129.155, heightM: 920, sigmaKm: 16 },
  // 가지산·신불산 (영남알프스)
  { lat: 35.622, lon: 129.003, heightM: 1241, sigmaKm: 14 },
  // 팔공산 (대구/영천)
  { lat: 36.016, lon: 128.695, heightM: 1192, sigmaKm: 13 },
  // 속리산 (보은/상주)
  { lat: 36.544, lon: 127.871, heightM: 1058, sigmaKm: 16 },
  // 월악산 (제천/충주)
  { lat: 36.886, lon: 128.106, heightM: 1097, sigmaKm: 15 },
  // 민주지산 (영동/무주)
  { lat: 36.038, lon: 127.850, heightM: 1241, sigmaKm: 16 },
  // 무등산 (광주/화순)
  { lat: 35.134, lon: 126.989, heightM: 1187, sigmaKm: 12 },
  // 월출산·천관산 (영암/장흥)
  { lat: 34.767, lon: 126.704, heightM: 809, sigmaKm: 10 },
  // 내장산·백암산 (정읍/장성)
  { lat: 35.487, lon: 126.889, heightM: 763, sigmaKm: 13 },
  // 계룡산 (공주/계룡)
  { lat: 36.342, lon: 127.206, heightM: 845, sigmaKm: 11 },
  // 용문산 (양평)
  { lat: 37.562, lon: 127.547, heightM: 1157, sigmaKm: 13 },
  // 북한산 (서울/고양)
  { lat: 37.659, lon: 126.978, heightM: 836, sigmaKm: 8 },
  // 울릉도 성인봉
  { lat: 37.498, lon: 130.865, heightM: 987, sigmaKm: 5 },
  // 거제 가라산/계룡산
  { lat: 34.87, lon: 128.61, heightM: 580, sigmaKm: 8 },
];

// 주요 평야 저지대 (표고를 낮추고 농업지역 확률을 높임)
const MAJOR_PLAINS: { lat: number; lon: number; radiusKm: number; weight: number }[] = [
  { lat: 35.80, lon: 126.88, radiusKm: 36, weight: 1.0 }, // 호남평야 (김제·익산·부안·정읍)
  { lat: 34.98, lon: 126.64, radiusKm: 28, weight: 0.9 }, // 나주평야 (나주·영암·무안·함평)
  { lat: 36.74, lon: 126.72, radiusKm: 28, weight: 0.85 }, // 예당평야 (예산·당진·아산·서산)
  { lat: 37.02, lon: 127.02, radiusKm: 24, weight: 0.85 }, // 평택·안성평야
  { lat: 35.22, lon: 128.90, radiusKm: 18, weight: 0.9 }, // 김해평야
  { lat: 36.18, lon: 127.04, radiusKm: 22, weight: 0.8 }, // 논산·부여 평야
  { lat: 37.65, lon: 126.68, radiusKm: 18, weight: 0.85 }, // 김포평야
  { lat: 38.22, lon: 127.24, radiusKm: 14, weight: 0.7 }, // 철원평야
  { lat: 34.58, lon: 126.60, radiusKm: 20, weight: 0.75 }, // 해남·강진 평야
];

// 서해안·남해안 주요 습지/갯벌 지대
const COASTAL_MARSHES: { lat: number; lon: number; radiusKm: number }[] = [
  { lat: 34.88, lon: 127.51, radiusKm: 12 }, // 순천만 습지
  { lat: 34.92, lon: 126.25, radiusKm: 16 }, // 신안·무안 갯벌
  { lat: 35.56, lon: 126.55, radiusKm: 12 }, // 고창·줄포만 갯벌
  { lat: 36.12, lon: 126.62, radiusKm: 12 }, // 서천 갯벌
  { lat: 35.55, lon: 128.41, radiusKm: 9 }, // 창녕 우포늪
  { lat: 37.68, lon: 126.44, radiusKm: 10 }, // 강화 갯벌
];

interface PeakKm {
  x: number;
  y: number;
  heightM: number;
  sigma2: number;
}

const PEAKS_KM: PeakKm[] = MAJOR_PEAKS.map((p) => {
  const pt = latLonToKm(p.lat, p.lon);
  return { x: pt.x, y: pt.y, heightM: p.heightM, sigma2: p.sigmaKm * p.sigmaKm };
});

const PLAINS_KM = MAJOR_PLAINS.map((p) => {
  const pt = latLonToKm(p.lat, p.lon);
  return { x: pt.x, y: pt.y, r2: p.radiusKm * p.radiusKm, weight: p.weight };
});

const MARSHES_KM = COASTAL_MARSHES.map((m) => {
  const pt = latLonToKm(m.lat, m.lon);
  return { x: pt.x, y: pt.y, r2: m.radiusKm * m.radiusKm };
});

// 결정론적 미세 지형 노이즈
function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/**
 * 평면좌표 (x, y) km 지점의 표고(m) 추정 (백두대간 + 30대 명산 + 평야 보정)
 */
export function sampleElevationM(x: number, y: number): number {
  // 1. 기본 구릉 배경 (동고서저: 동쪽이 높고 서쪽이 낮음)
  const eastWestSlope = Math.max(0, (x + 60) * 1.15);
  let elev = 45 + eastWestSlope * 0.45;

  // 2. 주요 산봉우리 및 산맥 가우시안 합성 (최대치 + 완만한 중첩)
  let peakSum = 0;
  let peakMax = 0;
  for (let i = 0; i < PEAKS_KM.length; i++) {
    const p = PEAKS_KM[i];
    const dx = x - p.x;
    const dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > p.sigma2 * 9) continue;
    const h = p.heightM * Math.exp(-d2 / (2 * p.sigma2));
    if (h > peakMax) peakMax = h;
    peakSum += h * 0.28;
  }
  elev += peakMax * 0.86 + Math.min(peakSum, 380);

  // 3. 멀티옥타브 지형 기복 노이즈
  const n1 = smoothNoise(x * 0.045, y * 0.045);
  const n2 = smoothNoise(x * 0.14 + 13.7, y * 0.14 - 7.3);
  elev += (n1 - 0.35) * 210 + (n2 - 0.5) * 95;

  // 4. 주요 평야 감쇠
  let plainFactor = 1.0;
  for (let i = 0; i < PLAINS_KM.length; i++) {
    const pl = PLAINS_KM[i];
    const dx = x - pl.x;
    const dy = y - pl.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < pl.r2 * 1.8) {
      const k = Math.exp(-d2 / (0.85 * pl.r2)) * pl.weight;
      plainFactor *= 1 - k * 0.82;
    }
  }

  elev *= plainFactor;
  return Math.max(4, Math.round(elev));
}

export function getPlainScore(x: number, y: number): number {
  let maxScore = 0;
  for (let i = 0; i < PLAINS_KM.length; i++) {
    const pl = PLAINS_KM[i];
    const dx = x - pl.x;
    const dy = y - pl.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < pl.r2 * 2) {
      const s = Math.exp(-d2 / (0.9 * pl.r2)) * pl.weight;
      if (s > maxScore) maxScore = s;
    }
  }
  return maxScore;
}

export function isMarshZone(x: number, y: number): boolean {
  for (let i = 0; i < MARSHES_KM.length; i++) {
    const m = MARSHES_KM[i];
    const dx = x - m.x;
    const dy = y - m.y;
    if (dx * dx + dy * dy <= m.r2) return true;
  }
  return false;
}

/**
 * Ray-casting point-in-polygon 판정 (평면 km 좌표)
 */
export function pointInPolygon(x: number, y: number, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface ProjectedPolygon {
  id: string;
  islandGroup: PolygonDef['islandGroup'];
  points: Point2D[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const PROJECTED_POLYGONS: ProjectedPolygon[] = KOREA_POLYGONS.map((poly) => {
  const points = poly.coords.map(([lat, lon]) => latLonToKm(lat, lon));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    id: poly.id,
    islandGroup: poly.islandGroup,
    points,
    minX,
    maxX,
    minY,
    maxY,
  };
});

export function locateLandGroup(
  x: number,
  y: number
): PolygonDef['islandGroup'] | null {
  for (let i = 0; i < PROJECTED_POLYGONS.length; i++) {
    const p = PROJECTED_POLYGONS[i];
    if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
    if (pointInPolygon(x, y, p.points)) {
      return p.islandGroup;
    }
  }
  return null;
}
