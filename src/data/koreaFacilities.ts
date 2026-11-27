import type { DataSourceInfo, FacilityPoint } from '../types/civ';
import { CIV_RULES } from './rules';

/**
 * 23개 대한민국 국립공원 (국립공원공단 탐방객 통계 기반)
 * 규칙: 탐방객 수 상위 5곳을 자연 불가사의(Natural Wonder)로 자동 선정
 */
const RAW_NATIONAL_PARKS: Omit<FacilityPoint, 'isWonder' | 'wonderKind' | 'wonderRank'>[] = [
  { id: 'np_bukhansan', name: '북한산국립공원', type: 'national_park', cityId: 'seoul', province: 'seoul', lat: 37.659, lon: 126.978, metricValue: 682, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_gyeongju', name: '경주국립공원', type: 'national_park', cityId: 'gyeongju', province: 'gyeongbuk', lat: 35.790, lon: 129.332, metricValue: 412, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '사적형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_jirisan', name: '지리산국립공원', type: 'national_park', cityId: 'sancheong', province: 'gyeongnam', lat: 35.337, lon: 127.731, metricValue: 358, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원 (제1호)', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_seoraksan', name: '설악산국립공원', type: 'national_park', cityId: 'sokcho', province: 'gangwon', lat: 38.119, lon: 128.465, metricValue: 334, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_hallyeo', name: '한려해상국립공원', type: 'national_park', cityId: 'tongyeong', province: 'gyeongnam', lat: 34.815, lon: 128.432, metricValue: 321, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '해상·해안형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_mudeungsan', name: '무등산국립공원', type: 'national_park', cityId: 'gwangju', province: 'gwangju', lat: 35.134, lon: 126.989, metricValue: 268, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_palgongsan', name: '팔공산국립공원', type: 'national_park', cityId: 'daegu', province: 'daegu', lat: 36.016, lon: 128.695, metricValue: 245, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원 (제23호)', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_taean', name: '태안해안국립공원', type: 'national_park', cityId: 'taean', province: 'chungnam', lat: 36.742, lon: 126.185, metricValue: 238, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '해상·해안형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_dadohae', name: '다도해해상국립공원', type: 'national_park', cityId: 'wando', province: 'jeonnam', lat: 34.335, lon: 126.685, metricValue: 224, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '해상·해안형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_naejangsan', name: '내장산국립공원', type: 'national_park', cityId: 'jeongeup', province: 'jeonbuk', lat: 35.487, lon: 126.889, metricValue: 215, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_gyeryongsan', name: '계룡산국립공원', type: 'national_park', cityId: 'gongju', province: 'chungnam', lat: 36.342, lon: 127.206, metricValue: 196, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_deogyusan', name: '덕유산국립공원', type: 'national_park', cityId: 'muju', province: 'jeonbuk', lat: 35.860, lon: 127.746, metricValue: 188, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_byeonsan', name: '변산반도국립공원', type: 'national_park', cityId: 'buan', province: 'jeonbuk', lat: 35.672, lon: 126.535, metricValue: 179, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '해상·해안형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_odaesan', name: '오대산국립공원', type: 'national_park', cityId: 'pyeongchang', province: 'gangwon', lat: 37.796, lon: 128.543, metricValue: 162, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_hallasan', name: '한라산국립공원', type: 'national_park', cityId: 'jeju_si', province: 'jeju', lat: 33.362, lon: 126.533, metricValue: 148, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '화산·산악형 (탐방예약제)', sourceNote: '제주도 세계유산본부 (2025)' },
  { id: 'np_songnisan', name: '속리산국립공원', type: 'national_park', cityId: 'boeun', province: 'chungbuk', lat: 36.544, lon: 127.871, metricValue: 141, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_sobaeksan', name: '소백산국립공원', type: 'national_park', cityId: 'danyang', province: 'chungbuk', lat: 36.957, lon: 128.485, metricValue: 126, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_woraksan', name: '월악산국립공원', type: 'national_park', cityId: 'jecheon', province: 'chungbuk', lat: 36.886, lon: 128.106, metricValue: 118, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_chiaksan', name: '치악산국립공원', type: 'national_park', cityId: 'wonju', province: 'gangwon', lat: 37.365, lon: 128.056, metricValue: 112, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_juwangsan', name: '주왕산국립공원', type: 'national_park', cityId: 'cheongsong', province: 'gyeongbuk', lat: 36.395, lon: 129.155, metricValue: 96, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_gayasan', name: '가야산국립공원', type: 'national_park', cityId: 'hapcheon', province: 'gyeongnam', lat: 35.822, lon: 128.119, metricValue: 92, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_taebaeksan', name: '태백산국립공원', type: 'national_park', cityId: 'taebaek', province: 'gangwon', lat: 37.097, lon: 128.917, metricValue: 84, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
  { id: 'np_wolchulsan', name: '월출산국립공원', type: 'national_park', cityId: 'yeongam', province: 'jeonnam', lat: 34.767, lon: 126.704, metricValue: 68, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '산악형 국립공원', sourceNote: '국립공원공단 탐방객 통계 (2025)' },
];

/**
 * 주요 연구중심 대학 (대학알리미 연구비 총액 기반)
 * 규칙: 연간 연구비 총액 상위 5곳을 학문 불가사의(Academic Wonder)로 자동 선정
 */
const RAW_UNIVERSITIES: Omit<FacilityPoint, 'isWonder' | 'wonderKind' | 'wonderRank'>[] = [
  { id: 'univ_snu', name: '서울대학교', type: 'university', cityId: 'seoul', province: 'seoul', lat: 37.460, lon: 126.952, metricValue: 8140, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '국가거점 국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_yonsei', name: '연세대학교', type: 'university', cityId: 'seoul', province: 'seoul', lat: 37.565, lon: 126.939, metricValue: 6420, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 연구중심대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_kaist', name: 'KAIST (한국과학기술원)', type: 'university', cityId: 'daejeon', province: 'daejeon', lat: 36.372, lon: 127.360, metricValue: 5890, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '과학기술특성화대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_korea', name: '고려대학교', type: 'university', cityId: 'seoul', province: 'seoul', lat: 37.590, lon: 127.032, metricValue: 5180, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 연구중심대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_skku', name: '성균관대학교', type: 'university', cityId: 'suwon', province: 'gyeonggi', lat: 37.294, lon: 126.975, metricValue: 4960, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 연구중심대학 (자연과학캠퍼스)', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_hanyang', name: '한양대학교', type: 'university', cityId: 'seoul', province: 'seoul', lat: 37.557, lon: 127.046, metricValue: 3820, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 연구중심대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_postech', name: 'POSTECH (포항공과대)', type: 'university', cityId: 'pohang', province: 'gyeongbuk', lat: 36.014, lon: 129.322, metricValue: 3340, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '과학기술특성화대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_pnu', name: '부산대학교', type: 'university', cityId: 'busan', province: 'busan', lat: 35.233, lon: 129.079, metricValue: 2680, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_knu', name: '경북대학교', type: 'university', cityId: 'daegu', province: 'daegu', lat: 35.889, lon: 128.610, metricValue: 2490, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_khu', name: '경희대학교', type: 'university', cityId: 'yongin', province: 'gyeonggi', lat: 37.243, lon: 127.081, metricValue: 2380, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 종합대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_jnu_gj', name: '전남대학교', type: 'university', cityId: 'gwangju', province: 'gwangju', lat: 35.176, lon: 126.906, metricValue: 2210, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_cnu', name: '충남대학교', type: 'university', cityId: 'daejeon', province: 'daejeon', lat: 36.369, lon: 127.344, metricValue: 2040, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_unist', name: 'UNIST (울산과학기술원)', type: 'university', cityId: 'ulsan', province: 'ulsan', lat: 35.573, lon: 129.189, metricValue: 1980, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '과학기술특성화대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_cau', name: '중앙대학교', type: 'university', cityId: 'seoul', province: 'seoul', lat: 37.505, lon: 126.957, metricValue: 1860, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 종합대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_jbnu', name: '전북대학교', type: 'university', cityId: 'jeonju', province: 'jeonbuk', lat: 35.847, lon: 127.129, metricValue: 1740, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_inha', name: '인하대학교', type: 'university', cityId: 'incheon', province: 'incheon', lat: 37.450, lon: 126.654, metricValue: 1620, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 종합대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_cbnu', name: '충북대학교', type: 'university', cityId: 'cheongju', province: 'chungbuk', lat: 36.628, lon: 127.456, metricValue: 1580, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_ajou', name: '아주대학교', type: 'university', cityId: 'suwon', province: 'gyeonggi', lat: 37.283, lon: 127.044, metricValue: 1510, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 종합대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_gist', name: 'GIST (광주과학기술원)', type: 'university', cityId: 'gwangju', province: 'gwangju', lat: 35.228, lon: 126.843, metricValue: 1460, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '과학기술특성화대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_kangwon', name: '강원대학교', type: 'university', cityId: 'chuncheon', province: 'gangwon', lat: 37.869, lon: 127.744, metricValue: 1380, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_gnu', name: '경상국립대학교', type: 'university', cityId: 'jinju', province: 'gyeongnam', lat: 35.154, lon: 128.098, metricValue: 1320, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_dgist', name: 'DGIST (대구경북과기원)', type: 'university', cityId: 'daegu', province: 'daegu', lat: 35.702, lon: 128.455, metricValue: 1180, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '과학기술특성화대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_yeungnam', name: '영남대학교', type: 'university', cityId: 'gyeongsan', province: 'gyeongbuk', lat: 35.831, lon: 128.754, metricValue: 1120, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '사립 종합대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
  { id: 'univ_jeju', name: '제주대학교', type: 'university', cityId: 'jeju_si', province: 'jeju', lat: 33.455, lon: 126.562, metricValue: 960, metricUnit: '억원/년', metricLabel: '연간 연구비', subCategory: '거점국립대학', sourceNote: '대학알리미 연구비 수주 현황 (2024)' },
];

/**
 * 주요 발전소 (EPSIS 발전기 현황, 규칙: 설비용량 500MW 이상)
 */
const RAW_POWER_PLANTS: FacilityPoint[] = (
  [
    { id: 'pp_hanul', name: '한울·신한울 원자력본부', type: 'power_plant', cityId: 'uljin', province: 'gyeongbuk', lat: 37.092, lon: 129.383, metricValue: 8700, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '원자력 (8기 가동)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_hanbit', name: '한빛 원자력본부', type: 'power_plant', cityId: 'yeonggwang', province: 'jeonnam', lat: 35.415, lon: 126.416, metricValue: 5900, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '원자력 (6기)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_dangjin', name: '당진화력발전소', type: 'power_plant', cityId: 'dangjin', province: 'chungnam', lat: 37.055, lon: 126.512, metricValue: 6040, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력 (10기)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_taean', name: '태안화력발전소', type: 'power_plant', cityId: 'taean', province: 'chungnam', lat: 36.904, lon: 126.235, metricValue: 6100, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄·IGCC (10기)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_kori', name: '고리·새울 원자력본부', type: 'power_plant', cityId: 'busan', province: 'busan', lat: 35.320, lon: 129.291, metricValue: 6420, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '원자력 (기장·울주)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_yeongheung', name: '영흥화력발전소', type: 'power_plant', cityId: 'incheon', province: 'incheon', lat: 37.242, lon: 126.438, metricValue: 5080, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력 (수도권 핵심)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_boryeong', name: '보령·신보령 화력', type: 'power_plant', cityId: 'boryeong', province: 'chungnam', lat: 36.404, lon: 126.491, metricValue: 5000, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄·LNG 복합', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_wolseong', name: '월성·신월성 원자력본부', type: 'power_plant', cityId: 'gyeongju', province: 'gyeongbuk', lat: 35.713, lon: 129.476, metricValue: 4100, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '원자력 (중수로·경수로)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_hadong', name: '하동화력발전소', type: 'power_plant', cityId: 'hadong', province: 'gyeongnam', lat: 34.954, lon: 127.821, metricValue: 4000, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력 (8기)', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_samcheonpo', name: '삼천포·고성하이 화력', type: 'power_plant', cityId: 'goseong_gn', province: 'gyeongnam', lat: 34.912, lon: 128.110, metricValue: 4200, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_samcheok', name: '삼척그린파워·블루파워', type: 'power_plant', cityId: 'samcheok', province: 'gangwon', lat: 37.186, lon: 129.342, metricValue: 4140, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_incheon_lng', name: '서인천·신인천·포스코 LNG', type: 'power_plant', cityId: 'incheon', province: 'incheon', lat: 37.562, lon: 126.605, metricValue: 5600, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_pyeongtaek', name: '평택복합화력', type: 'power_plant', cityId: 'pyeongtaek', province: 'gyeonggi', lat: 36.992, lon: 126.824, metricValue: 2800, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_ulsan_lng', name: '울산복합화력', type: 'power_plant', cityId: 'ulsan', province: 'ulsan', lat: 35.485, lon: 129.376, metricValue: 3200, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_gwangyang_lng', name: '광양·여수 복합화력', type: 'power_plant', cityId: 'gwangyang', province: 'jeonnam', lat: 34.906, lon: 127.734, metricValue: 2650, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합·부생가스', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_gangneung_anin', name: '강릉안인화력', type: 'power_plant', cityId: 'gangneung', province: 'gangwon', lat: 37.728, lon: 128.985, metricValue: 2080, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_donghae', name: '북평·동해 화력', type: 'power_plant', cityId: 'donghae', province: 'gangwon', lat: 37.475, lon: 129.152, metricValue: 1590, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄·바이오매스', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_paju_lng', name: '파주천연가스발전소', type: 'power_plant', cityId: 'paju', province: 'gyeonggi', lat: 37.826, lon: 126.805, metricValue: 1820, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_pocheon_lng', name: '포천복합화력', type: 'power_plant', cityId: 'pocheon', province: 'gyeonggi', lat: 37.901, lon: 127.205, metricValue: 1560, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_seocheon', name: '신서천화력', type: 'power_plant', cityId: 'seocheon', province: 'chungnam', lat: 36.136, lon: 126.526, metricValue: 1000, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '석탄화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_yangyang', name: '양양양수발전소', type: 'power_plant', cityId: 'yangyang', province: 'gangwon', lat: 37.992, lon: 128.532, metricValue: 1000, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '양수발전', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_sancheong', name: '산청양수발전소', type: 'power_plant', cityId: 'sancheong', province: 'gyeongnam', lat: 35.352, lon: 127.845, metricValue: 700, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '양수발전', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_yecheon', name: '예천양수발전소', type: 'power_plant', cityId: 'yecheon', province: 'gyeongbuk', lat: 36.742, lon: 128.431, metricValue: 800, metricUnit: 'MW', metricLabel: '설비용량', subCategory: '양수발전', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_sejong_lng', name: '세종천연가스·열병합', type: 'power_plant', cityId: 'sejong', province: 'sejong', lat: 36.512, lon: 127.285, metricValue: 1050, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 열병합', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_gunsan_lng', name: '군산복합화력', type: 'power_plant', cityId: 'gunsan', province: 'jeonbuk', lat: 35.962, lon: 126.621, metricValue: 718, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG 복합화력', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
    { id: 'pp_jeju_wind', name: '제주 복합·해상풍력 클러스터', type: 'power_plant', cityId: 'jeju_si', province: 'jeju', lat: 33.541, lon: 126.632, metricValue: 1120, metricUnit: 'MW', metricLabel: '설비용량', subCategory: 'LNG·풍력·태양광', sourceNote: 'EPSIS 발전설비 현황 (2024)' },
  ] satisfies FacilityPoint[]
).filter((p) => p.metricValue >= CIV_RULES.facilities.powerPlantMinMw);

/**
 * 주요 무역항 (해양수산부 수출입 항만물동량 통계)
 */
const RAW_PORTS: FacilityPoint[] = [
  { id: 'port_busan', name: '부산항 (신항·북항)', type: 'port', cityId: 'busan', province: 'busan', lat: 35.095, lon: 129.048, metricValue: 2315, metricUnit: '만 TEU', metricLabel: '컨테이너 처리', subCategory: '세계 7위 메가허브항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_incheon', name: '인천항', type: 'port', cityId: 'incheon', province: 'incheon', lat: 37.452, lon: 126.608, metricValue: 355, metricUnit: '만 TEU', metricLabel: '컨테이너 처리', subCategory: '수도권 관문항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_gwangyang', name: '광양항·여수항', type: 'port', cityId: 'gwangyang', province: 'jeonnam', lat: 34.895, lon: 127.698, metricValue: 201, metricUnit: '만 TEU', metricLabel: '컨테이너·총물동량 2위', subCategory: '철강·석유화학 복합항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_ulsan', name: '울산항', type: 'port', cityId: 'ulsan', province: 'ulsan', lat: 35.502, lon: 129.381, metricValue: 192, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '국내 1위 액체화물항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_pyeongtaek', name: '평택·당진항', type: 'port', cityId: 'pyeongtaek', province: 'gyeonggi', lat: 36.968, lon: 126.826, metricValue: 116, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '국내 1위 자동차 수출입항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_daesan', name: '대산항', type: 'port', cityId: 'seosan', province: 'chungnam', lat: 37.008, lon: 126.418, metricValue: 88, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '석유화학 특화 무역항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_pohang', name: '포항항 (영일만항)', type: 'port', cityId: 'pohang', province: 'gyeongbuk', lat: 36.106, lon: 129.431, metricValue: 62, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '철강·이차전지 무역항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_donghae', name: '동해·묵호항', type: 'port', cityId: 'donghae', province: 'gangwon', lat: 37.495, lon: 129.138, metricValue: 31, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '시멘트·석탄 무역항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_gunsan', name: '군산항', type: 'port', cityId: 'gunsan', province: 'jeonbuk', lat: 35.974, lon: 126.625, metricValue: 23, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '자동차·곡물 무역항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_mokpo', name: '목포항', type: 'port', cityId: 'mokpo', province: 'jeonnam', lat: 34.782, lon: 126.382, metricValue: 24, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '서남권 자동차·연안항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_masan', name: '마산항', type: 'port', cityId: 'changwon', province: 'gyeongnam', lat: 35.195, lon: 128.584, metricValue: 18, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '기계·철재 무역항', sourceNote: '해양수산부 항만물동량 (2024)' },
  { id: 'port_jeju', name: '제주항', type: 'port', cityId: 'jeju_si', province: 'jeju', lat: 33.524, lon: 126.542, metricValue: 19, metricUnit: '백만톤', metricLabel: '연간 총물동량', subCategory: '크루즈·연안물류항', sourceNote: '해양수산부 항만물동량 (2024)' },
];

/**
 * 전국 15개 상업 공항 (인천국제공항공사 · 한국공항공사 수송실적)
 */
const RAW_AIRPORTS: FacilityPoint[] = [
  { id: 'ap_icn', name: '인천국제공항 (ICN)', type: 'airport', cityId: 'incheon', province: 'incheon', lat: 37.460, lon: 126.441, metricValue: 7116, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '동북아 메가허브 · 화물 세계 2위', sourceNote: '인천국제공항공사 (2024)' },
  { id: 'ap_cju', name: '제주국제공항 (CJU)', type: 'airport', cityId: 'jeju_si', province: 'jeju', lat: 33.511, lon: 126.493, metricValue: 2962, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '국내선 핵심 거점', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_gmp', name: '김포국제공항 (GMP)', type: 'airport', cityId: 'seoul', province: 'seoul', lat: 37.558, lon: 126.791, metricValue: 2354, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '수도권 도심·셔틀 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_pus', name: '김해국제공항 (PUS)', type: 'airport', cityId: 'busan', province: 'busan', lat: 35.179, lon: 128.938, metricValue: 1575, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '동남권 관문 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_cjj', name: '청주국제공항 (CJJ)', type: 'airport', cityId: 'cheongju', province: 'chungbuk', lat: 36.717, lon: 127.499, metricValue: 458, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '중부권 거점 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_tae', name: '대구국제공항 (TAE)', type: 'airport', cityId: 'daegu', province: 'daegu', lat: 35.894, lon: 128.659, metricValue: 342, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '대구·경북 거점 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_kwj', name: '광주공항 (KWJ)', type: 'airport', cityId: 'gwangju', province: 'gwangju', lat: 35.126, lon: 126.809, metricValue: 204, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '호남권 국내선', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_rsu', name: '여수공항 (RSU)', type: 'airport', cityId: 'yeosu', province: 'jeonnam', lat: 34.842, lon: 127.617, metricValue: 64, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '전남 동부권 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_usn', name: '울산공항 (USN)', type: 'airport', cityId: 'ulsan', province: 'ulsan', lat: 35.593, lon: 129.352, metricValue: 46, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '산업도시 셔틀 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_mwx', name: '무안국제공항 (MWX)', type: 'airport', cityId: 'muan', province: 'jeonnam', lat: 34.991, lon: 126.383, metricValue: 41, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '서남권 국제공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_kpo', name: '포항경주공항 (KPO)', type: 'airport', cityId: 'pohang', province: 'gyeongbuk', lat: 35.988, lon: 129.420, metricValue: 27, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '경북 동해안 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_hin', name: '사천공항 (HIN)', type: 'airport', cityId: 'sacheon', province: 'gyeongnam', lat: 35.088, lon: 128.070, metricValue: 24, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '서부경남·항공우주 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_wju', name: '원주공항 (WJU)', type: 'airport', cityId: 'hoengseong', province: 'gangwon', lat: 37.438, lon: 127.960, metricValue: 21, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '강원 영서 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_kuv', name: '군산공항 (KUV)', type: 'airport', cityId: 'gunsan', province: 'jeonbuk', lat: 35.904, lon: 126.616, metricValue: 18, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '전북 국내선 공항', sourceNote: '한국공항공사 항공통계 (2024)' },
  { id: 'ap_yny', name: '양양국제공항 (YNY)', type: 'airport', cityId: 'yangyang', province: 'gangwon', lat: 38.061, lon: 128.669, metricValue: 12, metricUnit: '만명/년', metricLabel: '연간 여객', subCategory: '강원 영동 국제공항', sourceNote: '한국공항공사 항공통계 (2024)' },
];

/**
 * 주요 광산 및 광업 지대 (산업통상자원부 광산 현황 · 한국광해광업공단)
 */
const RAW_MINES: FacilityPoint[] = [
  { id: 'mine_donghae_ls', name: '동해·삼척 석회석 광업지대', type: 'mine', cityId: 'donghae', province: 'gangwon', lat: 37.465, lon: 129.055, metricValue: 3200, metricUnit: '만톤/년', metricLabel: '석회석 채굴(추정)', subCategory: '국내 최대 시멘트 원료 광산', sourceNote: '한국광해광업공단 광업 현황' },
  { id: 'mine_danyang_ls', name: '단양 석회석 광산 벨트', type: 'mine', cityId: 'danyang', province: 'chungbuk', lat: 37.015, lon: 128.362, metricValue: 2100, metricUnit: '만톤/년', metricLabel: '석회석 채굴(추정)', subCategory: '석회석·시멘트 핵심 산지', sourceNote: '한국광해광업공단 광업 현황' },
  { id: 'mine_yeongwol_w', name: '영월 상동 텅스텐 광산', type: 'mine', cityId: 'yeongwol', province: 'gangwon', lat: 37.145, lon: 128.838, metricValue: 5800, metricUnit: '만톤 매장', metricLabel: '추정 매장량', subCategory: '세계급 핵심광물(텅스텐) 재개발', sourceNote: '한국광해광업공단 광업 현황' },
  { id: 'mine_taebaek_coal', name: '태백 장성·철암 탄전(폐광)', type: 'mine', cityId: 'taebaek', province: 'gangwon', lat: 37.105, lon: 129.012, metricValue: 9400, metricUnit: '만톤 누적', metricLabel: '역대 석탄 생산', subCategory: '대한민국 산업화 핵심 탄전 (2024 폐광)', sourceNote: '대한석탄공사 · 광해광업공단' },
  { id: 'mine_jeongseon_ls', name: '정선 신예미 철·석회석 광산', type: 'mine', cityId: 'jeongseon', province: 'gangwon', lat: 37.245, lon: 128.698, metricValue: 45, metricUnit: '만톤/년', metricLabel: '철광석 생산', subCategory: '국내 대표 가행 철광산', sourceNote: '한국광해광업공단 광업 현황' },
  { id: 'mine_samcheok_coal', name: '삼척 도계 무연탄 광업소', type: 'mine', cityId: 'samcheok', province: 'gangwon', lat: 37.232, lon: 129.048, metricValue: 28, metricUnit: '만톤/년', metricLabel: '무연탄 생산', subCategory: '국내 마지막 국영 탄광 지역', sourceNote: '대한석탄공사 · 광해광업공단' },
  { id: 'mine_bonghwa_zn', name: '봉화 연화 아연·연 광산지대', type: 'mine', cityId: 'bonghwa', province: 'gyeongbuk', lat: 37.048, lon: 129.025, metricValue: 120, metricUnit: '만톤 누적', metricLabel: '아연·납 광상', subCategory: '비철금속 광산 지대', sourceNote: '한국광해광업공단 광업 현황' },
  { id: 'mine_hwasun_coal', name: '화순 탄전 (호남 폐광지)', type: 'mine', cityId: 'hwasun', province: 'jeonnam', lat: 35.068, lon: 127.045, metricValue: 2600, metricUnit: '만톤 누적', metricLabel: '역대 석탄 생산', subCategory: '호남 최대 탄전 (2023 조기폐광)', sourceNote: '대한석탄공사 · 광해광업공단' },
  { id: 'mine_haenam_au', name: '해남 모이산·은산 금광', type: 'mine', cityId: 'haenam', province: 'jeonnam', lat: 34.482, lon: 126.585, metricValue: 18, metricUnit: '톤 매장', metricLabel: '금·은 광상', subCategory: '국내 대표 가행 금·은 광산', sourceNote: '한국광해광업공단 광업 현황' },
  { id: 'mine_chungju_talc', name: '충주·제천 비금속 광업지대', type: 'mine', cityId: 'chungju', province: 'chungbuk', lat: 36.992, lon: 128.021, metricValue: 320, metricUnit: '만톤/년', metricLabel: '규석·석회석', subCategory: '비금속 산업광물 산지', sourceNote: '한국광해광업공단 광업 현황' },
];

/**
 * 주요 안보 · 전략 방위 거점 (공개 행정·역사적 본부 권역 기준, 비보안 시·군 거점 좌표)
 */
const RAW_DEFENSE_HUBS: FacilityPoint[] = [
  { id: 'def_gyeryong', name: '계룡대 (육·해·공 3군본부 권역)', type: 'defense_hub', cityId: 'gyeryong', province: 'chungnam', lat: 36.286, lon: 127.246, metricValue: 3, metricUnit: '군 본부', metricLabel: '국방 지휘권역', subCategory: '3군 통합 국방행정 거점', sourceNote: '국방부 공개 국방백서 · 계룡시' },
  { id: 'def_pyeongtaek', name: '평택 한미연합 · 해군2함대 권역', type: 'defense_hub', cityId: 'pyeongtaek', province: 'gyeonggi', lat: 36.962, lon: 127.032, metricValue: 2, metricUnit: '핵심 사령부', metricLabel: '서해·연합 방위', subCategory: '캠프 험프리스 · 서해함대 권역', sourceNote: '국방부 공개백서 · 평택시' },
  { id: 'def_jinhae', name: '진해 해군기지 · 해군사관학교 권역', type: 'defense_hub', cityId: 'changwon', province: 'gyeongnam', lat: 35.146, lon: 128.655, metricValue: 1, metricUnit: '모항 권역', metricLabel: '해군 전략 모항', subCategory: '해군작전 · 교육 핵심 모항', sourceNote: '국방부 공개백서 · 창원시' },
  { id: 'def_busan_navy', name: '부산 해군작전사령부 권역', type: 'defense_hub', cityId: 'busan', province: 'busan', lat: 35.106, lon: 129.108, metricValue: 1, metricUnit: '작전사령부', metricLabel: '대한해협 방위', subCategory: '대한민국 해군 작전지휘', sourceNote: '국방부 공개백서' },
  { id: 'def_donghae_navy', name: '동해 해군1함대 권역', type: 'defense_hub', cityId: 'donghae', province: 'gangwon', lat: 37.508, lon: 129.118, metricValue: 1, metricUnit: '함대 권역', metricLabel: '동해 방위', subCategory: '동해안 해양안보 거점', sourceNote: '국방부 공개백서' },
  { id: 'def_jeju_navy', name: '제주 해군기동함대 권역', type: 'defense_hub', cityId: 'seogwipo', province: 'jeju', lat: 33.229, lon: 126.482, metricValue: 1, metricUnit: '기동함대', metricLabel: '남방 해상교통로', subCategory: '민군복합형 관광미항', sourceNote: '국방부 공개백서 · 제주도' },
  { id: 'def_pohang_marine', name: '포항 해병대 제1사단 권역', type: 'defense_hub', cityId: 'pohang', province: 'gyeongbuk', lat: 35.984, lon: 129.406, metricValue: 1, metricUnit: '상륙사단', metricLabel: '동남권 상륙전력', subCategory: '해병대 상륙·교육훈련 거점', sourceNote: '국방부 공개백서' },
  { id: 'def_daegu_air', name: '대구 공군군수사령부 · K-2 권역', type: 'defense_hub', cityId: 'daegu', province: 'daegu', lat: 35.892, lon: 128.656, metricValue: 1, metricUnit: '공군 거점', metricLabel: '영남 항공방위', subCategory: '공군 군수·전투비행 권역', sourceNote: '국방부 공개백서' },
  { id: 'def_sacheon_aero', name: '사천 항공우주 · 공군훈련비행 권역', type: 'defense_hub', cityId: 'sacheon', province: 'gyeongnam', lat: 35.091, lon: 128.075, metricValue: 1, metricUnit: '항공우주', metricLabel: 'KF-21 · 우주항공청', subCategory: '방산항공 · 공군교육 거점', sourceNote: '방위사업청 · 우주항공청' },
  { id: 'def_cheorwon_dmz', name: '철원 · 화천 중부전선 접경권역', type: 'defense_hub', cityId: 'cheorwon', province: 'gangwon', lat: 38.152, lon: 127.328, metricValue: 1, metricUnit: '전방 방위', metricLabel: 'DMZ 중부축', subCategory: '수도권 북방 전방방위 권역', sourceNote: '국방부 공개백서' },
];

/**
 * 주요 문화유산 · 국립박물관 · 역사 랜드마크 (국가유산청 · 국립중앙박물관 · 문체부 30대 거점)
 * 규칙: 연간 관람·탐방객 상위 5곳을 문화 불가사의(Cultural Wonder)로 자동 선정
 */
const RAW_CULTURAL_SITES: Omit<FacilityPoint, 'isWonder' | 'wonderKind' | 'wonderRank'>[] = [
  { id: 'cul_gyeongbok', name: '경복궁 · 창덕궁 (조선 5대 궁궐)', type: 'cultural_site', cityId: 'seoul', province: 'seoul', lat: 37.579, lon: 126.977, metricValue: 765, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '유네스코 세계유산 · 조선 왕궁', sourceNote: '국가유산청 궁능유적본부 (2024)' },
  { id: 'cul_bulguksa', name: '불국사 · 석굴암 (신라 불교성지)', type: 'cultural_site', cityId: 'gyeongju', province: 'gyeongbuk', lat: 35.790, lon: 129.332, metricValue: 492, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 세계유산 · 신라 문화유산', sourceNote: '국가유산청 · 경주시 통계' },
  { id: 'cul_hwaseong', name: '수원 화성 (정조 실학 성곽)', type: 'cultural_site', cityId: 'suwon', province: 'gyeonggi', lat: 37.287, lon: 127.015, metricValue: 428, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 세계유산 · 근세 성곽', sourceNote: '국가유산청 · 수원시 통계' },
  { id: 'cul_nmk', name: '국립중앙박물관 (용산)', type: 'cultural_site', cityId: 'seoul', province: 'seoul', lat: 37.524, lon: 126.980, metricValue: 418, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립박물관 · 세계 6위 관람 규모', sourceNote: '국립중앙박물관 관람통계 (2023–2024)' },
  { id: 'cul_jeonju_hanok', name: '전주 한옥마을 · 경기전', type: 'cultural_site', cityId: 'jeonju', province: 'jeonbuk', lat: 35.815, lon: 127.152, metricValue: 386, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '역사 랜드마크 · 조선왕조 발상지', sourceNote: '전주시 관광통계 · 국가유산청' },
  { id: 'cul_haeinsa', name: '해인사 장경판전 (팔만대장경)', type: 'cultural_site', cityId: 'hapcheon', province: 'gyeongnam', lat: 35.801, lon: 128.098, metricValue: 264, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 세계유산 · 법보종찰', sourceNote: '국가유산청 · 합천군 통계' },
  { id: 'cul_mmca_seoul', name: '국립현대미술관 · 덕수궁 · 종묘', type: 'cultural_site', cityId: 'seoul', province: 'seoul', lat: 37.578, lon: 126.985, metricValue: 254, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립미술관 · 유네스코 종묘 권역', sourceNote: '국립현대미술관 · 국가유산청' },
  { id: 'cul_gyeongju_museum', name: '국립경주박물관 · 대릉원 · 동궁과 월지', type: 'cultural_site', cityId: 'gyeongju', province: 'gyeongbuk', lat: 35.830, lon: 129.228, metricValue: 248, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립박물관 · 경주역사유적지구', sourceNote: '국립경주박물관 · 경주시' },
  { id: 'cul_jeju_volcanic', name: '성산일출봉 · 제주 화산섬 용암동굴', type: 'cultural_site', cityId: 'seogwipo', province: 'jeju', lat: 33.458, lon: 126.942, metricValue: 232, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 세계자연유산', sourceNote: '제주도 세계유산본부' },
  { id: 'cul_tongdosa', name: '영축총림 통도사 (불보종찰)', type: 'cultural_site', cityId: 'yangsan', province: 'gyeongnam', lat: 35.488, lon: 129.064, metricValue: 218, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 산사 · 한국 삼보사찰', sourceNote: '국가유산청 · 양산시' },
  { id: 'cul_acc_gwangju', name: '국립아시아문화전당 · 국립광주박물관', type: 'cultural_site', cityId: 'gwangju', province: 'gwangju', lat: 35.147, lon: 126.920, metricValue: 212, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립복합문화기관 · 국립박물관', sourceNote: '문화체육관광부 · 국립광주박물관' },
  { id: 'cul_busan_gamcheon', name: '부산박물관 · 감천문화마을 · 범어사', type: 'cultural_site', cityId: 'busan', province: 'busan', lat: 35.130, lon: 129.094, metricValue: 204, metricUnit: '만명/년', metricLabel: '연간 방문객', subCategory: '박물관 · 근대 역사문화 랜드마크', sourceNote: '부산광역시 문화관광통계' },
  { id: 'cul_hahoe', name: '안동 하회마을 · 도산서원', type: 'cultural_site', cityId: 'andong', province: 'gyeongbuk', lat: 36.539, lon: 128.518, metricValue: 196, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 세계유산 · 유교문화', sourceNote: '국가유산청 · 안동시' },
  { id: 'cul_myeongdong', name: '명동대성당 · 조계사 (도심 성지)', type: 'cultural_site', cityId: 'seoul', province: 'seoul', lat: 37.563, lon: 126.987, metricValue: 184, metricUnit: '만명/년', metricLabel: '연간 방문객', subCategory: '근현대 건축유산 · 도심 성지', sourceNote: '서울특별시 문화관광통계' },
  { id: 'cul_baekje', name: '백제역사유적지구 (공산성·국립공주박물관)', type: 'cultural_site', cityId: 'gongju', province: 'chungnam', lat: 36.463, lon: 127.126, metricValue: 172, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 세계유산 · 국립박물관', sourceNote: '국가유산청 · 국립공주박물관' },
  { id: 'cul_independence', name: '독립기념관 (천안)', type: 'cultural_site', cityId: 'cheonan', province: 'chungnam', lat: 36.783, lon: 127.223, metricValue: 168, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립역사기념관 · 근현대사 랜드마크', sourceNote: '독립기념관 · 국가보훈부' },
  { id: 'cul_songgwangsa', name: '송광사 · 선암사 (승보종찰)', type: 'cultural_site', cityId: 'suncheon', province: 'jeonnam', lat: 35.002, lon: 127.276, metricValue: 164, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 산사 · 삼보사찰', sourceNote: '국가유산청 · 순천시' },
  { id: 'cul_gangneung_ojuk', name: '강릉 오죽헌 · 선교장 · 경포대', type: 'cultural_site', cityId: 'gangneung', province: 'gangwon', lat: 37.779, lon: 128.879, metricValue: 158, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '역사 랜드마크 · 유네스코 단오제', sourceNote: '강릉시 · 국가유산청' },
  { id: 'cul_buyeo_museum', name: '부여 부소산성 · 국립부여박물관 · 정림사지', type: 'cultural_site', cityId: 'buyeo', province: 'chungnam', lat: 36.276, lon: 126.918, metricValue: 152, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '유네스코 백제유적 · 국립박물관', sourceNote: '국립부여박물관 · 국가유산청' },
  { id: 'cul_jinju_castle', name: '진주성 · 국립진주박물관 (임진왜란관)', type: 'cultural_site', cityId: 'jinju', province: 'gyeongnam', lat: 35.191, lon: 128.081, metricValue: 146, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '역사 성곽 · 국립박물관', sourceNote: '국립진주박물관 · 진주시' },
  { id: 'cul_daegu_museum', name: '국립대구박물관 · 대구 근대문화골목', type: 'cultural_site', cityId: 'daegu', province: 'daegu', lat: 35.846, lon: 128.638, metricValue: 142, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립박물관 · 근대역사 랜드마크', sourceNote: '국립대구박물관 · 대구광역시' },
  { id: 'cul_buseoksa', name: '영주 부석사 · 소수서원', type: 'cultural_site', cityId: 'yeongju', province: 'gyeongbuk', lat: 36.998, lon: 128.687, metricValue: 138, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 산사·서원 · 화엄종찰', sourceNote: '국가유산청' },
  { id: 'cul_gimhae_gaya', name: '국립김해박물관 · 대성동 가야고분군', type: 'cultural_site', cityId: 'gimhae', province: 'gyeongnam', lat: 35.243, lon: 128.873, metricValue: 134, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '유네스코 가야고분군 · 국립박물관', sourceNote: '국립김해박물관 · 국가유산청' },
  { id: 'cul_namwon_gwanghan', name: '남원 광한루원 · 남원읍성', type: 'cultural_site', cityId: 'namwon', province: 'jeonbuk', lat: 35.403, lon: 127.379, metricValue: 128, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '명승 역사정원 · 판소리 문화권', sourceNote: '남원시 · 국가유산청' },
  { id: 'cul_ganghwa_dolmen', name: '강화 고인돌 유적 · 전등사 · 마니산', type: 'cultural_site', cityId: 'incheon', province: 'incheon', lat: 37.771, lon: 126.436, metricValue: 124, metricUnit: '만명/년', metricLabel: '연간 탐방객', subCategory: '유네스코 고인돌 · 호국 문화유산', sourceNote: '국가유산청 · 인천광역시' },
  { id: 'cul_jeju_museum', name: '국립제주박물관 · 제주목 관아 · 해녀박물관', type: 'cultural_site', cityId: 'jeju_si', province: 'jeju', lat: 33.513, lon: 126.549, metricValue: 118, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립박물관 · 유네스코 해녀문화', sourceNote: '국립제주박물관 · 제주특별자치도' },
  { id: 'cul_iksan_mireuk', name: '익산 미륵사지 · 국립익산박물관', type: 'cultural_site', cityId: 'iksan', province: 'jeonbuk', lat: 36.012, lon: 127.031, metricValue: 112, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '유네스코 백제유적 · 국립박물관', sourceNote: '국립익산박물관 · 국가유산청' },
  { id: 'cul_cheongju_jikji', name: '청주고인쇄박물관 (직지) · 국립청주박물관', type: 'cultural_site', cityId: 'cheongju', province: 'chungbuk', lat: 36.644, lon: 127.473, metricValue: 108, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '유네스코 세계기록유산 · 국립박물관', sourceNote: '국립청주박물관 · 청주시' },
  { id: 'cul_chuncheon_museum', name: '국립춘천박물관 · 청평사 · 중도 선사유적', type: 'cultural_site', cityId: 'chuncheon', province: 'gangwon', lat: 37.864, lon: 127.752, metricValue: 96, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립박물관 · 강원 선사·고려유산', sourceNote: '국립춘천박물관 · 춘천시' },
  { id: 'cul_naju_museum', name: '국립나주박물관 · 영산강 고분군 · 나주읍성', type: 'cultural_site', cityId: 'naju', province: 'jeonnam', lat: 34.971, lon: 126.647, metricValue: 88, metricUnit: '만명/년', metricLabel: '연간 관람객', subCategory: '국립박물관 · 마한·영산강 역사권', sourceNote: '국립나주박물관 · 국가유산청' },
];


// 규칙 적용: 국립공원 탐방객 Top 5 → Natural Wonder, 대학 연구비 Top 5 → Academic Wonder, 문화유산 Top 5 → Cultural/Faith Wonder
const sortedParks = [...RAW_NATIONAL_PARKS].sort((a, b) => b.metricValue - a.metricValue);
const naturalWonderIds = new Map<string, number>();
sortedParks.slice(0, CIV_RULES.wonders.naturalTopN).forEach((p, idx) => {
  naturalWonderIds.set(p.id, idx + 1);
});

const sortedUnivs = [...RAW_UNIVERSITIES].sort((a, b) => b.metricValue - a.metricValue);
const academicWonderIds = new Map<string, number>();
sortedUnivs.slice(0, CIV_RULES.wonders.academicTopN).forEach((u, idx) => {
  academicWonderIds.set(u.id, idx + 1);
});

const sortedCultural = [...RAW_CULTURAL_SITES].sort((a, b) => b.metricValue - a.metricValue);
const culturalWonderIds = new Map<string, number>();
sortedCultural.slice(0, CIV_RULES.wonders.culturalTopN).forEach((c, idx) => {
  culturalWonderIds.set(c.id, idx + 1);
});

export const KOREA_FACILITIES: FacilityPoint[] = [
  ...RAW_NATIONAL_PARKS.map((p) => {
    const rank = naturalWonderIds.get(p.id);
    return {
      ...p,
      isWonder: rank !== undefined,
      wonderKind: rank !== undefined ? ('natural' as const) : undefined,
      wonderRank: rank,
    };
  }),
  ...RAW_UNIVERSITIES.map((u) => {
    const rank = academicWonderIds.get(u.id);
    return {
      ...u,
      isWonder: rank !== undefined,
      wonderKind: rank !== undefined ? ('academic' as const) : undefined,
      wonderRank: rank,
    };
  }),
  ...RAW_CULTURAL_SITES.map((c) => {
    const rank = culturalWonderIds.get(c.id);
    return {
      ...c,
      isWonder: rank !== undefined,
      wonderKind: rank !== undefined ? ('cultural' as const) : undefined,
      wonderRank: rank,
    };
  }),
  ...RAW_POWER_PLANTS,
  ...RAW_PORTS,
  ...RAW_AIRPORTS,
  ...RAW_MINES,
  ...RAW_DEFENSE_HUBS,
];

/**
 * 출처 패널 ("?")용 데이터 원천 목록 + 공식 포털 링크
 */
export const DATA_SOURCES: DataSourceInfo[] = [
  {
    id: 'sgis_boundaries',
    item: '행정구역 경계 · 센서스 통계',
    agency: '국가데이터처 SGIS OpenAPI',
    unit: '17개 시도 · 252개 시군구 (2010–2024)',
    refYear: '2010–2024',
    status: 'active',
    note: '실시간 SGIS 공식 행정경계 GeoJSON 및 2010·2015·2020·2024 역사 센서스 연동',
    url: 'https://sgis.kostat.go.kr',
  },
  {
    id: 'kosis_pop',
    item: '주민등록인구 · 고령화율',
    agency: '국가데이터처 KOSIS · 행정안전부',
    unit: '시·군·구 (161개 도시 통합)',
    refYear: '2010–2025',
    status: 'active',
    note: '실시간 KOSIS API로 최신 인구·고령화율 및 2010년 역사 인구 동기화',
    url: 'https://kosis.kr',
  },
  {
    id: 'grdp',
    item: '지역내총생산 (GRDP)',
    agency: '국가데이터처 KOSIS',
    unit: '시·군·구 (Gold 산출량)',
    refYear: '2022–2024',
    status: 'active',
    note: '격자 인구 비중 가중 배분 및 시군구 합계 보존(오차 0.00%)',
    url: 'https://kosis.kr',
  },
  {
    id: 'business',
    item: '전국사업체조사 (종사자·산업)',
    agency: '국가데이터처 KOSIS',
    unit: '시·군·구 × 7대 산업 대분류',
    refYear: '2023',
    status: 'active',
    note: '입지계수(LQ ≥ 1.5) 및 종사자 5,000명+ 규칙으로 특화 지구(District) 자동 부여',
    url: 'https://kosis.kr',
  },
  {
    id: 'income_tasis',
    item: '시군구별 근로소득 (Income)',
    agency: '국세청 국세통계포털 (TASIS)',
    unit: '연말정산 1인당 평균 급여 (만원)',
    refYear: '2023–2024',
    status: 'active',
    note: '소득 렌즈 및 경제 자문관·Explorer 161개 시·군 비교 지표',
    url: 'https://tasis.nts.go.kr',
  },
  {
    id: 'education_census',
    item: '교육정도 · 대졸 이상 비중 (Degrees)',
    agency: '국가데이터처 인구주택총조사',
    unit: '25세 이상 전문대졸·대졸+ 비중 (%)',
    refYear: '2020–2024',
    status: 'active',
    note: '학위 렌즈 및 과학·교육 자문관 지표 반영',
    url: 'https://kosis.kr',
  },
  {
    id: 'faith_heritage',
    item: '종교인구 · 문화유산 (Faith & Wonders)',
    agency: '국가데이터처 · 국가유산청',
    unit: '종교인구 비중(%) · 유네스코/궁능 관람객',
    refYear: '2024',
    status: 'active',
    note: '신앙 렌즈 및 관람객 상위 5곳 문화·신앙 불가사의(Cultural Wonders) 자동 선정',
    url: 'https://www.khs.go.kr',
  },
  {
    id: 'health_life',
    item: '시군구 기대수명 · 건강지표 (Health)',
    agency: '국가데이터처 생명표 · 질병관리청',
    unit: '출생 시 기대수명 (세)',
    refYear: '2023–2024',
    status: 'active',
    note: '보건 렌즈(USACiv CDC 대응) 및 인구·보건 자문관 연동',
    url: 'https://chs.kdca.go.kr',
  },
  {
    id: 'housing_rone',
    item: '주택가격 · 부동산 통계 (Housing)',
    agency: '한국부동산원 R-ONE · 국토교통부',
    unit: '아파트 3.3m²당 평균 실거래가 (만원)',
    refYear: '2024',
    status: 'active',
    note: '주거 렌즈 및 Explorer 소득-주택가격 상관분석 지원',
    url: 'https://www.reb.or.kr/r-one',
  },
  {
    id: 'freight_ktdb',
    item: '시·군 화물 물동량 (Freight)',
    agency: '국토교통부 국가교통DB (KTDB) 미반영',
    unit: '백만톤/년 (추정)',
    refYear: '2023–2024',
    status: 'estimated',
    note: '추정: KTDB 지역 간 화물 OD는 신청 절차·존 단위를 확인하지 못해 쓰지 않았고, 권역 간 흐름선도 지도에서 뺐습니다(PLAN.md 9절 대안). 시·군 물동량은 종사자·항만 여부로 계산한 추정치이며, 물류 렌즈는 항만 물동량과 공항(여객 수 기준)을 함께 보여줍니다.',
    url: 'https://www.ktdb.go.kr',
  },
  {
    id: 'dem',
    item: '지형 (DEM · 표고·기복)',
    agency: 'Copernicus DEM GLO-90 (유럽우주국·Airbus)',
    unit: '90m DEM을 5km 육각 칸별 평균 표고·기복(최고−최저)으로 집계',
    refYear: '2021',
    status: 'active',
    note: '칸 안 기복 300m 이상 Hills, 600m 이상 Mountain. 국토지리정보원 DEM 대신 PLAN.md의 대안 자료를 사용. 건물·수목 높이가 포함된 표면 모델(DSM)입니다.',
    url: 'https://registry.opendata.aws/copernicus-dem/',
  },
  {
    id: 'landcover',
    item: '토지피복 대분류',
    agency: 'ESA WorldCover 2021 v200 (CC BY 4.0)',
    unit: '10m 피복도를 약 80m로 줄여 칸별 최다 유형 집계',
    refYear: '2021',
    status: 'active',
    note: '칸 안 육지 피복 중 면적이 가장 큰 유형을 Civilization 기본 지형으로 변환(WorldCover는 바다도 수역으로 세므로 수역은 비교에서 제외). 환경공간정보서비스 대분류 대신 PLAN.md의 대안 자료를 사용했습니다.',
    url: 'https://esa-worldcover.org/',
  },
  {
    id: 'population_grid',
    item: '격자 인구 분포 (칸별 인구 비중)',
    agency: 'WorldPop 2020 Constrained, UN 보정 (CC BY 4.0)',
    unit: '100m 격자 인구를 5km 육각 칸별 합계로 집계',
    refYear: '2020',
    status: 'active',
    note: '시·군 인구 합계는 KOSIS 값을 쓰고, 같은 시·군 안의 칸에는 이 격자 인구 비율대로 나눕니다. SGIS 격자 인구는 별도 자료신청이 필요해 대신 사용했습니다.',
    url: 'https://hub.worldpop.org/geodata/summary?id=49761',
  },
  {
    id: 'power',
    item: '발전기 · 발전소 현황 (Power Grid)',
    agency: '한국전력거래소 EPSIS',
    unit: '500MW 이상 대형 발전소 (26개 거점)',
    refYear: '2024',
    status: 'active',
    note: '원자력·석탄·LNG복합·양수·해상풍력 설비용량(MW) 지도 표시',
    url: 'https://epsis.kpx.or.kr',
  },
  {
    id: 'mines',
    item: '광산 · 탄전 현황 (Mines)',
    agency: '산업통상자원부 · 한국광해광업공단',
    unit: '주요 가행광산·핵심광물·역사적 탄전',
    refYear: '2024',
    status: 'estimated',
    note: '석회석·텅스텐·철광·금광 및 폐광 탄전(읍면 중심좌표 반영)',
    url: 'https://www.komir.or.kr',
  },
  {
    id: 'ports',
    item: '수출입 항만 물동량 (Ports)',
    agency: '해양수산부 PORT-MIS',
    unit: '12대 무역항 컨테이너(TEU)·총물동량',
    refYear: '2024',
    status: 'active',
    note: '무역항 소재 및 운수·창고업 특화 도시에는 Harbor 지구 부여',
    url: 'https://new.portmis.go.kr',
  },
  {
    id: 'airports',
    item: '전국 공항 수송실적 (Airports)',
    agency: '인천국제공항공사 · 한국공항공사',
    unit: '전국 15개 상업공항 연간 여객 (화물 실적은 미수록)',
    refYear: '2024',
    status: 'active',
    note: '인천국제공항(ICN) 및 전국 14개 지방공항 연간 여객 수. 항공화물 수치는 넣지 않음',
    url: 'https://www.airport.co.kr',
  },
  {
    id: 'parks',
    item: '국립공원 탐방객 현황 (Natural Wonders)',
    agency: '국립공원공단 · 제주도 세계유산본부',
    unit: '전국 23개 국립공원',
    refYear: '2025',
    status: 'active',
    note: '연간 탐방객 상위 5곳을 자연 불가사의(Natural Wonders)로 자동 등재',
    url: 'https://www.knps.or.kr',
  },
  {
    id: 'universities',
    item: '대학 연구비 현황 (Academic Wonders)',
    agency: '교육부 · 대학알리미',
    unit: '주요 24개 연구중심대학 연간 연구비',
    refYear: '2024',
    status: 'active',
    note: '연간 연구비 총액 상위 5곳을 학문 불가사의(Academic Wonders)로 자동 등재',
    url: 'https://www.academyinfo.go.kr',
  },
  {
    id: 'disasters',
    item: '자연재해 피해액 (Disasters)',
    agency: '행정안전부 재해연보 · 기상청',
    unit: '최근 10년 태풍·호우·산불 누적 피해',
    refYear: '2015–2024',
    status: 'estimated',
    note: '시도 재해연보 및 대형 재난 기록을 바탕으로 161개 시·군 배분',
    url: 'https://www.mois.go.kr',
  },
  {
    id: 'vworld_defense',
    item: '지오코딩(VWorld) · 국방 공개권역',
    agency: '국토교통부 VWorld · OpenStreetMap Nominatim · 국방부 공개백서',
    unit: '실시간 장소검색·역지오코딩 · 시설 좌표 검증 · 공개 방위권역 10곳',
    refYear: '2024–2026',
    status: 'active',
    note: 'VWorld 실시간 장소/주소 조회(서버 실행 시). 시설 좌표는 Nominatim으로 따로 검증(data/geocode_report.json). 방위권역은 도시 단위로만 표시',
    url: 'https://www.vworld.kr',
  },
];

export const EXCLUDED_ITEMS = [
  {
    item: '비공개 군사시설 정밀 좌표',
    reason: '대한민국 공간정보 보안 규정에 따라 세부 군사시설 좌표는 제외하고, 국방백서·지자체에 공개된 10대 전략 방위권역만 도시 단위로 표시했습니다.',
  },
  {
    item: '북한 지역 (North Korea)',
    reason: '남한 행정구역(17개 시도·161개 시·군) 및 국가데이터처 공식 통계 범위를 기준으로 휴전선 이남만 수록했습니다.',
  },
  {
    item: '턴제 전투 · AI 외교 게임 루프',
    reason: '실제 공공통계 기반의 전략 지도 탐색과 데이터 분석(20개 렌즈 · 9명의 자문관 · Explorer · 분할 비교)에 집중했습니다.',
  },
];
