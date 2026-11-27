# KoreaCiv — 대한민국 문명 지도

남한 전역을 5km 육각 격자로 덮고, 공공통계를 Civilization 게임 용어(Gold, Production, 지구, 불가사의 등)로 바꿔 보여주는 인터랙티브 지도입니다.

**사이트**: https://jae-hun-cho.github.io/KoreaCiv/

![KoreaCiv 미리보기](public/og-image.jpg)

## 기능

| 화면 | 내용 |
| --- | --- |
| 지도 | 5km 육각 격자 약 4,800칸, 시·군 161곳 배너, 시설 아이콘. 칸에 마우스를 올리면 지형·산출량·소속 시군구 표시 |
| 렌즈 | 20개. 지형, GRDP, 1인당 GRDP, 인구밀도, 제조업 비중, 고령화, 발전 설비, 대학 연구비, 재해 피해액, 역사(2010~2024 인구 변화) 등 |
| City View | 시·군 하나의 인구, GRDP, 지구(District), 시민 구성("N명 중 1명"). 두 도시 나란히 비교 |
| 자문관 | 경제·산업·과학 등 9개 분야별 전국 요약 |
| 탐색기 | 시·군 지표 두 개를 골라 산점도와 표로 비교. 점을 누르면 지도에서 강조 |
| 불가사의 | 국립공원 탐방객, 대학 연구비, 문화유산 기준 상위 5곳씩 |
| 실시간 API | SGIS·KOSIS·VWorld 조회 (로컬 실행 시. 정적 배포에서는 스냅샷만) |
| 출처 패널 | 우측 상단 "출처·규칙". 항목별 출처, 기준연도, 추정 여부, 제외 항목 |

변환 규칙(입지계수 1.5 이상이면 지구 부여 등)은 [`PLAN.md`](PLAN.md) 4절과 `src/data/rules.ts`의 `CIV_RULES`에 있습니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 에서 열립니다. `server.ts`(Express)가 화면과 `/api/*` 프록시를 함께 띄웁니다.

공공 API를 쓰려면 `.env.example`을 `.env`로 복사하고 키를 넣습니다. 키가 없어도 앱은 내장 데이터로 동작합니다.

| 변수 | 용도 | 발급처 |
| --- | --- | --- |
| `SGIS_CONSUMER_KEY`, `SGIS_CONSUMER_SECRET` | 행정경계, 센서스 인구 | [SGIS 오픈 API](https://sgis.kostat.go.kr/developer/html/main.html) |
| `KOSIS_API_KEY` | GRDP, 주민등록인구, 고령화율 시계열 | [KOSIS](https://kosis.kr) |
| `VWORLD_API_KEY` | 장소 검색, 지오코딩 | [VWorld](https://www.vworld.kr) |

키는 서버에서만 읽고 브라우저로 보내지 않습니다.

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (Vite + API 프록시) |
| `npm run build` | `dist/`로 정적 빌드 |
| `npm start` | `dist/`와 API 프록시를 함께 서빙 (`NODE_ENV=production` 필요) |
| `npm test` | [`PLAN.md`](PLAN.md) 단계별 완료 기준 검사 |
| `npm run lint` | TypeScript 타입 검사 |
| `npm run snapshot` | 공공 API 응답을 `public/data/*.json`으로 저장 (정적 배포용) |

## 배포 (GitHub Pages)

`.github/workflows/deploy-pages.yml`이 `main`에 push할 때와 매일 03:17(KST)에 배포합니다.

1. `npm run snapshot`: `server.ts`를 잠깐 띄워 SGIS·KOSIS 응답 9개를 JSON으로 저장
2. `npm test`: 완료 기준 검사. 실패하면 배포하지 않음
3. `VITE_STATIC_DEPLOY=true`로 빌드: 앱이 `/api` 대신 저장된 JSON을 읽음
4. Pages에 배포

Pages에는 서버가 없어서, 키가 필요한 즉석 조회(SGIS 자치구 조회, KOSIS 통계표 검색, VWorld 검색)는 꺼집니다. 스냅샷을 받으려면 저장소 Settings → Secrets and variables → Actions에 `SGIS_CONSUMER_KEY`, `SGIS_CONSUMER_SECRET`, `KOSIS_API_KEY`를 등록합니다. 등록하지 않으면 내장 데이터로 배포됩니다.

## 데이터에 대해 알아둘 점

- 시·군 통계 대부분은 공공통계를 참고해 `src/data/*.ts`에 직접 입력한 값입니다. 출처와 기준연도는 출처 패널에 있습니다.
- 정적 배포에서는 SGIS 2024 행정경계와 KOSIS 최신 인구·GRDP가 스냅샷으로 덮어써집니다.
- 지형은 원자료를 칸별로 집계한 값입니다. 표고·기복은 [Copernicus DEM GLO-90](https://registry.opendata.aws/copernicus-dem/), 토지피복은 [ESA WorldCover 2021](https://esa-worldcover.org/)(CC BY 4.0)입니다.
- 칸별 인구는 시·군 인구(KOSIS)를 [WorldPop 2020](https://hub.worldpop.org/geodata/summary?id=49761)(CC BY 4.0) 100m 격자 인구 비율대로 나눈 값입니다. 시·군 합계는 KOSIS와 같습니다.
- **시·군 화물 물동량은 추정치입니다.** 화면과 출처 패널에 "추정"으로 표시돼 있습니다. 권역 간 화물 OD는 원자료(국가교통DB)를 확인하지 못해 넣지 않았고, 물류 렌즈는 항만 물동량과 공항(여객 수 기준)을 함께 보여줍니다.
- 시설 좌표는 직접 입력한 값입니다. `pipeline/geocode_check.py`(OpenStreetMap Nominatim)와 `pipeline/geocode_check_vworld.py`(VWorld)가 따로 검증하고, `pipeline/geocode_merge_reports.py`가 둘을 합쳐(`data/geocode_report_combined.json`) 둘 중 하나로라도 확인된 비율을 재산정합니다(아래 "지형·인구 데이터 다시 만들기" 참고).
- 기획서와 현재 구현의 차이는 [`REPORT.md`](REPORT.md)에 정리돼 있습니다.

## 지형·인구 데이터 다시 만들기

`src/data/generated/`의 `hexTerrain.json`, `hexPopulation.json`은 저장소에 커밋돼 있어 평소에는 다시 만들 필요가 없습니다. 격자 정의를 바꿨거나 원자료를 갱신할 때만 실행합니다.

```bash
pip install rasterio numpy
```

```bash
python3 pipeline/terrain.py
```

```bash
python3 pipeline/population.py
```

- DEM 타일과 WorldPop 파일(약 11MB)은 `data/raw/`에 받아 두고, 같은 파일이 있으면 다시 받지 않습니다.
- 토지피복은 용량이 커서 원격으로 축소본만 읽습니다.
- 출처와 생성 시각은 `data/manifest.json`에 기록됩니다.
- 격자 상수(칸 크기, 좌표 원점)는 `pipeline/terrain.py`와 앱 양쪽에 있습니다. 바꿀 때는 함께 고쳐야 합니다. `pipeline/population.py`는 `terrain.py`의 상수를 가져다 씁니다.

시설 좌표 검증은 Nominatim 이용 규칙 때문에 요청 사이에 2초씩 쉽니다(약 5분, 결과는 캐시).

```bash
mkdir -p data/raw
```

```bash
npx tsx scripts/dump-facilities.ts > data/raw/facilities.json
```

```bash
python3 pipeline/geocode_check.py data/raw/facilities.json
```

VWorld 검증은 `VWORLD_API_KEY`가 `.env`에 있으면 바로 실행됩니다(요청 간격 0.2초, 1분 이내).

```bash
python3 pipeline/geocode_check_vworld.py data/raw/facilities.json
python3 pipeline/geocode_merge_reports.py
```

`src/data/generated/universities.json`(기존 24개 외 318개 대학)은 저장소에 커밋돼 있어 평소엔 다시 만들 필요가 없습니다. 대학알리미 공시가 갱신됐을 때만 다시 받습니다(`DATA_GO_KR_SERVICE_KEY`, `VWORLD_API_KEY` 필요, 약 2분).

```bash
npx tsx pipeline/fetch_universities.ts
```

## 폴더 구조

```
server.ts                 Express 서버: 화면 서빙 + 공공 API 프록시
scripts/snapshot-api.ts   정적 배포용 API 스냅샷 수집
pipeline/terrain.py       DEM·토지피복을 칸별로 집계 (Python)
pipeline/population.py    격자 인구를 칸별로 집계 (Python)
pipeline/geocode_check.py        시설 좌표를 Nominatim으로 검증 (Python)
pipeline/geocode_check_vworld.py 시설 좌표를 VWorld로 검증 (Python)
pipeline/geocode_merge_reports.py Nominatim·VWorld 검증 합산 + 대형 시설 보정
pipeline/fetch_universities.ts   대학알리미 학교코드로 신규 대학 318곳 지오코딩 (TypeScript)
data/manifest.json        원자료 출처·생성 시각
data/geocode_*            시설 좌표 검증 결과
src/
  App.tsx                 화면 상태와 탭 구성
  components/             지도 캔버스, 렌즈 사이드바, City View, 각 탭 패널
  engine/hexGrid.ts       격자 생성, 지형 판정, 통계 배분
  engine/history.ts       역사 렌즈 (센서스 연도별 비교)
  data/                   시·군 통계, 시설, 변환 규칙(rules.ts)
  data/generated/         파이프라인이 만든 칸별 지형·인구·대학 (hexTerrain.json, hexPopulation.json, universities.json)
  services/publicApis.ts  API 호출 (정적 모드에서는 스냅샷 읽기)
tests/                    PLAN.md 완료 기준 테스트
PLAN.md                   기획서
REPORT.md                 기획서 대비 현재 상태
```
