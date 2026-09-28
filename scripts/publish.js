// npm run build   → dist/ 만 만들기 (게시 안 함)
// npm run publish → dist/ 를 만들고 GitHub Pages / Firebase 에 게시
import { buildSite } from '../src/build.js';
import { publish } from '../src/publish.js';
import { saveNow } from '../src/store.js';

if (process.argv.includes('--build-only')) {
  const r = buildSite();
  console.log(`dist/ 생성: 특가 ${r.deals}개, 상세 페이지 ${r.pages}개`);
} else {
  const r = await publish();
  saveNow();
  process.exit(r.ok ? 0 : 1);
}
