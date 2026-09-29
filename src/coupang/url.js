// Helpers for the several URL shapes a Coupang product can appear under.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export { isPartnerShortLink, isCoupangUrl, parseProductIds, canonicalProductUrl } from '../shared/ids.js';
import { parseProductIds, canonicalProductUrl } from '../shared/ids.js';

// Follow a link.coupang.com short link far enough to learn which product it points at.
// We stop at the first hop that reveals a product id, so the product page itself is not loaded.
export async function resolvePartnerLink(shortUrl, { maxHops = 6 } = {}) {
  let url = shortUrl;
  for (let hop = 0; hop < maxHops; hop++) {
    const ids = parseProductIds(url);
    if (ids) return { ...ids, productUrl: canonicalProductUrl(ids) };
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: AbortSignal.timeout(15000),
    });
    const loc = res.headers.get('location');
    if (!loc) {
      // Some hops redirect with a meta refresh / JS instead of a Location header.
      const body = await res.text().catch(() => '');
      const inner = body.match(/https?:\/\/www\.coupang\.com\/vp\/products\/\d+[^"'\s<>]*/);
      if (inner) {
        const found = parseProductIds(inner[0].replace(/&amp;/g, '&'));
        if (found) return { ...found, productUrl: canonicalProductUrl(found) };
      }
      break;
    }
    url = new URL(loc, url).toString();
  }
  throw new Error('단축링크에서 상품 주소를 찾지 못했습니다. 상품 URL을 함께 입력해 주세요.');
}
