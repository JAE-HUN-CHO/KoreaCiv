/**
 * 정적 배포 스냅샷 설정. 수집 스크립트(scripts/snapshot-api.ts)와 앱이 함께 씀.
 * 이 파일은 import.meta.env를 쓰지 않아야 함 (tsx로 실행되는 스크립트에서도 import하므로)
 */

/** KOSIS 시계열 스냅샷의 수집 연도 범위 */
export const KOSIS_SNAPSHOT_START_YEAR = '2018';
export const KOSIS_SNAPSHOT_END_YEAR = '2026';
