"""
5km 육각 격자 칸별 지형 집계 (PLAN.md 2절, 4절, 5절 4단계 "래스터 집계")

원자료
- 표고: Copernicus DEM GLO-90 (90m, 1°×1° 타일, 키 불필요)
- 토지피복: ESA WorldCover 2021 v200 (10m, 3°×3° 타일). 원본은 너무 커서 COG 개요(overview)를
  약 80m 해상도로 원격 읽기 함

칸마다 계산하는 값
- elev: 육지 화소 평균 표고 (m)
- relief: 칸 안 최고 − 최저 표고 (m). PLAN.md 4절 "칸 내 기복"
- lc: 토지피복 최다 유형 (PLAN.md 4절 "칸 안에서 면적이 가장 큰 유형")

격자 좌표는 앱(src/engine/hexGrid.ts, src/data/koreaGeography.ts)과 같은 식을 씀.
결과: src/data/generated/hexTerrain.json, data/manifest.json

실행: python3 pipeline/terrain.py   (rasterio, numpy 필요)
"""

from __future__ import annotations

import json
import math
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

import numpy as np
import rasterio
from rasterio.enums import Resampling

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw", "copernicus-dem-90m")
OUT_JSON = os.path.join(ROOT, "src", "data", "generated", "hexTerrain.json")
MANIFEST = os.path.join(ROOT, "data", "manifest.json")

# ---- 앱과 같은 격자 정의 (값을 바꾸면 앱 쪽도 같이 바꿀 것) ----
HEX_WIDTH_KM = 5.0
HEX_RADIUS_KM = HEX_WIDTH_KM / math.sqrt(3)
ORIGIN_LON, ORIGIN_LAT = 127.5, 36.0
KM_PER_DEG_LAT = 110.95
KM_PER_DEG_LON = 111.32 * math.cos(math.radians(ORIGIN_LAT))
Q_RANGE = (-68, 82)
R_RANGE = (-72, 78)
X_RANGE = (-165.0, 335.0)  # 앱의 두 격자 생성 루프 범위를 모두 포함
Y_RANGE = (-310.0, 340.0)

LAT_RANGE = (33, 39)  # 타일 남서쪽 모서리 기준 [33, 38]
LON_RANGE = (124, 132)  # [124, 131]

DEM_URL = (
    "https://copernicus-dem-90m.s3.amazonaws.com/"
    "Copernicus_DSM_COG_30_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM/"
    "Copernicus_DSM_COG_30_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM.tif"
)
WC_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
    "ESA_WorldCover_10m_2021_v200_N{lat:02d}E{lon:03d}_Map.tif"
)
WC_TILES = [(33, 123), (33, 126), (33, 129), (36, 123), (36, 126), (36, 129)]
WC_DECIMATION = 8  # 10m → 약 80m

# 앱의 TerrainType 순서. PLAN.md 4절 대응표
TERRAINS = ["urban", "farmland", "forest", "grassland", "marsh", "barren", "water"]
WORLDCOVER_TO_TERRAIN = {
    10: "forest",  # Tree cover → 산림
    20: "grassland",  # Shrubland → 초지
    30: "grassland",  # Grassland → 초지
    40: "farmland",  # Cropland → 농업
    50: "urban",  # Built-up → 시가화
    60: "barren",  # Bare / sparse vegetation → 나지
    70: "barren",  # Snow and ice → 나지
    80: "water",  # Permanent water bodies → 수역
    90: "marsh",  # Herbaceous wetland → 습지
    95: "marsh",  # Mangroves → 습지
    100: "grassland",  # Moss and lichen → 초지
}


def latlon_to_hex(lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """위경도 배열 → (q, r) 정수 배열. 앱의 latLonToKm + axialToKm 역변환 + 큐브 반올림"""
    x = (lon - ORIGIN_LON) * KM_PER_DEG_LON
    y = (ORIGIN_LAT - lat) * KM_PER_DEG_LAT
    rf = y / (1.5 * HEX_RADIUS_KM)
    qf = x / HEX_WIDTH_KM - rf / 2
    sf = -qf - rf
    q, r, s = np.rint(qf), np.rint(rf), np.rint(sf)
    dq, dr, ds = np.abs(q - qf), np.abs(r - rf), np.abs(s - sf)
    fix_q = (dq > dr) & (dq > ds)
    fix_r = ~fix_q & (dr > ds)
    q = np.where(fix_q, -r - s, q)
    r = np.where(fix_r, -q - s, r)
    return q.astype(np.int32), r.astype(np.int32)


def candidate_hexes() -> set[tuple[int, int]]:
    out = set()
    for r in range(R_RANGE[0], R_RANGE[1] + 1):
        for q in range(Q_RANGE[0], Q_RANGE[1] + 1):
            x = HEX_WIDTH_KM * (q + r / 2)
            y = HEX_RADIUS_KM * 1.5 * r
            if X_RANGE[0] <= x <= X_RANGE[1] and Y_RANGE[0] <= y <= Y_RANGE[1]:
                out.add((q, r))
    return out


Q_OFFSET = -Q_RANGE[0]
R_OFFSET = -R_RANGE[0]
Q_SPAN = Q_RANGE[1] - Q_RANGE[0] + 1
R_SPAN = R_RANGE[1] - R_RANGE[0] + 1
N_KEYS = Q_SPAN * R_SPAN


def hex_key(q: np.ndarray, r: np.ndarray) -> np.ndarray:
    """(q, r) → 0..N_KEYS-1 정수 키. 범위 밖은 -1"""
    inside = (q >= Q_RANGE[0]) & (q <= Q_RANGE[1]) & (r >= R_RANGE[0]) & (r <= R_RANGE[1])
    key = (r + R_OFFSET) * Q_SPAN + (q + Q_OFFSET)
    return np.where(inside, key, -1)


def pixel_latlon(src, rows: int, cols: int):
    t = src.transform * rasterio.Affine.scale(src.width / cols, src.height / rows)
    col_idx = np.arange(cols) + 0.5
    row_idx = np.arange(rows) + 0.5
    lons = t.c + t.a * col_idx
    lats = t.f + t.e * row_idx
    return np.meshgrid(lats, lons, indexing="ij")


def fetch(url: str, dest: str) -> bool:
    """같은 파일이 있으면 다시 받지 않음 (PLAN.md 5절 원칙)"""
    if os.path.exists(dest):
        return True
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):  # 바다만 있는 타일은 없음
            return False
        raise
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest + ".part", "wb") as f:
        f.write(data)
    os.replace(dest + ".part", dest)
    return True


def aggregate_dem():
    elev_sum = np.zeros(N_KEYS)
    elev_cnt = np.zeros(N_KEYS)
    elev_min = np.full(N_KEYS, np.inf)
    elev_max = np.full(N_KEYS, -np.inf)
    tiles = 0
    for lat in range(*LAT_RANGE):
        for lon in range(*LON_RANGE):
            name = f"N{lat:02d}E{lon:03d}.tif"
            dest = os.path.join(RAW_DIR, name)
            url = DEM_URL.format(ns="N", lat=lat, ew="E", lon=lon)
            if not fetch(url, dest):
                continue
            tiles += 1
            with rasterio.open(dest) as src:
                z = src.read(1).astype(np.float64)
                nodata = src.nodata
                lats, lons = pixel_latlon(src, src.height, src.width)
            q, r = latlon_to_hex(lats, lons)
            key = hex_key(q, r).ravel()
            z = z.ravel()
            # 바다는 0으로 채워져 있으므로 0 초과만 육지 화소로 봄
            land = (key >= 0) & (z > 0)
            if nodata is not None:
                land &= z != nodata
            k, v = key[land], z[land]
            np.add.at(elev_sum, k, v)
            np.add.at(elev_cnt, k, 1)
            np.minimum.at(elev_min, k, v)
            np.maximum.at(elev_max, k, v)
            print(f"  DEM {name}: 육지 화소 {land.sum():,}")
    return tiles, elev_sum, elev_cnt, elev_min, elev_max


def aggregate_landcover():
    counts = np.zeros((N_KEYS, len(TERRAINS)), dtype=np.int64)
    tiles = 0
    for lat, lon in WC_TILES:
        url = WC_URL.format(lat=lat, lon=lon)
        try:
            src = rasterio.open("/vsicurl/" + url)
        except rasterio.errors.RasterioIOError:
            continue
        tiles += 1
        with src:
            rows, cols = src.height // WC_DECIMATION, src.width // WC_DECIMATION
            cls = src.read(1, out_shape=(rows, cols), resampling=Resampling.nearest)
            lats, lons = pixel_latlon(src, rows, cols)
        terrain_idx = np.full(256, -1, dtype=np.int64)
        for code, name in WORLDCOVER_TO_TERRAIN.items():
            terrain_idx[code] = TERRAINS.index(name)
        total = 0
        # 메모리를 아끼려고 행 블록 단위로 처리
        for start in range(0, rows, 400):
            sl = slice(start, start + 400)
            q, r = latlon_to_hex(lats[sl], lons[sl])
            key = hex_key(q, r).ravel()
            t = terrain_idx[cls[sl].ravel()]
            ok = (key >= 0) & (t >= 0)
            np.add.at(counts, (key[ok], t[ok]), 1)
            total += int(ok.sum())
        print(f"  WorldCover N{lat}E{lon}: 화소 {total:,}")
    return tiles, counts


def main() -> int:
    print("표고 집계 (Copernicus GLO-90)")
    dem_tiles, esum, ecnt, emin, emax = aggregate_dem()
    print("토지피복 집계 (ESA WorldCover 2021)")
    wc_tiles, lc_counts = aggregate_landcover()
    if dem_tiles == 0 or wc_tiles == 0:
        print("원자료를 받지 못했습니다.", file=sys.stderr)
        return 1

    cells: dict[str, list[int]] = {}
    for q, r in sorted(candidate_hexes()):
        k = (r + R_OFFSET) * Q_SPAN + (q + Q_OFFSET)
        if ecnt[k] == 0:
            continue  # 육지 화소가 없는 칸 (바다)
        lc = int(np.argmax(lc_counts[k])) if lc_counts[k].sum() > 0 else TERRAINS.index("water")
        cells[f"{q},{r}"] = [
            int(round(esum[k] / ecnt[k])),
            int(round(emax[k] - emin[k])),
            lc,
        ]

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "generatedAt": now,
        "sources": ["Copernicus DEM GLO-90", "ESA WorldCover 2021 v200"],
        "fields": ["elevMeanM", "reliefM", "terrainIndex"],
        "terrains": TERRAINS,
        "cells": cells,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    manifest = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            manifest = json.load(f)
    manifest["terrain"] = {
        "output": "src/data/generated/hexTerrain.json",
        "generatedAt": now,
        "cells": len(cells),
        "sources": [
            {
                "name": "Copernicus DEM GLO-90",
                "url": "https://registry.opendata.aws/copernicus-dem/",
                "resolution": "90m",
                "tiles": dem_tiles,
                "note": "DSM(지표면 모델): 건물·수목 높이 포함",
            },
            {
                "name": "ESA WorldCover 2021 v200",
                "url": "https://esa-worldcover.org/",
                "resolution": f"10m 원본을 {WC_DECIMATION}배 축소(약 80m)해 집계",
                "tiles": wc_tiles,
                "license": "CC BY 4.0",
            },
        ],
    }
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"완료: {len(cells):,}칸 → {os.path.relpath(OUT_JSON, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
