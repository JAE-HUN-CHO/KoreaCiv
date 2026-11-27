"""
5km 육각 격자 칸별 인구 집계 (PLAN.md 2절 "인구: 격자 인구를 그대로 집계")

원자료
- WorldPop 2020 Constrained, UN 보정 (100m, 키 불필요, CC BY 4.0)
  PLAN.md 1순위인 SGIS 격자 인구는 별도 자료신청이 필요해 대체함

칸마다 계산하는 값
- 칸 안 100m 화소 인구의 합 (명)

앱은 이 값을 "칸별 인구 비중"으로만 씀. 시·군 인구 합계는 KOSIS 값으로 맞추고,
같은 시·군 안의 칸에 이 비중대로 나눔.

격자 좌표는 pipeline/terrain.py와 같은 식을 씀.
결과: src/data/generated/hexPopulation.json, data/manifest.json

실행: python3 pipeline/population.py   (rasterio, numpy 필요)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import rasterio

from terrain import (
    MANIFEST,
    N_KEYS,
    Q_OFFSET,
    Q_SPAN,
    R_OFFSET,
    ROOT,
    candidate_hexes,
    fetch,
    hex_key,
    latlon_to_hex,
    pixel_latlon,
)

RAW_DIR = os.path.join(ROOT, "data", "raw", "worldpop")
OUT_JSON = os.path.join(ROOT, "src", "data", "generated", "hexPopulation.json")
WP_NAME = "kor_ppp_2020_UNadj_constrained.tif"
WP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/"
    "2020/BSGM/KOR/" + WP_NAME
)
ROW_BLOCK = 500  # 메모리를 아끼려고 행 단위로 나눠 읽음


def aggregate_population() -> tuple[np.ndarray, float]:
    dest = os.path.join(RAW_DIR, WP_NAME)
    if not fetch(WP_URL, dest):
        raise RuntimeError(f"WorldPop 파일을 받지 못했습니다: {WP_URL}")
    pop = np.zeros(N_KEYS)
    raster_total = 0.0
    with rasterio.open(dest) as src:
        nodata = src.nodata
        _, lons_row = pixel_latlon(src, 1, src.width)
        lons_row = lons_row[0]
        t = src.transform
        for row0 in range(0, src.height, ROW_BLOCK):
            rows = min(ROW_BLOCK, src.height - row0)
            v = src.read(1, window=((row0, row0 + rows), (0, src.width))).astype(np.float64)
            lats = t.f + t.e * (np.arange(row0, row0 + rows) + 0.5)
            lat_g, lon_g = np.meshgrid(lats, lons_row, indexing="ij")
            q, r = latlon_to_hex(lat_g, lon_g)
            key = hex_key(q, r).ravel()
            v = v.ravel()
            ok = v > 0
            if nodata is not None:
                ok &= v != nodata
            raster_total += float(v[ok].sum())
            ok &= key >= 0
            np.add.at(pop, key[ok], v[ok])
    return pop, raster_total


def main() -> int:
    print("인구 집계 (WorldPop 2020 Constrained, UN 보정)")
    pop, raster_total = aggregate_population()

    cells: dict[str, int] = {}
    for q, r in sorted(candidate_hexes()):
        k = (r + R_OFFSET) * Q_SPAN + (q + Q_OFFSET)
        value = int(round(pop[k]))
        if value > 0:
            cells[f"{q},{r}"] = value
    hex_total = sum(cells.values())
    print(f"  원자료 합계 {raster_total:,.0f}명, 칸 합계 {hex_total:,}명")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "generatedAt": now,
        "source": "WorldPop 2020 Constrained (UN adjusted, 100m)",
        "unit": "persons",
        "cells": cells,
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    manifest = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            manifest = json.load(f)
    manifest["population"] = {
        "output": "src/data/generated/hexPopulation.json",
        "generatedAt": now,
        "cells": len(cells),
        "rasterTotal": round(raster_total),
        "hexTotal": hex_total,
        "sources": [
            {
                "name": "WorldPop 2020 Constrained, UN adjusted",
                "url": "https://hub.worldpop.org/geodata/summary?id=49761",
                "file": WP_URL,
                "resolution": "100m (3 arc-second)",
                "license": "CC BY 4.0",
                "note": "SGIS 격자 인구 대체. 앱은 시·군 안의 칸별 비중으로만 씀",
            }
        ],
    }
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"완료: {len(cells):,}칸 → {os.path.relpath(OUT_JSON, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
