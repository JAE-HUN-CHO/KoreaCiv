"""
시설 좌표 지오코딩 검증 — VWorld 버전 (pipeline/geocode_check.py의 Nominatim 결과를 보완)

REPORT.md는 PLAN.md 7절 M4 기준(95% 이상)을 Nominatim으로는 제대로 재지 못한다고
적어뒀다 — Nominatim은 한국어 지명(특히 발전소·광산)을 잘 못 찾고, 이름이 같은
다른 장소(아파트·학교 등)를 집어서 "실패"가 섞인다. 국내 지오코더(VWorld·Kakao)로
다시 돌려야 한다고 남겨둔 작업이 이것.

이 작업 환경은 VWorld 접속이 막혀 있던 이전 세션과 달리 VWorld API에 접속할 수 있어
이 스크립트로 다시 검증한다. (SGIS의 addr/geocode.json은 "주소"를 입력으로 받는
지오코더라 시설 이름 검색에는 맞지 않아 VWorld의 장소검색을 씀)

판정: Nominatim 버전과 같음 — 결과 중 하나가 입력 좌표에서 5km 안이면 성공.
VWorld 장소검색은 bbox를 안 줘서 Nominatim 버전의 bbox 포함 판정은 없음.

입력: 시설 목록 JSON (npx tsx scripts/dump-facilities.ts 표준 출력)
결과: data/geocode_report_vworld.json, data/geocode_failed_vworld.csv

실행:
  npx tsx scripts/dump-facilities.ts > data/raw/facilities.json
  VWORLD_API_KEY=... python3 pipeline/geocode_check_vworld.py data/raw/facilities.json
  (.env에 VWORLD_API_KEY가 있으면 환경변수 없이도 읽음)
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
CACHE = os.path.join(ROOT, "data", "raw", "vworld_cache.json")
REPORT = os.path.join(ROOT, "data", "geocode_report_vworld.json")
FAILED_CSV = os.path.join(ROOT, "data", "geocode_failed_vworld.csv")
URL = "https://api.vworld.kr/req/search"
MATCH_KM = 5.0
REQUEST_INTERVAL_S = 0.2
SKIP_TYPES = {"defense_hub"}


def load_vworld_key() -> str:
    key = os.environ.get("VWORLD_API_KEY", "").strip()
    if key:
        return key
    env_path = os.path.join(ROOT, ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("VWORLD_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"')
    return ""


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def query_variants(name: str) -> list[str]:
    out = [name]
    base = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    if base and base not in out:
        out.append(base)
    first = re.split(r"[·/]", base)[0].strip()
    if first and first not in out:
        out.append(first)
    return out


class VWorldRequestError(Exception):
    """재시도를 다 썼는데도 VWorld 요청이 실패함 (네트워크 오류·타임아웃 등).
    이 경우는 "검색 결과 없음"이 아니므로 캐시에 저장하면 안 됨 — 연결이
    복구된 뒤에도 영구히 미검색으로 잘못 남기 때문."""


def vworld_search(q: str, key: str, cache: dict, last_call: list[float]) -> list[dict]:
    if q in cache:
        return cache[q]
    wait = REQUEST_INTERVAL_S - (time.monotonic() - last_call[0])
    if wait > 0:
        time.sleep(wait)
    hits: list[dict] = []
    # place(장소)와 address(주소) 둘 다 시도 — 발전소·광산처럼 POI로 안 잡히는 시설은
    # 주소 검색에서 지번 지명으로 잡힐 때가 있음
    for search_type in ("place", "address"):
        params = urllib.parse.urlencode(
            {
                "service": "search",
                "request": "search",
                "version": "2.0",
                "crs": "EPSG:4326",
                "size": "5",
                "page": "1",
                "query": q,
                "type": search_type,
                "format": "json",
                "errorformat": "json",
                "key": key,
            }
        )
        req = urllib.request.Request(f"{URL}?{params}")
        data = None
        last_err: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.load(resp)
                break
            except Exception as e:
                last_err = e
                if attempt < 2:
                    time.sleep(2 * (attempt + 1))
        if data is None:
            # 재시도를 다 썼는데도 실패 — 캐시에 남기지 않고 바로 에러로 알림
            raise VWorldRequestError(f"{search_type} 검색 실패: {last_err}") from last_err
        result = data.get("response", {}).get("result") or {}
        for item in result.get("items", []):
            try:
                hits.append(
                    {
                        "lat": float(item["point"]["y"]),
                        "lon": float(item["point"]["x"]),
                        "name": item.get("title", ""),
                        "category": item.get("category", ""),
                    }
                )
            except (KeyError, ValueError, TypeError):
                continue
    last_call[0] = time.monotonic()
    cache[q] = hits
    save_cache(cache)
    return hits


def save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = CACHE + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    os.replace(tmp, CACHE)


def judge(fac: dict, hits: list[dict]) -> tuple[str, float | None, str]:
    if not hits:
        return "미검색", None, ""
    best = min(hits, key=lambda h: haversine_km(fac["lat"], fac["lon"], h["lat"], h["lon"]))
    dist = haversine_km(fac["lat"], fac["lon"], best["lat"], best["lon"])
    if dist <= MATCH_KM:
        return "성공", dist, best["name"]
    return "불일치", dist, best["name"]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    key = load_vworld_key()
    if not key:
        print("VWORLD_API_KEY가 없습니다 (.env 또는 환경변수에 설정)")
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
            try:
                for q in query_variants(fac["name"]):
                    hits = vworld_search(q, key, cache, last_call)
                    s, d, m = judge(fac, hits)
                    if s == "성공":
                        status, dist, matched = s, d, m
                        break
                    if s == "불일치" and (dist is None or d < dist):
                        status, dist, matched = s, d, m
            except VWorldRequestError as e:
                # 네트워크 오류로 확인 못함 — "미검색"(결과 없음 확인됨)과 구분해서
                # 캐시도 안 타고 다음 시설로 넘어감 (연결 복구 후 재실행하면 다시 시도됨)
                status, dist, matched = "오류", None, str(e)
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
        save_cache(cache)

    ok = sum(1 for r in rows if r["status"] == "성공")
    by_type: dict[str, dict[str, int]] = {}
    for r in rows:
        t = by_type.setdefault(r["type"], {"checked": 0, "ok": 0})
        t["checked"] += 1
        t["ok"] += r["status"] == "성공"
    report = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "geocoder": "VWorld (국토교통부 공간정보) 장소·주소 검색",
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
        w.writerow(["id", "name", "type", "lat", "lon", "status", "distance_km", "vworld_best_match"])
        for r in rows:
            if r["status"] != "성공":
                w.writerow([r["id"], r["name"], r["type"], r["lat"], r["lon"], r["status"],
                            "" if r["distanceKm"] is None else r["distanceKm"], r["matched"]])
    print(f"성공 {ok}/{len(rows)} ({report['successRate'] * 100:.1f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
