/**
 * 시설 목록을 JSON으로 출력 (pipeline/geocode_check.py 입력용)
 * 실행: npx tsx scripts/dump-facilities.ts > data/raw/facilities.json
 */
import { KOREA_FACILITIES } from '../src/data/koreaFacilities';

const rows = KOREA_FACILITIES.map(({ id, name, type, cityId, lat, lon }) => ({
  id,
  name,
  type,
  cityId,
  lat,
  lon,
}));
process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
