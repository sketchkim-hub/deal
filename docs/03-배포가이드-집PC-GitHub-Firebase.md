# 배포 가이드 — 집 PC + GitHub Pages / Firebase Hosting

## 구성

```
┌──────────── 집 PC (한국 인터넷) ────────────┐          ┌──── 무료 호스팅 ────┐
│ npm start                                   │          │                     │
│  ├ 관리자 대시보드 http://127.0.0.1:3000/admin│  게시    │  GitHub Pages       │
│  ├ 크롬 '⚡ 특가 담기' 버튼 → 가격 저장         │ ───────▶ │    또는             │ ◀── 방문자
│  └ 정적 사이트 생성 (dist/) → 자동 게시       │          │  Firebase Hosting   │     (내 도메인)
└─────────────────────────────────────────────┘          └─────────────────────┘
```

- **서버 비용 0원.** 방문자는 GitHub/Firebase의 전 세계 CDN에서 페이지를 받으므로 빠르고, 집 PC가 꺼져도 사이트는 계속 열립니다(가격만 갱신되지 않음).
- 상품 정보는 **사람이 크롬에서 연 쿠팡 페이지**에서 '특가 담기' 버튼으로 가져옵니다. 쿠팡은 프로그램의 자동 접속을 차단하기 때문입니다.
- 48시간 동안 갱신되지 않은 상품은 사이트에서 자동으로 숨겨지고, 사이트 전체가 오래 갱신되지 않으면 상단에 "가격 정보가 오래되었어요" 안내가 뜹니다.

### GitHub Pages vs Firebase Hosting

| | GitHub Pages | Firebase Hosting |
| --- | --- | --- |
| 비용 | 무료 | 무료(Spark: 저장 10GB, 전송 월 10GB 정도) |
| 조건 | 사이트 저장소가 **공개(Public)** 이어야 무료 | 저장소 필요 없음 |
| 설정 난이도 | 쉬움 (토큰 1개) | 보통 (Firebase CLI 로그인 1회) |
| 도메인 연결 | 저장소 설정에서 입력 + DNS | 콘솔에서 입력 + DNS |
| 추천 | **처음 시작할 때** | 저장소를 공개하기 싫을 때 |

> 사이트 저장소에는 **완성된 HTML만** 올라갑니다(가격 확인 코드, 토큰, DB는 올라가지 않음). 그래서 공개 저장소여도 괜찮습니다.

---

## 1. 집 PC 준비 (Windows 기준, 맥도 거의 같음)

1. **Node.js 20 LTS** 설치: https://nodejs.org → LTS 다운로드
2. **Git** 설치: https://git-scm.com (GitHub Pages를 쓸 때 필요)
3. 코드 받기 — 명령 프롬프트(cmd)에서:
   ```bat
   cd %USERPROFILE%
   git clone https://github.com/sketchkim-hub/deal.git
   cd deal
   npm install
   ```
4. 설정 파일: `.env.example`을 복사해 `.env`로 만들고 메모장으로 엽니다.
   ```bat
   copy .env.example .env
   notepad .env
   ```

## 2-A. GitHub Pages로 게시 (추천)

1. GitHub에서 **새 저장소** 만들기: 이름 예 `teukga-site`, **Public**, README 없이 비워 둠
2. **토큰 만들기**: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate
   - Repository access: *Only select repositories* → `teukga-site`
   - Permissions → Repository permissions → **Contents: Read and write**
   - 만든 토큰(`github_pat_...`)을 복사
3. `.env`:
   ```
   PUBLISH_TARGET=github
   GITHUB_REPO_URL=https://github.com/<내아이디>/teukga-site.git
   GITHUB_BRANCH=gh-pages
   GITHUB_TOKEN=github_pat_....
   SITE_URL=https://<내아이디>.github.io/teukga-site
   BASE_PATH=/teukga-site
   ```
   (도메인 연결 전 임시 주소. 도메인을 연결하면 아래 4번에서 바꿉니다)
4. 첫 게시:
   ```bat
   npm run publish
   ```
5. GitHub 저장소 → Settings → **Pages** → Source: *Deploy from a branch* → Branch: `gh-pages` / `(root)` → Save
6. 1~2분 뒤 `https://<내아이디>.github.io/teukga-site/` 접속 확인

## 2-B. Firebase Hosting으로 게시

1. https://console.firebase.google.com → 프로젝트 만들기 (예: `teukga`) → 왼쪽 메뉴 **Hosting** → 시작하기 (CLI 설치 안내는 건너뛰어도 됨)
2. 집 PC에서 한 번만 로그인:
   ```bat
   npx firebase-tools login
   ```
3. `.env`:
   ```
   PUBLISH_TARGET=firebase
   FIREBASE_PROJECT=teukga          ← 프로젝트 ID (콘솔의 프로젝트 설정에 표시)
   SITE_URL=https://teukga.web.app
   BASE_PATH=
   ```
4. 첫 게시: `npm run publish` → `https://teukga.web.app` 접속 확인

## 3. 실행하고 '특가 담기' 버튼 설치

```bat
npm start
```
- 검은 창에 `관리자 대시보드: http://127.0.0.1:3000/admin`이 뜹니다. **이 창은 닫지 말고 둡니다**(닫으면 버튼이 동작하지 않음).
- 크롬에서 **http://127.0.0.1:3000/admin** 을 엽니다. 이 PC에서만 열리므로 비밀번호는 필요 없습니다.

**버튼 설치 (한 번만)**
1. 크롬에서 `Ctrl`+`Shift`+`B`를 눌러 북마크바를 켭니다.
2. 대시보드의 **'특가 담기' 버튼 설치 · 사용법**을 펼치고, 빨간 **⚡ 특가 담기** 버튼을 마우스로 끌어 북마크바에 놓습니다(클릭 아님).

**상품 담기**
1. 쿠팡에서 할인 중인 **상품 상세 페이지**를 엽니다.
2. 북마크바의 **⚡ 특가 담기**를 누릅니다. 작은 창에 상품명·사진·가격·할인율이 채워져 뜹니다.
   - 처음 누를 때 크롬이 "로컬 네트워크의 기기에 접근" 허용을 물으면 **허용**을 누르세요.
   - 팝업이 차단됐다고 나오면 주소창 오른쪽 아이콘에서 쿠팡 팝업을 **항상 허용**으로 바꿉니다.
3. 값이 맞는지 보고, 쿠팡 파트너스에서 **이 상품**의 단축링크를 만들어 붙여넣은 뒤 **저장하고 사이트에 올리기**를 누릅니다.
4. 30초 뒤 사이트에 자동으로 게시됩니다.

**가격 갱신 (하루 한 번 정도)**
- 대시보드의 **🔄 갱신 필요** 목록에서 **쿠팡 열기** → 열린 페이지에서 **⚡ 특가 담기** → **업데이트 저장**.
- 이미 담은 상품에서 버튼을 누르면 자동으로 "가격 업데이트" 창이 뜹니다. 이전 가격과 비교도 보여 줍니다.
- 48시간 넘게 갱신하지 않은 상품은 사이트에서 자동으로 숨겨집니다. 다시 담으면 복귀합니다.

**버튼이 값을 못 읽을 때**: 창에 직접 가격·정가를 입력하면 됩니다. 계속 못 읽으면 쿠팡 화면 구조가 바뀐 것이니 `src/coupang/selectors.js`를 고치거나 문의하세요.

**PC를 켜면 자동으로 실행되게 (Windows)**
1. 시작 메뉴 → "작업 스케줄러" → 오른쪽 **작업 만들기**
2. 일반: 이름 `오늘의특가`, "사용자가 로그온할 때만 실행"
3. 트리거: 새로 만들기 → **로그온할 때**
4. 동작: 새로 만들기 → 프로그램: `C:\Users\<이름>\deal\deploy\start-windows.bat`
5. 조건: "컴퓨터의 AC 전원이 켜져 있는 경우에만" 체크 해제
6. 확인을 누르면 다음 로그인부터 자동으로 켜집니다.

**맥**: `npm i -g pm2 && pm2 start src/server.js --name teukga && pm2 save && pm2 startup`

## 4. 도메인 구입과 연결

1. 가비아·후이즈 등에서 도메인 구입 (예: `todayteukga.com`, `오늘의특가.kr`)
2. **GitHub Pages**
   - DNS 설정(가비아: My가비아 → 도메인 → DNS 관리):

     | 타입 | 호스트 | 값 |
     | --- | --- | --- |
     | A | @ | 185.199.108.153 |
     | A | @ | 185.199.109.153 |
     | A | @ | 185.199.110.153 |
     | A | @ | 185.199.111.153 |
     | CNAME | www | `<내아이디>.github.io.` |

   - `.env` 변경 후 `npm run publish` (CNAME 파일이 자동으로 들어갑니다):
     ```
     SITE_URL=https://todayteukga.com
     BASE_PATH=
     ```
   - 저장소 Settings → Pages → Custom domain에 도메인 확인 → 인증서 발급 후 **Enforce HTTPS** 체크
3. **Firebase Hosting**
   - 콘솔 → Hosting → **커스텀 도메인 추가** → 안내하는 A 레코드/TXT 레코드를 DNS에 그대로 입력
   - `.env`: `SITE_URL=https://todayteukga.com` 후 `npm run publish`
4. 한글 도메인은 DNS·GitHub 설정에 퓨니코드(`xn--...`)로 입력합니다. 가비아 관리 화면에 표시됩니다.
5. DNS 반영과 HTTPS 인증서 발급에 몇 분~최대 24시간 걸릴 수 있습니다.

## 5. 백업

`data\db.json` 파일 하나가 전부입니다(상품·가격 이력). 이 파일을 OneDrive/구글 드라이브 폴더에 주기적으로 복사해 두세요. PC를 바꿀 때도 이 파일과 `.env`만 옮기면 됩니다.

## 6. 쿠팡 파트너스 API 승인 후

`.env`에 입력하고 `npm start` 재시작:
```
COUPANG_ACCESS_KEY=...
COUPANG_SECRET_KEY=...
```
- '특가 담기' 창에서 단축링크를 비워 두면 파트너스 링크가 자동으로 만들어집니다.
- 하루 3번(`CHECK_TIMES`) 골드박스 특가가 대시보드 **후보** 목록에 자동으로 들어옵니다. 쿠팡에서 열어 '특가 담기'로 등록하세요.

## 7. 문제 해결

| 증상 | 조치 |
| --- | --- |
| '특가 담기'를 눌러도 아무 창이 안 뜸 | 주소창 오른쪽의 팝업 차단 아이콘 → 쿠팡 팝업 **항상 허용** |
| 창에 "사이트에 연결할 수 없음" | 집 PC에서 `npm start` 창이 켜져 있는지 확인 (닫혀 있으면 다시 실행) |
| 크롬이 "로컬 네트워크 접근" 허용을 물음 | **허용** (내 PC의 관리자 화면으로 값을 보내기 위한 것) |
| 창에 "쿠팡 상품 정보를 읽지 못했습니다" | 검색 결과가 아니라 **상품 상세 페이지**(주소에 `/vp/products/`)에서 누르기 |
| 가격·정가 칸이 비어 있음 | 화면에 보이는 값을 직접 입력 후 저장. 자주 그러면 쿠팡 화면 구조가 바뀐 것 → `src/coupang/selectors.js`의 `salePrice`/`originalPrice` 맨 앞에 새 클래스 이름 추가 |
| "단축링크가 이 상품의 링크가 아닙니다" | 파트너스에서 **지금 담는 상품**의 링크를 다시 만들어 붙여넣기 |
| 게시 실패: git push … 403 | 토큰 권한(Contents: Read and write)과 대상 저장소 확인 |
| 게시 실패: firebase | `npx firebase-tools login` 다시 실행, `FIREBASE_PROJECT` 확인 |
| GitHub Pages에서 화면이 깨짐(스타일 없음) | 도메인 연결 전이면 `BASE_PATH=/저장소이름` 설정 후 다시 게시 |
