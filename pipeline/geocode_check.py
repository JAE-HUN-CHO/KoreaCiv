"""
시설 좌표 지오코딩 검증 (PLAN.md 7절 M4 "지오코딩 성공률 95% 이상, 실패 목록 파일 존재")

앱의 시설 좌표(src/data/koreaFacilities.ts)는 직접 입력한 값입니다. 이 스크립트는 시설 이름을
OpenStreetMap Nominatim으로 따로 지오코딩해, 입력 좌표와 맞는지 확인합니다.
(PLAN.md의 VWorld·Kakao는 이 작업 환경에서 접속이 막혀 Nominatim을 씀)

판정
- 성공: 검색 결과 중 하나가 입력 좌표에서 5km(칸 하나 폭) 안에 있거나, 결과의 경계 상자가
  입력 좌표를 포함 (국립공원처럼 넓은 대상)
- 검색 결과 없음: "미검색"
- 결과는 있지만 모두 5km 밖: "불일치"
- 방위 권역은 일부러 도시 단위 좌표만 쓰므로 검증 대상에서 뺌

입력: 시설 목록 JSON (npx tsx scripts/dump-facilities.ts 가 표준 출력으로 냄)
결과: data/geocode_report.json, data/geocode_failed.csv

실행:
  npx tsx scripts/dump-facilities.ts > data/raw/facilities.json
  python3 pipeline/geocode_check.py data/raw/facilities.json
Nominatim 이용 규칙에 맞춰 요청 간격을 2초로 둠 (결과는 data/raw/에 캐시하므로 다시 돌리면 이어서 함)
"""

from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "raw", "nominatim_cache.json")
REPORT = os.path.join(ROOT, "data", "geocode_report.json")
FAILED_CSV = os.path.join(ROOT, "data", "geocode_failed.csv")
URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "koreaciv-geocode-check/1.0"
MATCH_KM = 5.0
REQUEST_INTERVAL_S = 2.0
SKIP_TYPES = {"defense_hub"}


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def query_variants(name: str) -> list[str]:
    """'부산항 (신항·북항)' → ['부산항 (신항·북항)', '부산항'], '광양항·여수항' → [..., '광양항']"""
    out = [name]
    base = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    if base and base not in out:
        out.append(base)
    first = re.split(r"[·/]", base)[0].strip()
    if first and first not in out:
        out.append(first)
    return out


def nominatim(q: str, cache: dict, last_call: list[float]) -> list[dict]:
    if q in cache:
        return cache[q]
    wait = REQUEST_INTERVAL_S - (time.monotonic() - last_call[0])
    if wait > 0:
        time.sleep(wait)
    params = urllib.parse.urlencode(
        {"q": q, "countrycodes": "kr", "format": "jsonv2", "limit": 5}
    )
    req = urllib.request.Request(f"{URL}?{params}", headers={"User-Agent": USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            break
        except Exception as e:
            if attempt == 4:
                raise
            # 429/629는 요청 한도 초과. 길게 쉬었다가 다시 시도
            code = getattr(e, "code", None)
            time.sleep(60 * (attempt + 1) if code in (429, 629) else 3 * (attempt + 1))
    last_call[0] = time.monotonic()
    hits = [
        {
            "lat": float(d["lat"]),
            "lon": float(d["lon"]),
            "bbox": [float(v) for v in d.get("boundingbox", [])],
            "name": d.get("display_name", ""),
        }
        for d in data
    ]
    cache[q] = hits
    # 중간에 끊겨도 이어서 돌릴 수 있게 매번 저장
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    return hits


def judge(fac: dict, hits: list[dict]) -> tuple[str, float | None, str]:
    if not hits:
        return "미검색", None, ""
    best = min(hits, key=lambda h: haversine_km(fac["lat"], fac["lon"], h["lat"], h["lon"]))
    dist = haversine_km(fac["lat"], fac["lon"], best["lat"], best["lon"])
    if dist <= MATCH_KM:
        return "성공", dist, best["name"]
    for h in hits:
        b = h["bbox"]
        if len(b) == 4 and b[0] <= fac["lat"] <= b[1] and b[2] <= fac["lon"] <= b[3]:
            return "성공", haversine_km(fac["lat"], fac["lon"], h["lat"], h["lon"]), h["name"]
    return "불일치", dist, best["name"]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    with open(sys.argv[1], encoding="utf-8") as f:
        facilities = json.load(f)
    cache = {}
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            cache = json.load(f)

    last_call = [0.0]
    rows = []
    try:
        for fac in facilities:
            if fac["type"] in SKIP_TYPES:
                continue
            status, dist, matched = "미검색", None, ""
            for q in query_variants(fac["name"]):
                hits = nominatim(q, cache, last_call)
                status, dist, matched = judge(fac, hits)
                if status == "성공":
                    break
            rows.append(
                {
                    "id": fac["id"],
                    "name": fac["name"],
                    "type": fac["type"],
                    "lat": fac["lat"],
                    "lon": fac["lon"],
                    "status": status,
                    "distanceKm": None if dist is None else round(dist, 1),
                    "matched": matched,
                }
            )
            print(f"  {status} {fac['name']}" + ("" if dist is None else f" ({dist:.1f}km)"))
    finally:
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False)

    ok = sum(1 for r in rows if r["status"] == "성공")
    by_type: dict[str, dict[str, int]] = {}
    for r in rows:
        t = by_type.setdefault(r["type"], {"checked": 0, "ok": 0})
        t["checked"] += 1
        t["ok"] += r["status"] == "성공"
    report = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "geocoder": "OpenStreetMap Nominatim",
        "matchRadiusKm": MATCH_KM,
        "checked": len(rows),
        "succeeded": ok,
        "successRate": round(ok / len(rows), 4) if rows else 0,
        "skipped": {"defense_hub": "도시 단위 좌표만 쓰므로 제외"},
        "byType": by_type,
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(FAILED_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "type", "lat", "lon", "status", "distance_km", "nominatim_best_match"])
        for r in rows:
            if r["status"] != "성공":
                w.writerow([r["id"], r["name"], r["type"], r["lat"], r["lon"], r["status"],
                            "" if r["distanceKm"] is None else r["distanceKm"], r["matched"]])
    print(f"성공 {ok}/{len(rows)} ({report['successRate'] * 100:.1f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
