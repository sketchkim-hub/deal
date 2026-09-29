# 오늘의특가 — 쿠팡 15%+ 특가 모음 사이트

쿠팡에서 15% 이상 할인 중인 상품을 썸네일·가격·할인율과 함께 보여주는 쿠팡 파트너스 사이트입니다. **설치 없이 브라우저만으로** 운영합니다.

- 공개 사이트: `https://sketchkim-hub.github.io/deal/` (도메인 연결 가능)
- 관리자 대시보드: `https://sketchkim-hub.github.io/deal/admin/` (GitHub 토큰으로 로그인)

**처음 시작하기 → [시작 가이드](docs/03-시작가이드-웹대시보드.md)** · [기획안](docs/01-기획안.md) · [디자인 전략](docs/02-디자인전략.md)

## 동작 방식

```
쿠팡 상품 페이지 ─[⚡ 특가 담기 북마크]─▶ 담기 창(웹) ─┐
관리자 대시보드(웹) ─ 편집·숨김·삭제 ──────────────────┤
                                                    ▼  GitHub API로 content/db.json 저장(커밋)
                         GitHub Actions: 사이트 생성 → GitHub Pages 게시 (1~2분)
```

- **특가 담기**: 사람이 연 쿠팡 페이지에서 상품명·사진·가격·할인율을 읽어 옵니다. 쿠팡은 프로그램의 자동 접속을 차단하므로(한국 가정용 IP에서도 확인) 자동 수집은 하지 않습니다.
- 이미 담은 상품에서 다시 누르면 **가격만 업데이트**되고, 내려간 가격은 "방금 인하"로 표시됩니다.
- 할인율 15% 미만·품절·48시간 넘게 갱신 안 된 상품은 사이트에서 자동으로 숨겨집니다.
- 사이트는 저장할 때마다, 그리고 3시간마다 자동으로 다시 만들어집니다.

## 구조

```
admin/               웹 대시보드와 담기 창 (브라우저에서 실행, GitHub API 사용)
content/db.json      상품·가격 이력 데이터 (대시보드가 커밋)
site.config.json     사이트 이름·할인 기준 등 설정
.github/workflows/   pages.yml — 사이트 생성·게시
src/
  shared/            사이트 생성과 대시보드가 함께 쓰는 규칙 (노출 조건, 가격 해석, 북마크 코드, 쿠팡 선택자)
  build.js           정적 사이트 생성 (dist/)
  views/             공개 사이트 HTML 템플릿
  server.js          (선택) PC에서 미리보기용 로컬 서버
public/              사이트 CSS·JS·아이콘
test/                테스트 (npm test)
```

## 개발자용

```bash
npm install
npm test
node scripts/publish.js --build-only     # dist/ 생성
npm run demo && DATA_DIR=data-demo PUBLISH_TARGET=none npm start   # 샘플 데이터로 로컬 미리보기
```

## 지켜야 할 것

- 파트너스 고지 문구는 모든 페이지 상·하단에 자동 표시됩니다. 지우지 마세요.
- GitHub 토큰은 저장소에 올리지 마세요. 대시보드는 토큰을 각 브라우저에만 저장합니다.
- 쿠팡의 봇 차단을 우회하는 자동 수집은 약관 위반이며 파트너스 계정 정지 위험이 있습니다.
