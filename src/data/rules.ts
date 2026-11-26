import type {
  CitizenBreakdown,
  ComputedDistrict,
  DistrictType,
  IndustryKey,
  LensDefinition,
  PolicyCard,
  PolicyCardId,
  PolicyCardSlot,
  ProvinceCode,
  ReliefType,
  TerrainType,
} from '../types/civ';

/**
 * rules.yaml 규격을 TypeScript 상수로 구현
 * 모든 변환 규칙은 공개된 수치 기준으로 계산되며 수동 예외를 두지 않음
 */
export const CIV_RULES = {
  grid: {
    hexFlatToFlatKm: 5.0,
    minLandFraction: 0.2,
    crsName: 'EPSG:5179 (Korea 2000 / Unified CS 근사 평면좌표)',
  },
  relief: {
    hillsThresholdM: 300,
    mountainThresholdM: 600,
  },
  district: {
    minLocationQuotient: 1.5,
    minWorkers: 5000,
    maxDistrictsPerCity: 3,
  },
  wonders: {
    naturalTopN: 5,
    academicTopN: 5,
    culturalTopN: 5,
  },
  facilities: {
    powerPlantMinMw: 500,
  },
} as const;

export const PROVINCE_META: Record<
  ProvinceCode,
  { name: string; shortName: string; color: string; regionGroup: string }
> = {
  seoul: { name: '서울특별시', shortName: '서울', color: '#E0B44C', regionGroup: '수도권' },
  incheon: { name: '인천광역시', shortName: '인천', color: '#58A8E0', regionGroup: '수도권' },
  gyeonggi: { name: '경기도', shortName: '경기', color: '#6BB87B', regionGroup: '수도권' },
  gangwon: { name: '강원특별자치도', shortName: '강원', color: '#4B9B82', regionGroup: '강원권' },
  daejeon: { name: '대전광역시', shortName: '대전', color: '#6E9EE8', regionGroup: '충청권' },
  sejong: { name: '세종특별자치시', shortName: '세종', color: '#9D88E0', regionGroup: '충청권' },
  chungbuk: { name: '충청북도', shortName: '충북', color: '#83B065', regionGroup: '충청권' },
  chungnam: { name: '충청남도', shortName: '충남', color: '#D6944B', regionGroup: '충청권' },
  gwangju: { name: '광주광역시', shortName: '광주', color: '#D47B6A', regionGroup: '호남권' },
  jeonbuk: { name: '전북특별자치도', shortName: '전북', color: '#A9B85B', regionGroup: '호남권' },
  jeonnam: { name: '전라남도', shortName: '전남', color: '#5DA69C', regionGroup: '호남권' },
  daegu: { name: '대구광역시', shortName: '대구', color: '#DB7958', regionGroup: '영남권' },
  gyeongbuk: { name: '경상북도', shortName: '경북', color: '#B58962', regionGroup: '영남권' },
  busan: { name: '부산광역시', shortName: '부산', color: '#4D95D6', regionGroup: '영남권' },
  ulsan: { name: '울산광역시', shortName: '울산', color: '#E0823D', regionGroup: '영남권' },
  gyeongnam: { name: '경상남도', shortName: '경남', color: '#6B99C2', regionGroup: '영남권' },
  jeju: { name: '제주특별자치도', shortName: '제주', color: '#C97DB5', regionGroup: '제주권' },
};

export const TERRAIN_META: Record<
  TerrainType,
  { nameKo: string; civName: string; fill: string; hillFill: string; mountainFill: string }
> = {
  urban: {
    nameKo: '시가화·건조지역',
    civName: 'Urban',
    fill: '#8E8477',
    hillFill: '#7D7468',
    mountainFill: '#6B645C',
  },
  farmland: {
    nameKo: '농업지역',
    civName: 'Farmland',
    fill: '#97A857',
    hillFill: '#85964C',
    mountainFill: '#728044',
  },
  forest: {
    nameKo: '산림지역',
    civName: 'Forest',
    fill: '#396144',
    hillFill: '#30543B',
    mountainFill: '#475559',
  },
  grassland: {
    nameKo: '초지',
    civName: 'Grassland',
    fill: '#668F53',
    hillFill: '#587E48',
    mountainFill: '#526B54',
  },
  marsh: {
    nameKo: '습지·갯벌',
    civName: 'Marsh',
    fill: '#4A7872',
    hillFill: '#426B66',
    mountainFill: '#3D5D5A',
  },
  barren: {
    nameKo: '나지·암석',
    civName: 'Barren',
    fill: '#8A8478',
    hillFill: '#78736A',
    mountainFill: '#63666A',
  },
  water: {
    nameKo: '수역',
    civName: 'Water',
    fill: '#235173',
    hillFill: '#235173',
    mountainFill: '#235173',
  },
};

export const RELIEF_META: Record<ReliefType, { nameKo: string; civName: string }> = {
  flat: { nameKo: '평지', civName: 'Flat' },
  hills: { nameKo: '구릉지 (기복 ≥300m)', civName: 'Hills' },
  mountain: { nameKo: '산악 (기복 ≥600m)', civName: 'Mountain' },
};

export const INDUSTRY_META: Record<
  IndustryKey,
  {
    nameKo: string;
    shortKo: string;
    district: DistrictType;
    requiresTradePort?: boolean;
  }
> = {
  manufacturing: {
    nameKo: '제조업',
    shortKo: '제조업',
    district: 'industrial_zone',
  },
  ictScience: {
    nameKo: '정보통신 · 전문과학기술',
    shortKo: 'IT·과학',
    district: 'campus',
  },
  finance: {
    nameKo: '금융 · 보험업',
    shortKo: '금융·보험',
    district: 'commercial_hub',
  },
  logistics: {
    nameKo: '운수 · 창고업',
    shortKo: '운수·물류',
    district: 'harbor',
    requiresTradePort: true,
  },
  hospitality: {
    nameKo: '숙박 · 음식 · 예술여가',
    shortKo: '관광·여가',
    district: 'entertainment_complex',
  },
  publicAdmin: {
    nameKo: '공공행정 · 국방·사회보장',
    shortKo: '공공행정',
    district: 'government_plaza',
  },
  agriculture: {
    nameKo: '농림 · 어업',
    shortKo: '농림어업',
    district: 'farming_district',
  },
};

export const DISTRICT_META: Record<
  DistrictType,
  {
    nameEn: string;
    nameKo: string;
    shortKo: string;
    color: string;
    bgColor: string;
    yieldLabel: string;
  }
> = {
  industrial_zone: {
    nameEn: 'Industrial Zone',
    nameKo: '산업구역',
    shortKo: '산업',
    color: '#E68A3E',
    bgColor: 'rgba(230, 138, 62, 0.16)',
    yieldLabel: '생산력 특화',
  },
  campus: {
    nameEn: 'Campus',
    nameKo: '캠퍼스',
    shortKo: '과학',
    color: '#58B0F0',
    bgColor: 'rgba(88, 176, 240, 0.16)',
    yieldLabel: '과학·IT 특화',
  },
  commercial_hub: {
    nameEn: 'Commercial Hub',
    nameKo: '상업중심지',
    shortKo: '금융',
    color: '#E5BE52',
    bgColor: 'rgba(229, 190, 82, 0.16)',
    yieldLabel: '금화·금융 특화',
  },
  harbor: {
    nameEn: 'Harbor',
    nameKo: '항만구역',
    shortKo: '항만',
    color: '#3CA4C4',
    bgColor: 'rgba(60, 164, 196, 0.16)',
    yieldLabel: '해상 물류 특화',
  },
  entertainment_complex: {
    nameEn: 'Entertainment Complex',
    nameKo: '유흥·관광단지',
    shortKo: '관광',
    color: '#C780D6',
    bgColor: 'rgba(199, 128, 214, 0.16)',
    yieldLabel: '문화·관광 특화',
  },
  government_plaza: {
    nameEn: 'Government Plaza',
    nameKo: '정부청사',
    shortKo: '행정',
    color: '#A594EB',
    bgColor: 'rgba(165, 148, 235, 0.16)',
    yieldLabel: '공공행정 특화',
  },
  farming_district: {
    nameEn: 'Farming District',
    nameKo: '농업지구',
    shortKo: '농업',
    color: '#7EC468',
    bgColor: 'rgba(126, 196, 104, 0.16)',
    yieldLabel: '식량 생산 특화',
  },
};

export interface PolicyCardTemplate {
  id: PolicyCardId;
  slot: PolicyCardSlot;
  slotLabelKo: string;
  nameEn: string;
  nameKo: string;
  passiveBonus: string;
  secondaryEffect: string;
  accentColor: string;
}

export const POLICY_CARD_DEFINITIONS: Record<PolicyCardId, PolicyCardTemplate> = {
  industrial_base: {
    id: 'industrial_base',
    slot: 'economic',
    slotLabelKo: '경제 정책',
    nameEn: 'Industrial Base',
    nameKo: '산업 기지',
    passiveBonus: '생산력 +15% · 산업구역 인접 보너스 +2',
    secondaryEffect: '제조업 공급망 집적 및 산업단지 에너지 효율 상승',
    accentColor: '#E68A3E',
  },
  tech_hub: {
    id: 'tech_hub',
    slot: 'scientific',
    slotLabelKo: '과학 정책',
    nameEn: 'Tech Hub',
    nameKo: '테크 허브',
    passiveBonus: '과학 +20% · 캠퍼스·R&D 연구 가속',
    secondaryEffect: 'ICT·전문과학기술 인재 밀집 및 산학연 기술 파급',
    accentColor: '#58B0F0',
  },
  financial_capital: {
    id: 'financial_capital',
    slot: 'economic',
    slotLabelKo: '경제 정책',
    nameEn: 'Financial Capital',
    nameKo: '금융 중추',
    passiveBonus: '금화 +20% · 상업중심지 자본 수익 +2',
    secondaryEffect: '금융·보험 본사 집중 및 광역 서비스 무역 수지 강화',
    accentColor: '#E5BE52',
  },
  maritime_gateway: {
    id: 'maritime_gateway',
    slot: 'maritime',
    slotLabelKo: '해양 정책',
    nameEn: 'Maritime Gateway',
    nameKo: '해양 관문',
    passiveBonus: '국제 무역로 +2 · 항만 화물 처리 +25%',
    secondaryEffect: '무역항·해상 물류 거점 연결 및 수출입 관세 보너스',
    accentColor: '#48B3C7',
  },
  cultural_bastion: {
    id: 'cultural_bastion',
    slot: 'cultural',
    slotLabelKo: '문화 정책',
    nameEn: 'Cultural Bastion',
    nameKo: '문화·관광 거점',
    passiveBonus: '문화 +15% · 지역 쾌적도 +2 · 관광 매력 상승',
    secondaryEffect: '역사 유산·예술여가·숙박 서비스 결합 방문객 유입',
    accentColor: '#D67CC2',
  },
  civic_seat: {
    id: 'civic_seat',
    slot: 'civic',
    slotLabelKo: '행정 정책',
    nameEn: 'Civic Seat',
    nameKo: '행정·전략 중추',
    passiveBonus: '영향력 +2 · 정부청사·공공서비스 효율 +15%',
    secondaryEffect: '중앙·광역 행정기관 및 공공·방위 인프라 안정성 확보',
    accentColor: '#A594EB',
  },
  breadbasket: {
    id: 'breadbasket',
    slot: 'agrarian',
    slotLabelKo: '농업 정책',
    nameEn: 'National Breadbasket',
    nameKo: '국가 식량 창고',
    passiveBonus: '식량 +20% · 농업·어업 타일 산출 +1',
    secondaryEffect: '광활한 농경지·연안 수산 기반 및 지역 식량 자급력',
    accentColor: '#7EC468',
  },
  balanced_polis: {
    id: 'balanced_polis',
    slot: 'wildcard',
    slotLabelKo: '와일드카드 정책',
    nameEn: 'Balanced Polis',
    nameKo: '균형 발전 도시',
    passiveBonus: '모든 산출량 +5% · 주거 안정성 +1',
    secondaryEffect: '단일 산업 편중 없이 생활 서비스·제조·지식이 균형 분포',
    accentColor: '#90B4CE',
  },
};

const DISTRICT_TO_POLICY: Record<DistrictType, PolicyCardId> = {
  industrial_zone: 'industrial_base',
  campus: 'tech_hub',
  commercial_hub: 'financial_capital',
  harbor: 'maritime_gateway',
  entertainment_complex: 'cultural_bastion',
  government_plaza: 'civic_seat',
  farming_district: 'breadbasket',
};

/**
 * 시군구 실제 주력 산업·특화 지구·R&D·항만 데이터를 기반으로 고유 Policy Card 자동 산출
 */
export function deriveCityPolicyCard(params: {
  districts: ComputedDistrict[];
  citizens: CitizenBreakdown[];
  shares: Record<IndustryKey, number>;
  universityRd100M: number;
  hasTradePort?: boolean;
  freightVolumeMt: number;
}): PolicyCard {
  const { districts, citizens, shares, universityRd100M, hasTradePort, freightVolumeMt } = params;
  const citizenMap = new Map<IndustryKey, CitizenBreakdown>();
  for (const c of citizens) citizenMap.set(c.industry, c);

  const makeCard = (id: PolicyCardId, triggerRule: string): PolicyCard => ({
    ...POLICY_CARD_DEFINITIONS[id],
    triggerRule,
  });

  // 1순위: 규칙 기반 최상위 특화 지구(LQ ≥ 1.5, 종사자 ≥ 5,000명)가 있는 경우
  const primaryDistrict = districts[0];
  if (primaryDistrict) {
    // R&D 초대형 캠퍼스 거점(예: 대전·성남)과 제조 초강세 거점(예: 화성·울산) 우선 반영
    const cardId = DISTRICT_TO_POLICY[primaryDistrict.type];
    const indLabel = INDUSTRY_META[primaryDistrict.industry].shortKo;
    if (cardId === 'tech_hub' && universityRd100M >= 1500) {
      return makeCard(
        'tech_hub',
        `${indLabel} ${primaryDistrict.sharePct.toFixed(1)}% (LQ ${primaryDistrict.lq.toFixed(2)}×) · 대학 R&D ${universityRd100M.toLocaleString('ko-KR')}억`
      );
    }
    if (cardId === 'maritime_gateway') {
      return makeCard(
        'maritime_gateway',
        `무역항 보유 · ${indLabel} ${primaryDistrict.sharePct.toFixed(1)}% (LQ ${primaryDistrict.lq.toFixed(2)}×) · 물동량 ${freightVolumeMt.toFixed(0)}Mt`
      );
    }
    return makeCard(
      cardId,
      `${indLabel} 비중 ${primaryDistrict.sharePct.toFixed(1)}% (전국 대비 LQ ${primaryDistrict.lq.toFixed(2)}×)`
    );
  }

  // 2순위: 특화 지구(5천명 기준) 미만 중소 시·군에서도 뚜렷한 주력 산업 특화 반영
  const ict = citizenMap.get('ictScience');
  const fin = citizenMap.get('finance');
  const mfg = citizenMap.get('manufacturing');
  const logi = citizenMap.get('logistics');
  const hosp = citizenMap.get('hospitality');
  const pub = citizenMap.get('publicAdmin');
  const agri = citizenMap.get('agriculture');

  if ((ict && ict.lq >= 1.3 && shares.ictScience >= 7.5) || universityRd100M >= 3500) {
    return makeCard(
      'tech_hub',
      `IT·과학 ${shares.ictScience.toFixed(1)}% · 대학 R&D ${universityRd100M.toLocaleString('ko-KR')}억원`
    );
  }
  if (fin && fin.lq >= 1.4 && shares.finance >= 3.8) {
    return makeCard(
      'financial_capital',
      `금융·보험 비중 ${shares.finance.toFixed(1)}% (LQ ${fin.lq.toFixed(2)}×)`
    );
  }
  if (hasTradePort && ((logi && logi.lq >= 1.15) || freightVolumeMt >= 55)) {
    return makeCard(
      'maritime_gateway',
      `무역항 보유 · 연간 화물 물동량 ${freightVolumeMt.toFixed(1)}백만톤`
    );
  }
  if (mfg && (mfg.lq >= 1.25 || shares.manufacturing >= 24)) {
    return makeCard(
      'industrial_base',
      `제조업 비중 ${shares.manufacturing.toFixed(1)}% (LQ ${mfg.lq.toFixed(2)}×)`
    );
  }
  if (agri && (shares.agriculture >= 18 || agri.lq >= 2.2)) {
    return makeCard(
      'breadbasket',
      `농림어업 비중 ${shares.agriculture.toFixed(1)}% (LQ ${agri.lq.toFixed(2)}×)`
    );
  }
  if (pub && (pub.lq >= 1.4 || shares.publicAdmin >= 13)) {
    return makeCard(
      'civic_seat',
      `공공행정 비중 ${shares.publicAdmin.toFixed(1)}% (LQ ${pub.lq.toFixed(2)}×)`
    );
  }
  if (hosp && (hosp.lq >= 1.25 || shares.hospitality >= 18)) {
    return makeCard(
      'cultural_bastion',
      `관광·예술여가 비중 ${shares.hospitality.toFixed(1)}% (LQ ${hosp.lq.toFixed(2)}×)`
    );
  }

  // 3순위: 산업이 고르게 분포된 균형형 도시
  const topCit = [...citizens].sort((a, b) => b.sharePct - a.sharePct)[0];
  return makeCard(
    'balanced_polis',
    topCit
      ? `최대 업종 ${INDUSTRY_META[topCit.industry].shortKo} ${topCit.sharePct.toFixed(1)}% · 다극 균형 산업 구조`
      : '복합 서비스 · 균형 산업 구조'
  );
}

export const LENS_DEFINITIONS: LensDefinition[] = [
  // ── 1. 핵심 문명 렌즈 (5) ──
  {
    id: 'terrain',
    nameKo: '지형 · 토지피복',
    shortName: '지형',
    civTerm: 'Terrain & Relief',
    phase: 1,
    category: 'core',
    unit: '표고 m',
    description: '토지피복 대분류(시가화·농업·산림·초지·습지)와 DEM 기복(구릉 ≥300m, 산악 ≥600m)을 결합한 기본 문명 지도입니다.',
    sourceLabel: '국토지리정보원 DEM · 기후에너지환경부 토지피복',
    legendStops: [
      { color: '#8E8477', label: '시가화' },
      { color: '#97A857', label: '농업' },
      { color: '#396144', label: '산림' },
      { color: '#475559', label: '산악' },
      { color: '#4A7872', label: '습지' },
    ],
  },
  {
    id: 'grdp',
    nameKo: 'GRDP (경제 규모)',
    shortName: 'GRDP',
    civTerm: 'Gold Yield',
    phase: 1,
    category: 'core',
    unit: '억원/타일',
    description: '시군구 지역내총생산(GRDP)을 격자 인구 비중으로 가중 배분한 경제 밀도입니다.',
    sourceLabel: '국가데이터처 KOSIS 시군구 GRDP (2022–2024)',
    legendStops: [
      { color: '#1B2838', label: '< 500억' },
      { color: '#4A4728', label: '2,000억' },
      { color: '#8F7B2E', label: '8,000억' },
      { color: '#D4A84B', label: '3조원' },
      { color: '#FFF0A8', label: '10조원+' },
    ],
  },
  {
    id: 'grdp_per_capita',
    nameKo: '1인당 GRDP',
    shortName: '1인당 GRDP',
    civTerm: 'Gold per Citizen',
    phase: 1,
    category: 'core',
    unit: '만원',
    description: '지역 주민 1인당 지역내총생산입니다. 산업단지·석유화학·반도체·조선 거점 도시가 높게 나타납니다.',
    sourceLabel: '국가데이터처 KOSIS GRDP / 주민등록인구',
    legendStops: [
      { color: '#213347', label: '2,500만' },
      { color: '#2E6278', label: '3,800만' },
      { color: '#4B997C', label: '5,000만' },
      { color: '#C7B046', label: '7,000만' },
      { color: '#F2DC79', label: '9,500만+' },
    ],
  },
  {
    id: 'population_density',
    nameKo: '인구밀도',
    shortName: '인구밀도',
    civTerm: 'Population',
    phase: 1,
    category: 'core',
    unit: '명/km²',
    description: '5km 육각 타일(21.7km²) 기준 격자 인구밀도입니다. 수도권과 광역시 핵심축이 선명하게 드러납니다.',
    sourceLabel: '국가데이터처 SGIS 격자 인구 기반 (2024)',
    legendStops: [
      { color: '#162536', label: '< 50' },
      { color: '#244A6E', label: '200' },
      { color: '#397CA8', label: '800' },
      { color: '#E09A48', label: '3,000' },
      { color: '#F75B43', label: '10,000+' },
    ],
  },
  {
    id: 'manufacturing_share',
    nameKo: '제조업 비중',
    shortName: '제조업',
    civTerm: 'Production Yield',
    phase: 1,
    category: 'core',
    unit: '%',
    description: '전체 종사자 중 제조업 종사자 비율입니다. 경기 남부·충남 북부·경북·동남권 산업벨트가 두드러집니다.',
    sourceLabel: '국가데이터처 전국사업체조사 (2023)',
    legendStops: [
      { color: '#1C2633', label: '< 8%' },
      { color: '#4C3629', label: '16%' },
      { color: '#8C4C27', label: '26%' },
      { color: '#D4732A', label: '36%' },
      { color: '#FFB057', label: '48%+' },
    ],
  },

  // ── 2. 소득 · 학위 · 신앙 · 보건 · 사회경제 렌즈 (8) ──
  {
    id: 'income',
    nameKo: '평균 근로소득',
    shortName: '소득',
    civTerm: 'Income',
    phase: 2,
    category: 'society',
    unit: '만원/년',
    description: '국세청 연말정산 근로소득 기준 시군구별 평균 급여입니다. 과천·서울·판교(성남)·울산·화성·이천이 최상위권입니다.',
    sourceLabel: '국세청 국세통계포털(TASIS) 시군구 근로소득',
    legendStops: [
      { color: '#182433', label: '3,200만' },
      { color: '#274C5E', label: '3,800만' },
      { color: '#3C7F6B', label: '4,400만' },
      { color: '#A5A847', label: '5,200만' },
      { color: '#F5DA6E', label: '6,200만+' },
    ],
  },
  {
    id: 'education',
    nameKo: '학위 · 대졸 이상 비중',
    shortName: '학위',
    civTerm: 'Degrees',
    phase: 2,
    category: 'society',
    unit: '%',
    description: '25세 이상 인구 중 전문대졸·대졸 이상 고등교육 이수자 비중입니다. 세종·과천·서울·성남·용인·대전이 높습니다.',
    sourceLabel: '국가데이터처 인구주택총조사 교육정도별 인구',
    legendStops: [
      { color: '#162233', label: '< 28%' },
      { color: '#243C66', label: '38%' },
      { color: '#39619E', label: '48%' },
      { color: '#6193D9', label: '58%' },
      { color: '#B3DCFF', label: '65%+' },
    ],
  },
  {
    id: 'faith',
    nameKo: '신앙 · 종교 · 문화유산',
    shortName: '신앙',
    civTerm: 'Faith & Heritage',
    phase: 2,
    category: 'society',
    unit: '%',
    description: '지역 종교인구 비율과 전통 사찰·성지·유네스코 문화유산 밀집도를 반영한 신앙(Faith) 지표입니다.',
    sourceLabel: '국가데이터처 종교인구 · 국가유산청 문화유산',
    legendStops: [
      { color: '#192234', label: '< 36%' },
      { color: '#3B2F5E', label: '41%' },
      { color: '#69448C', label: '46%' },
      { color: '#A366BA', label: '51%' },
      { color: '#E3B0F5', label: '56%+' },
    ],
  },
  {
    id: 'culture',
    nameKo: '문화 · 유산·박물관 밀도',
    shortName: '문화',
    civTerm: 'Culture Hotspots',
    phase: 2,
    category: 'society',
    unit: '밀도 지수',
    description:
      '전국 30대 문화유산·국립박물관·역사 랜드마크의 공간 분포를 5km 육각 격자에 가우시안 밀도로 투영한 문화 핫스팟 지도입니다.',
    sourceLabel: '국가유산청 · 국립중앙박물관 · 문화체육관광부',
    legendStops: [
      { color: '#171E30', label: '낮음' },
      { color: '#382452', label: '25' },
      { color: '#733178', label: '50' },
      { color: '#C44D9C', label: '75' },
      { color: '#FFAE82', label: '핫스팟' },
    ],
  },
  {
    id: 'health',
    nameKo: '보건 · 기대수명',
    shortName: '기대수명',
    civTerm: 'Health',
    phase: 2,
    category: 'society',
    unit: '세',
    description: '시군구별 출생 시 기대수명(세) 및 의료 인프라 접근성 지표입니다. 수도권 신도시·과천·서울이 85세 이상으로 높습니다.',
    sourceLabel: '국가데이터처 시군구 생명표 · 질병관리청 건강조사',
    legendStops: [
      { color: '#3B2938', label: '81.0세' },
      { color: '#5D4858', label: '82.2세' },
      { color: '#3A6F7D', label: '83.2세' },
      { color: '#45A38C', label: '84.2세' },
      { color: '#9BE8B8', label: '85.4세+' },
    ],
  },
  {
    id: 'housing',
    nameKo: '주거 · 주택가격',
    shortName: '주택가격',
    civTerm: 'Housing',
    phase: 2,
    category: 'society',
    unit: '만원/3.3m²',
    description: '한국부동산원 실거래 기반 시군구별 아파트 3.3m²(평)당 평균 매매가격입니다. 수도권 핵심지와 지방 격차가 뚜렷합니다.',
    sourceLabel: '한국부동산원 R-ONE · 국토교통부 실거래가',
    legendStops: [
      { color: '#182433', label: '< 700만' },
      { color: '#2F4663', label: '1,200만' },
      { color: '#6E5A82', label: '2,000만' },
      { color: '#C46C7C', label: '3,200만' },
      { color: '#FFA396', label: '4,500만+' },
    ],
  },
  {
    id: 'aging_rate',
    nameKo: '고령 인구 비율',
    shortName: '고령화율',
    civTerm: 'Demographics',
    phase: 2,
    category: 'society',
    unit: '%',
    description: '65세 이상 고령 인구 비율입니다. 초고령 농어촌 군 지역(40%+)과 젊은 신도시(세종·화성 등)의 대비를 보여줍니다.',
    sourceLabel: '행정안전부 주민등록인구통계 (2024–2025)',
    legendStops: [
      { color: '#235E69', label: '< 14%' },
      { color: '#3B8272', label: '20%' },
      { color: '#B8A64C', label: '28%' },
      { color: '#CF6C3E', label: '36%' },
      { color: '#B83333', label: '44%+' },
    ],
  },
  {
    id: 'science_ict',
    nameKo: 'IT · 과학기술 비중',
    shortName: '과학·IT',
    civTerm: 'Science Yield',
    phase: 2,
    category: 'society',
    unit: '%',
    description: '정보통신업 및 전문·과학·기술 서비스업 종사자 비중입니다. 서울·성남(판교)·대전(대덕)·과천·포항이 중심입니다.',
    sourceLabel: '국가데이터처 전국사업체조사 (2023)',
    legendStops: [
      { color: '#162336', label: '< 2%' },
      { color: '#1D416B', label: '5%' },
      { color: '#286AA8', label: '10%' },
      { color: '#46A4E6', label: '18%' },
      { color: '#A6E1FF', label: '25%+' },
    ],
  },
  {
    id: 'finance_share',
    nameKo: '금융 · 보험 비중',
    shortName: '금융·상업',
    civTerm: 'Commercial Hub',
    phase: 2,
    category: 'society',
    unit: '%',
    description: '금융 및 보험업 종사자 비중입니다. 서울(여의도·명동·강남), 부산(문현금융단지) 등에 집중되어 있습니다.',
    sourceLabel: '국가데이터처 전국사업체조사 (2023)',
    legendStops: [
      { color: '#182433', label: '< 1.5%' },
      { color: '#3F4630', label: '2.5%' },
      { color: '#7D7632', label: '3.5%' },
      { color: '#C9A93E', label: '5.0%' },
      { color: '#FCE074', label: '7.0%+' },
    ],
  },

  // ── 3. 인프라 · 식량 · 화물 · 재난 · 역사 렌즈 (6) ──
  {
    id: 'agriculture_food',
    nameKo: '농림어업 · 식량',
    shortName: '농림·식량',
    civTerm: 'Food Yield',
    phase: 2,
    category: 'infra',
    unit: '%',
    description: '농림어업 종사자 비중과 평야 지대 식량 생산 기반을 보여줍니다. 호남평야·전남 해안·경북 북부가 높습니다.',
    sourceLabel: '국가데이터처 농림어업총조사 · 토지피복',
    legendStops: [
      { color: '#192630', label: '< 3%' },
      { color: '#2B4D3A', label: '10%' },
      { color: '#457D49', label: '20%' },
      { color: '#7BB559', label: '32%' },
      { color: '#C2E378', label: '42%+' },
    ],
  },
  {
    id: 'freight_logistics',
    nameKo: '화물 · 물류 흐름',
    shortName: '화물·물류',
    civTerm: 'Freight Flows',
    phase: 2,
    category: 'infra',
    unit: '백만톤/년',
    description: '항만·공항·내륙물류기지 및 권역 간 화물 OD(경부축·서해안축·반도체축) 물동량 흐름을 시각화합니다.',
    sourceLabel: '국토교통부 국가교통DB(KTDB) · 해양수산부 PORT-MIS',
    legendStops: [
      { color: '#162333', label: '< 5Mt' },
      { color: '#1F465E', label: '15Mt' },
      { color: '#29778F', label: '40Mt' },
      { color: '#48B3C7', label: '100Mt' },
      { color: '#9EF0FF', label: '200Mt+' },
    ],
  },
  {
    id: 'power_capacity',
    nameKo: '발전 설비용량',
    shortName: '발전 설비',
    civTerm: 'Power Grid',
    phase: 2,
    category: 'infra',
    unit: 'MW',
    description: '원자력·화력·복합·양수 등 지역별 발전 설비용량(MW)입니다. 동해안 원전 벨트와 충남 서해안 화력 벨트가 핵심입니다.',
    sourceLabel: '한국전력거래소 EPSIS 발전설비 현황 (2024)',
    legendStops: [
      { color: '#172230', label: '0 MW' },
      { color: '#323E59', label: '500' },
      { color: '#614F8A', label: '2,000' },
      { color: '#AD5C9E', label: '5,000' },
      { color: '#F5B547', label: '8,000+' },
    ],
  },
  {
    id: 'university_rd',
    nameKo: '대학 연구비',
    shortName: '대학 R&D',
    civTerm: 'Academic R&D',
    phase: 2,
    category: 'infra',
    unit: '억원',
    description: '소재 대학의 연간 연구비 총액(교원 1인당 연구비 × 전임교원 수 환산)입니다.',
    sourceLabel: '대학알리미 교원·연구 현황 (2024)',
    legendStops: [
      { color: '#162130', label: '0억' },
      { color: '#203E5E', label: '300억' },
      { color: '#2D669C', label: '1,500억' },
      { color: '#4E9DE0', label: '5,000억' },
      { color: '#A3E4FF', label: '15,000억+' },
    ],
  },
  {
    id: 'disaster_damage',
    nameKo: '자연재해 피해액',
    shortName: '자연재해',
    civTerm: 'Disasters',
    phase: 2,
    category: 'infra',
    unit: '억원/10년',
    description: '최근 10년 누적 태풍·호우·산불 등 자연재해 피해 규모입니다. 동해안 산불·태풍 경로 및 남해안 지역이 높습니다.',
    sourceLabel: '행정안전부 재해연보 (2015–2024)',
    legendStops: [
      { color: '#1B2734', label: '< 50억' },
      { color: '#4F3438', label: '200억' },
      { color: '#8F3E3A', label: '600억' },
      { color: '#D14B36', label: '1,500억' },
      { color: '#FF8A5B', label: '3,000억+' },
    ],
  },
  {
    id: 'history',
    nameKo: '역사 · 센서스 변천',
    shortName: '역사',
    civTerm: 'History',
    phase: 2,
    category: 'infra',
    unit: '증감 % / 밀도',
    description:
      '2010·2015·2020·2024 인구주택총조사(SGIS·KOSIS) 실측 데이터로 과거 인구밀도, 인구 증감률, 행정구역 경계 변천을 비교합니다.',
    sourceLabel: '국가데이터처 SGIS · KOSIS 인구주택총조사 (2010–2024)',
    legendStops: [
      { color: '#B5383E', label: '-25%↓' },
      { color: '#C97B59', label: '-10%' },
      { color: '#2F4358', label: '0%' },
      { color: '#398A7A', label: '+15%' },
      { color: '#6CD49A', label: '+35%↑' },
    ],
  },
];
