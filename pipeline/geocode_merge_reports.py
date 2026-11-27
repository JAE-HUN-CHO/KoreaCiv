"""
Nominatim 검증(geocode_check.py)과 VWorld 검증(geocode_check_vworld.py)을 합쳐
"둘 중 하나라도 확인되면 성공"으로 재판정하고, 대형 시설 보정을 한 번 더 거친다.

1단계 — 합산: 두 지오코더가 서로 다른 데이터셋이라 잘 찾는 시설 종류가 다름
(예: VWorld는 항만·광산을, Nominatim은 국립공원·발전소를 상대적으로 더 잘 찾음).

2단계 — 대형 시설 보정: 국립공원·발전소·박물관처럼 부지가 넓은 시설은 "입구/대표
좌표"와 "검색 결과 좌표"가 5km를 넘게 벌어질 수 있다(예: 다도해해상국립공원은
여러 섬에 걸쳐 있어 21.8km 차이가 나도 같은 곳). 검색 결과 이름에 정식 명칭
전체와 공식 유형어(국립공원/발전소/박물관)가 함께 들어 있으면, 거리 기준을
WIDE_RADIUS_KM까지 넓혀 확인된 것으로 본다. 반대로 "OO동/OO치킨/OO은행"처럼
흔한 지명·상호만 겹치는 경우는(예: mine_donghae_ls → "IBK기업은행 동해") 유형어가
없으므로 보정 대상에서 자동으로 빠진다.

입력: data/geocode_failed.csv (Nominatim 실패 목록), data/geocode_failed_vworld.csv
결과: data/geocode_report_combined.json, data/geocode_failed_combined.csv

실행 (둘 다 먼저 돌려둔 뒤):
  python3 pipeline/geocode_merge_reports.py
"""

from __future__ import annotations

import csv
import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACILITIES = os.path.join(ROOT, "data", "raw", "facilities.json")
NOMINATIM_FAILED = os.path.join(ROOT, "data", "geocode_failed.csv")
VWORLD_FAILED = os.path.join(ROOT, "data", "geocode_failed_vworld.csv")
OUT_REPORT = os.path.join(ROOT, "data", "geocode_report_combined.json")
OUT_FAILED = os.path.join(ROOT, "data", "geocode_failed_combined.csv")
SKIP_TYPES = {"defense_hub"}

# 넓은 부지를 가진 시설 종류에 쓰는 보정 반경(km)과, 매칭 이름에 반드시 있어야 하는
# 공식 유형어. 둘 다 있어야 보정 성공으로 치므로 동명의 아파트·상점·은행은 안 걸림.
WIDE_RADIUS_KM = 30.0
DESIGNATION_KEYWORDS = ("국립공원", "발전소", "박물관")


def read_failed(path: str) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        return {row["id"]: row for row in csv.DictReader(f)}


def facility_keyword(name: str) -> str:
    """'다도해해상국립공원' 같은 핵심 이름 추출(괄호 설명 제거, ·/ 앞부분만)
    — geocode_check.py의 query_variants와 같은 규칙"""
    base = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    return re.split(r"[·/]", base)[0].strip()


def wide_radius_match(row: dict | None, match_col: str, fac_name: str) -> tuple[bool, str]:
    """distance_km 기준 WIDE_RADIUS_KM 안이고, 매칭 이름에 "그 시설 자체의 이름"과
    공식 유형어가 함께 있을 때만 보정 성공. 유형어만 있고 다른 시설(예: 근처의
    아무 박물관)을 집은 경우는 이름이 안 맞아 걸러짐 — 이름만 맞고 유형어가
    없는 동명 상호·지명도 걸러짐(둘 다 있어야 함)"""
    if not row:
        return False, ""
    match = row.get(match_col, "")
    if not match:
        return False, ""
    if not any(kw in match for kw in DESIGNATION_KEYWORDS):
        return False, ""
    kw = facility_keyword(fac_name)
    if not kw or kw not in match:
        return False, ""
    try:
        dist = float(row.get("distance_km", ""))
    except ValueError:
        return False, ""
    if dist <= WIDE_RADIUS_KM:
        return True, match
    return False, ""


def main() -> int:
    with open(FACILITIES, encoding="utf-8") as f:
        facilities = [f2 for f2 in json.load(f) if f2["type"] not in SKIP_TYPES]

    nom_failed = read_failed(NOMINATIM_FAILED)
    vw_failed = read_failed(VWORLD_FAILED)
    both_failed_ids = set(nom_failed) & set(vw_failed)

    by_type: dict[str, dict[str, int]] = {}
    still_failed_rows = []
    wide_rescued_rows = []
    for fac in facilities:
        t = by_type.setdefault(fac["type"], {"checked": 0, "ok": 0})
        t["checked"] += 1
        if fac["id"] not in both_failed_ids:
            t["ok"] += 1
            continue

        nom_row = nom_failed.get(fac["id"])
        vw_row = vw_failed.get(fac["id"])
        nom_ok, nom_match = wide_radius_match(nom_row, "nominatim_best_match", fac["name"])
        vw_ok, vw_match = wide_radius_match(vw_row, "vworld_best_match", fac["name"])
        if nom_ok or vw_ok:
            t["ok"] += 1
            both_failed_ids.discard(fac["id"])
            wide_rescued_rows.append(
                {
                    "id": fac["id"],
                    "name": fac["name"],
                    "type": fac["type"],
                    "matchedVia": "nominatim" if nom_ok else "vworld",
                    "matchedName": nom_match if nom_ok else vw_match,
                    "distanceKm": (nom_row or {}).get("distance_km") if nom_ok else (vw_row or {}).get("distance_km"),
                }
            )
            continue

        still_failed_rows.append(
            {
                "id": fac["id"],
                "name": fac["name"],
                "type": fac["type"],
                "lat": fac["lat"],
                "lon": fac["lon"],
                "nominatim_status": (nom_row or {}).get("status", "성공"),
                "vworld_status": (vw_row or {}).get("status", "성공"),
                "nominatim_best_match": (nom_row or {}).get("nominatim_best_match", ""),
                "vworld_best_match": (vw_row or {}).get("vworld_best_match", ""),
            }
        )

    ok = len(facilities) - len(both_failed_ids)
    report = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "geocoder": "OpenStreetMap Nominatim ∪ VWorld (둘 중 하나라도 5km 안이면 성공, "
        f"대형 시설은 정식 명칭+유형어 일치 시 {WIDE_RADIUS_KM:.0f}km까지 보정)",
        "checked": len(facilities),
        "succeeded": ok,
        "successRate": round(ok / len(facilities), 4) if facilities else 0,
        "wideRadiusRescued": wide_rescued_rows,
        "skipped": {"defense_hub": "도시 단위 좌표만 쓰므로 제외"},
        "byType": by_type,
    }
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(OUT_FAILED, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "type", "lat", "lon", "nominatim_status", "vworld_status",
                    "nominatim_best_match", "vworld_best_match"])
        for r in still_failed_rows:
            w.writerow([r["id"], r["name"], r["type"], r["lat"], r["lon"],
                        r["nominatim_status"], r["vworld_status"],
                        r["nominatim_best_match"], r["vworld_best_match"]])
    print(f"합산 성공 {ok}/{len(facilities)} ({report['successRate'] * 100:.1f}%)")
    print(f"  - 대형 시설 보정으로 추가 확인: {len(wide_rescued_rows)}곳")
    print(f"둘 다 실패(진짜 미확인): {len(still_failed_rows)}곳")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
