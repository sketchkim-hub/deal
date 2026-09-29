# 오늘의특가 — 쿠팡 15%+ 특가 모음 사이트

쿠팡에서 15% 이상 할인 중인 상품을 썸네일·가격·할인율과 함께 보여주는 쿠팡 파트너스 사이트입니다. 집 PC에서 도는 **관리자 대시보드**로 상품을 모으고, 만든 페이지는 **GitHub Pages 또는 Firebase Hosting**에 자동으로 게시합니다. 서버 비용은 들지 않습니다.

- [기획안](docs/01-기획안.md)
- [디자인 전략](docs/02-디자인전략.md)
- [배포 가이드 — 집 PC 설치, '특가 담기' 버튼, GitHub Pages / Firebase, 도메인 연결](docs/03-배포가이드-집PC-GitHub-Firebase.md)

## 상품을 모으는 방법: '특가 담기' 버튼

쿠팡은 프로그램이 상품 페이지를 자동으로 읽는 것을 차단합니다(한국 가정용 IP에서도 확인됨). 그래서 **사람이 연 쿠팡 페이지에서 버튼 한 번**으로 담는 방식을 씁니다.

1. 크롬 북마크바에 **⚡ 특가 담기** 버튼을 한 번 설치합니다(관리자 대시보드에서 끌어다 놓기).
2. 쿠팡에서 할인 중인 상품 페이지를 열고 **⚡ 특가 담기**를 누릅니다.
3. 작은 창에 상품명·사진·가격·할인율이 채워져 뜹니다. 파트너스 단축링크를 붙여 **저장**하면 30초 뒤 사이트에 올라갑니다.
4. 이미 담은 상품에서 다시 누르면 **가격만 업데이트**됩니다. 대시보드의 **갱신 필요** 목록에서 `쿠팡 열기 → 특가 담기`로 하루 한 번 정도 갱신하세요.

- 할인율 15% 미만·품절이면 사이트에 노출되지 않습니다.
- 가격이 내려가면 "방금 인하" 배지와 "방금 가격 내려갔어요" 영역에 표시됩니다.
- 48시간 동안 갱신되지 않은 상품은 사이트에서 자동으로 숨겨집니다(`STALE_HOURS`).
- 사람이 직접 연 화면을 읽는 방식이라 쿠팡 차단이나 약관 문제가 없습니다.
- 파트너스 Open API가 승인되면 `.env`에 키만 넣어 단축링크 자동 생성·골드박스 후보 수집을 켤 수 있습니다.

## 빠른 시작 (집 PC)

```bash
git clone https://github.com/sketchkim-hub/deal.git
cd deal
npm install
cp .env.example .env        # Windows: copy .env.example .env  → 게시 설정 입력
npm start                   # 관리자 대시보드: http://127.0.0.1:3000/admin
```

디자인만 먼저 보고 싶다면 (샘플 데이터, 실제 데이터와 분리):
```bash
npm run demo
DATA_DIR=data-demo PUBLISH_TARGET=none npm start   # → http://127.0.0.1:3000
```
(Windows cmd: `set DATA_DIR=data-demo&& set PUBLISH_TARGET=none&& npm start`)

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm start` | 관리자 대시보드 + '특가 담기' 받기 + 자동 게시 |
| `npm run publish` | 지금 바로 사이트 생성·게시 |
| `npm run build` | `dist/`에 사이트 파일만 생성 (게시 안 함) |
| `npm run demo` | 디자인 미리보기용 샘플 데이터 |
| `npm test` | 파서·담기·상태 규칙·빌드 테스트 |
| `npm run geo`, `npm run check -- <URL>` | 자동 확인(`MONITOR_MODE=on`)을 시험할 때만 사용 |

## 구조

```
src/
  server.js          집 PC용: 관리자 대시보드, 특가 담기, 미리보기, 게시
  capture.js         '특가 담기' 북마크 코드와 담긴 값 해석
  monitor.js         가격 반영 규칙(이력·인하·노출 여부), 선택형 자동 확인
  build.js           정적 사이트 생성 (dist/)
  publish.js         GitHub Pages(gh-pages 브랜치) / Firebase Hosting 게시
  store.js           JSON 파일 DB (data/db.json)
  coupang/
    selectors.js     쿠팡 화면 선택자 (구조 변경 시 여기만 수정)
    parse.js, url.js 가격·주소 해석
    api.js           파트너스 Open API (승인 후 사용)
  views/             HTML 템플릿 (사이트, 대시보드, 담기 창)
public/              CSS, JS, 아이콘
scripts/             publish, demo, check, geo
deploy/              Windows 자동 실행, 백업
firebase.json        Firebase Hosting 설정
```

## 지켜야 할 것

- 파트너스 고지 문구는 모든 페이지 상·하단에 자동 표시됩니다. 지우지 마세요.
- `.env`(토큰), `data/`(DB)는 저장소에 올리지 마세요. `.gitignore`에 들어 있습니다.
- `MONITOR_MODE=on`(프로그램이 쿠팡 페이지를 직접 읽는 자동 확인)은 쿠팡이 차단하며 약관상 권장하지 않습니다. 기본값인 `off`로 두세요.
