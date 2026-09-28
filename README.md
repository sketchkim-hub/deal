# 오늘의특가 — 쿠팡 15%+ 특가 모음 사이트

쿠팡에서 15% 이상 할인 중인 상품을 썸네일·가격·할인율과 함께 보여주는 쿠팡 파트너스 사이트입니다. **집 PC(한국 IP)** 가 하루 3번(09·15·21시) 가격을 다시 확인하고, 결과로 만든 페이지를 **GitHub Pages 또는 Firebase Hosting**에 자동으로 게시합니다. 서버 비용은 들지 않습니다.

- [기획안](docs/01-기획안.md)
- [디자인 전략](docs/02-디자인전략.md)
- [배포 가이드 — 집 PC + GitHub Pages / Firebase, 도메인 연결](docs/03-배포가이드-집PC-GitHub-Firebase.md)

## 빠른 시작 (집 PC)

```bash
git clone https://github.com/sketchkim-hub/deal.git
cd deal
npm install
cp .env.example .env        # Windows: copy .env.example .env  → 게시 설정 입력
npm run geo                 # 한국 IP인지 확인
npm start                   # 관리자: http://127.0.0.1:3000/admin
```

디자인만 먼저 보고 싶다면 (샘플 데이터, 실제 데이터와 분리):
```bash
npm run demo
DATA_DIR=data-demo MONITOR_MODE=off PUBLISH_TARGET=none npm start   # → http://127.0.0.1:3000
```
(Windows cmd: `set DATA_DIR=data-demo&& set MONITOR_MODE=off&& set PUBLISH_TARGET=none&& npm start`)

## 운영 흐름 (API 승인 전)

1. [쿠팡 파트너스](https://partners.coupang.com/)에서 15% 이상 할인 상품의 링크를 생성 → 단축링크 복사
2. 관리자 화면에 붙여넣고 카테고리 선택 → **등록하고 가격 확인**
3. 집 PC가 단축링크를 따라가 상품을 찾고 제목·썸네일·가격·할인율을 읽음 → 사이트 자동 게시
4. 이후 09·15·21시마다 자동 재확인 → 자동 게시
   - 할인율 15% 미만 / 품절 → 자동 숨김, 다시 15% 이상이면 자동 복귀
   - 가격이 내려가면 "방금 인하" 배지와 "방금 가격 내려갔어요" 영역에 노출
   - 확인 실패가 24시간 이상 이어지면 숨김
   - PC가 정시에 꺼져 있었다면 켜진 직후 밀린 확인 실행

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm start` | 관리자 화면 + 정기 확인 + 자동 게시 |
| `npm run publish` | 지금 바로 사이트 생성·게시 |
| `npm run build` | `dist/`에 사이트 파일만 생성 (게시 안 함) |
| `npm run geo` | 이 PC의 IP 국가 확인 (KR이어야 함) |
| `npm run check -- <URL>` | 상품 하나를 DB 변경 없이 읽어 보기 (진단용) |
| `npm run demo` | 디자인 미리보기용 샘플 데이터 |
| `npm test` | 파서·스케줄·상태 규칙·빌드 테스트 |

## 구조

```
src/
  server.js          집 PC용: 관리자 화면, 미리보기, 정기 확인 → 게시
  monitor.js         가격 확인, 결과 반영 규칙, 후보 수집
  build.js           정적 사이트 생성 (dist/)
  publish.js         GitHub Pages(gh-pages 브랜치) / Firebase Hosting 게시
  scheduler.js       한국 시간 스케줄 (절전·종료 후 밀린 확인 따라잡기)
  geo.js             IP 국가 확인
  store.js           JSON 파일 DB (data/db.json)
  coupang/
    url.js           단축링크 해석, 상품 번호 추출
    fetcher.js       일반 요청 → 차단 시 Chromium
    parse.js         상품/목록 페이지 파싱
    selectors.js     쿠팡 화면 선택자 (구조 변경 시 여기만 수정)
    api.js           파트너스 Open API (승인 후 사용)
  views/             HTML 템플릿
public/              CSS, JS, 아이콘
scripts/             publish, check, geo, demo
deploy/              Windows 자동 실행, 백업
firebase.json        Firebase Hosting 설정
```

## 지켜야 할 것

- 파트너스 고지 문구는 모든 페이지 상·하단에 자동 표시됩니다. 지우지 마세요.
- `.env`(토큰), `data/`(DB)는 저장소에 올리지 마세요. `.gitignore`에 들어 있습니다.
- 쿠팡 약관은 허가 없는 자동 수집을 제한합니다. 이 시스템은 직접 등록한 상품만 하루 3번, 상품마다 3~8초 간격으로 확인하도록 되어 있지만, **API 승인 후에는 API 방식으로 옮기는 것을 권장합니다.** 확인 빈도를 크게 올리지 마세요.
