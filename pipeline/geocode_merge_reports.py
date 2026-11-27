"""
Nominatim 검증(geocode_check.py)과 VWorld 검증(geocode_check_vworld.py)을 합쳐
"둘 중 하나라도 확인되면 성공"으로 재판정.

이유: 두 지오코더가 서로 다른 데이터셋이라 잘 찾는 시설 종류가 다름
(예: VWorld는 항만·광산을, Nominatim은 국립공원·발전소를 상대적으로 더 잘 찾음).
둘 다 실패한 항목만 "진짜 실패"로 남겨 PLAN.md 95% 기준에 더 가깝게 잰다.

입력: data/geocode_failed.csv (Nominatim 실패 목록), data/geocode_failed_vworld.csv
결과: data/geocode_report_combined.json, data/geocode_failed_combined.csv

실행 (둘 다 먼저 돌려둔 뒤):
  python3 pipeline/geocode_merge_reports.py
"""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACILITIES = os.path.join(ROOT, "data", "raw", "facilities.json")
NOMINATIM_FAILED = os.path.join(ROOT, "data", "geocode_failed.csv")
VWORLD_FAILED = os.path.join(ROOT, "data", "geocode_failed_vworld.csv")
OUT_REPORT = os.path.join(ROOT, "data", "geocode_report_combined.json")
OUT_FAILED = os.path.join(ROOT, "data", "geocode_failed_combined.csv")
SKIP_TYPES = {"defense_hub"}


def read_failed(path: str) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        return {row["id"]: row for row in csv.DictReader(f)}


def main() -> int:
    with open(FACILITIES, encoding="utf-8") as f:
        facilities = [f2 for f2 in json.load(f) if f2["type"] not in SKIP_TYPES]

    nom_failed = read_failed(NOMINATIM_FAILED)
    vw_failed = read_failed(VWORLD_FAILED)
    both_failed_ids = set(nom_failed) & set(vw_failed)

    by_type: dict[str, dict[str, int]] = {}
    still_failed_rows = []
    for fac in facilities:
        t = by_type.setdefault(fac["type"], {"checked": 0, "ok": 0})
        t["checked"] += 1
        if fac["id"] not in both_failed_ids:
            t["ok"] += 1
        else:
            row = nom_failed.get(fac["id"]) or vw_failed.get(fac["id"])
            still_failed_rows.append(
                {
                    "id": fac["id"],
                    "name": fac["name"],
                    "type": fac["type"],
                    "lat": fac["lat"],
                    "lon": fac["lon"],
                    "nominatim_status": nom_failed.get(fac["id"], {}).get("status", "성공"),
                    "vworld_status": vw_failed.get(fac["id"], {}).get("status", "성공"),
                    "nominatim_best_match": nom_failed.get(fac["id"], {}).get("nominatim_best_match", ""),
                    "vworld_best_match": vw_failed.get(fac["id"], {}).get("vworld_best_match", ""),
                }
            )

    ok = len(facilities) - len(both_failed_ids)
    report = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "geocoder": "OpenStreetMap Nominatim ∪ VWorld (둘 중 하나라도 5km 안이면 성공)",
        "checked": len(facilities),
        "succeeded": ok,
        "successRate": round(ok / len(facilities), 4) if facilities else 0,
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
    print(f"둘 다 실패(진짜 미확인): {len(still_failed_rows)}곳")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
