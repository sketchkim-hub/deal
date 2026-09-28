// Diagnose one product page without touching the database:
//   npm run check -- "https://www.coupang.com/vp/products/123?itemId=..."
//   npm run check -- "https://link.coupang.com/a/xxxx"
import { createFetcher } from '../src/coupang/fetcher.js';
import { checkUrl } from '../src/monitor.js';
import { isPartnerShortLink, resolvePartnerLink } from '../src/coupang/url.js';
import { lookupGeo } from '../src/geo.js';

let url = process.argv[2];
if (!url) {
  console.error('사용법: npm run check -- <쿠팡 상품 URL 또는 파트너스 단축링크>');
  process.exit(1);
}

try {
  const geo = await lookupGeo();
  console.log(`IP ${geo.ip} · 국가 ${geo.country} · ${geo.org || ''}`);
  if (geo.country !== 'KR') console.warn('⚠ 한국 IP가 아닙니다. 결과가 실제와 다르거나 차단될 수 있습니다.');
} catch (e) {
  console.warn(e.message);
}

if (isPartnerShortLink(url)) {
  const r = await resolvePartnerLink(url);
  console.log('단축링크 →', r.productUrl);
  url = r.productUrl;
}

const fetcher = createFetcher();
const result = await checkUrl(url, fetcher);
await fetcher.close();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
