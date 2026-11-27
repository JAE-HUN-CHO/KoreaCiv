export type TerrainType =
  | 'urban'
  | 'farmland'
  | 'forest'
  | 'grassland'
  | 'marsh'
  | 'barren'
  | 'water';

export type ReliefType = 'flat' | 'hills' | 'mountain';

export type DistrictType =
  | 'industrial_zone'
  | 'campus'
  | 'commercial_hub'
  | 'harbor'
  | 'entertainment_complex'
  | 'government_plaza'
  | 'farming_district';

export type IndustryKey =
  | 'manufacturing'
  | 'ictScience'
  | 'finance'
  | 'logistics'
  | 'hospitality'
  | 'publicAdmin'
  | 'agriculture';

export type ProvinceCode =
  | 'seoul'
  | 'busan'
  | 'daegu'
  | 'incheon'
  | 'gwangju'
  | 'daejeon'
  | 'ulsan'
  | 'sejong'
  | 'gyeonggi'
  | 'gangwon'
  | 'chungbuk'
  | 'chungnam'
  | 'jeonbuk'
  | 'jeonnam'
  | 'gyeongbuk'
  | 'gyeongnam'
  | 'jeju';

export type LensId =
  | 'terrain'
  | 'grdp'
  | 'grdp_per_capita'
  | 'population_density'
  | 'manufacturing_share'
  | 'income'
  | 'education'
  | 'faith'
  | 'culture'
  | 'health'
  | 'housing'
  | 'freight_logistics'
  | 'aging_rate'
  | 'science_ict'
  | 'finance_share'
  | 'agriculture_food'
  | 'power_capacity'
  | 'university_rd'
  | 'disaster_damage'
  | 'history';

export type HistoryCensusYear = '2010' | '2015' | '2020' | '2024';

export type HistoryViewMode = 'change' | 'density' | 'boundaries';

export type FacilityType =
  | 'power_plant'
  | 'port'
  | 'airport'
  | 'mine'
  | 'national_park'
  | 'university'
  | 'defense_hub'
  | 'cultural_site';

export interface CityRawRecord {
  id: string;
  name: string;
  enName: string;
  province: ProvinceCode;
  lat: number;
  lon: number;
  /** 2024년 주민등록인구 (명) */
  population: number;
  /** 지역내총생산 GRDP (억원, 2022-2023 기준) */
  grdpBillionKrw: number; // 단위: 억원 (100M KRW -> 10,000 = 1조원)
  /** 65세 이상 고령인구 비율 (%) */
  agingRate: number;
  /** 전체 사업체 종사자 수 (명) */
  totalWorkers: number;
  /** 7대 주요 산업 종사자 비중 (%, 합계는 기타 서비스업 포함 전 산업 중 해당 비중) */
  shares: Record<IndustryKey, number>;
  /** 무역항 보유 여부 */
  hasTradePort?: boolean;
  /** 대학 연구비 총액 (억원) */
  universityRd100M: number;
  /** 발전설비용량 (MW) */
  powerCapacityMw: number;
  /** 최근 10년 누적 자연재해 피해액 (억원) */
  disasterDamage100M: number;
  /** 도시 유형 등급 (1: 특별/광역시, 2: 대도시/거점시, 3: 중소시, 4: 군) */
  tier: 1 | 2 | 3 | 4;
  /** 도시 핵심 특성 한 줄 요약 */
  summary: string;
}

export interface ComputedDistrict {
  type: DistrictType;
  industry: IndustryKey;
  lq: number;
  workers: number;
  sharePct: number;
}

export interface CitizenBreakdown {
  industry: IndustryKey;
  labelKo: string;
  workers: number;
  sharePct: number;
  nationalSharePct: number;
  oneInN: number;
  nationalOneInN: number;
  lq: number;
}

export type PolicyCardSlot =
  | 'economic'
  | 'scientific'
  | 'maritime'
  | 'cultural'
  | 'civic'
  | 'agrarian'
  | 'wildcard';

export type PolicyCardId =
  | 'industrial_base'
  | 'tech_hub'
  | 'financial_capital'
  | 'maritime_gateway'
  | 'cultural_bastion'
  | 'civic_seat'
  | 'breadbasket'
  | 'balanced_polis';

export interface PolicyCard {
  id: PolicyCardId;
  slot: PolicyCardSlot;
  slotLabelKo: string;
  nameEn: string;
  nameKo: string;
  passiveBonus: string;
  secondaryEffect: string;
  triggerRule: string;
  accentColor: string;
}

export interface CityComputed extends CityRawRecord {
  provinceName: string;
  /** 1인당 GRDP (만원) */
  grdpPerCapitaManwon: number;
  /** 평균 근로소득 (만원/년, 국세청 근로소득 기준) */
  avgIncomeManwon: number;
  /** 전문대졸·대졸 이상 학위 비중 (%, 25세 이상) */
  collegeDegreePct: number;
  /** 종교인구 · 신앙 비율 (%, 통계청 종교인구 기반) */
  faithRatePct: number;
  /** 기대수명 (세, 통계청·질병관리청 기반) */
  lifeExpectancy: number;
  /** 평균 주택 3.3m²당 가격 (만원, 한국부동산원 기준) */
  housingPriceManwon: number;
  /** 연간 화물 물동량 추정치 (백만톤/년). 원자료 출처 미확인 */
  freightVolumeMt: number;
  /** 면적 (km², 격자 기반 계산 후 갱신) */
  areaKm2: number;
  /** 인구밀도 (명/km²) */
  populationDensity: number;
  /** 규칙 기반 산출 지구 (최대 3개) */
  districts: ComputedDistrict[];
  /** 주력 산업 기반 지역 고유 정책 카드 (Policy Card) */
  policyCard: PolicyCard;
  /** 지역 내 등록 문화유산·박물관·랜드마크 수 */
  culturalSiteCount: number;
  /** 공간 커널 기반 시군구 문화 밀도 점수 (0~100) */
  cultureScore: number;
  /** 시민 구성 ("N명 중 1명") */
  citizens: CitizenBreakdown[];
  /** Civ 산출량 요약 */
  yields: {
    gold: number; // 조원 단위
    production: number; // 제조업 종사자 (천명)
    food: number; // 식량 지수
    science: number; // 과학 지수
    culture: number; // 문화 지수
    faith: number; // 신앙 지수
  };
  /** 소속 격자 수 */
  hexCount: number;
  /** 중심 격자 좌표 */
  centerHexId?: string;
  centerX: number;
  centerY: number;
  /** 실시간 SGIS/KOSIS API 최신 반영 메타데이터 */
  livePopYear?: string;
  liveAgingYear?: string;
  liveGrdpYear?: string;
  liveAvgAge?: number;
  liveAgedChildIdx?: number;
  liveCorpCnt?: number;
}

export interface HexTile {
  id: string;
  q: number;
  r: number;
  /** EPSG:5179 평면 근사 좌표 (km) */
  x: number;
  y: number;
  lat: number;
  lon: number;
  landFraction: number;
  islandGroup: 'mainland' | 'jeju' | 'ulleung' | 'geoje' | 'ganghwa' | 'jindo' | 'namhae' | 'wando' | 'other';
  elevationM: number;
  reliefM: number;
  terrain: TerrainType;
  relief: ReliefType;
  cityId: string;
  province: ProvinceCode;
  isCoastal: boolean;
  /** 인구 가중 배분된 격자 통계 */
  population: number;
  populationDensity: number;
  grdp100M: number; // 억원
  grdpPerCapitaManwon: number;
  manufacturingWorkers: number;
  scienceScore: number;
  foodScore: number;
  /** 5km 격자 공간 문화유산·박물관·랜드마크 밀도 지수 (0~100) */
  cultureDensity: number;
  /** 반경 25km 이내 문화유산·박물관·랜드마크 수 */
  nearbyCulturalCount: number;
  /** 1~6 Civ 타일 산출량 등급 (시각화용) */
  civGold: number;
  civProduction: number;
  civFood: number;
  civScience: number;
}

export interface FacilityPoint {
  id: string;
  name: string;
  type: FacilityType;
  cityId: string;
  province: ProvinceCode;
  lat: number;
  lon: number;
  x?: number;
  y?: number;
  hexId?: string;
  /** 주요 정량 지표 (MW, TEU, 만명, 억원 등) */
  metricValue: number;
  metricUnit: string;
  metricLabel: string;
  subCategory: string;
  isWonder?: boolean;
  wonderKind?: 'natural' | 'academic' | 'cultural';
  wonderRank?: number;
  sourceNote: string;
}

export interface LayerVisibility {
  cityBanners: boolean;
  wonders: boolean;
  powerPlants: boolean;
  ports: boolean;
  airports: boolean;
  mines: boolean;
  nationalParks: boolean;
  universities: boolean;
  defenseHubs: boolean;
  culturalSites: boolean;
  rivers: boolean;
  railways: boolean;
  provinceBorders: boolean;
  sigunguBorders: boolean;
}

export interface GridStats {
  totalLandHexes: number;
  hexWidthKm: number;
  hexAreaKm2: number;
  totalLandAreaKm2: number;
  grdpConservationErrorPct: number;
  popConservationErrorPct: number;
  mfgConservationErrorPct: number;
  totalCities: number;
  totalFacilities: number;
  naturalWondersCount: number;
  academicWondersCount: number;
  culturalWondersCount: number;
  /** 칸별 인구 비중을 격자 인구 원자료로 나눈 시·군 수 (나머지는 추정 가중) */
  gridPopulationCities: number;
}

export interface DataSourceInfo {
  id: string;
  item: string;
  agency: string;
  unit: string;
  refYear: string;
  status: 'active' | 'estimated' | 'excluded';
  note: string;
  url?: string;
}

export interface LensDefinition {
  id: LensId;
  nameKo: string;
  shortName: string;
  civTerm: string;
  phase: 1 | 2;
  category: 'core' | 'society' | 'infra';
  unit: string;
  description: string;
  sourceLabel: string;
  legendStops: { color: string; label: string }[];
}
