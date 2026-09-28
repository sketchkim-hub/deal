import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductPage, parseListPage, parsePrice, computeRate, isBlockedPage } from '../src/coupang/parse.js';
import { parseProductIds, canonicalProductUrl, isPartnerShortLink } from '../src/coupang/url.js';
import { nextRunAt, formatKst } from '../src/scheduler.js';
import { applyResult } from '../src/monitor.js';
import { isPublic } from '../src/store.js';
import { authorization } from '../src/coupang/api.js';

const pad = '<!-- ' + 'x'.repeat(3000) + ' -->';

const classicPage = `<html><head>
<meta property="og:title" content="맛있는 생수 2L x 24병 - 생수 | 쿠팡">
<meta property="og:image" content="//thumbnail9.coupangcdn.com/thumbnails/remote/492x492ex/image/water.jpg">
</head><body>${pad}
<h2 class="prod-buy-header__title">맛있는 생수 2L x 24병</h2>
<div class="prod-origin-price"><span class="discount-rate">36%</span><span class="origin-price">21,900원</span></div>
<div class="prod-sale-price"><span class="total-price"><strong>13,900<span>원</span></strong></span></div>
<img src="//image.coupangcdn.com/rocket_logo.png" alt="로켓배송">
</body></html>`;

const ldPage = `<html><head>
<meta property="og:title" content="스텐 프라이팬 | 쿠팡">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"스텐 프라이팬","image":["https://x/pan.jpg"],"offers":{"@type":"Offer","price":"29500","availability":"https://schema.org/InStock"}}</script>
</head><body>${pad}<div class="price-container"><span class="original-price-amount">59,000원</span></div></body></html>`;

test('parses the classic product layout', () => {
  const r = parseProductPage(classicPage, 'https://www.coupang.com/vp/products/123?itemId=4&vendorItemId=5');
  assert.equal(r.title, '맛있는 생수 2L x 24병 - 생수');
  assert.equal(r.image, 'https://thumbnail9.coupangcdn.com/thumbnails/remote/492x492ex/image/water.jpg');
  assert.equal(r.price, 13900);
  assert.equal(r.originalPrice, 21900);
  assert.equal(r.discountRate, 36);
  assert.equal(r.rocket, true);
  assert.equal(r.soldOut, false);
  assert.equal(r.productId, '123');
  assert.equal(r.itemId, '4');
});

test('falls back to JSON-LD price', () => {
  const r = parseProductPage(ldPage);
  assert.equal(r.price, 29500);
  assert.equal(r.originalPrice, 59000);
  assert.equal(r.discountRate, 50);
  assert.equal(r.title, '스텐 프라이팬');
});

test('detects sold out', () => {
  const r = parseProductPage(`<html><body>${pad}<div class="oos-label">품절</div><span class="total-price"><strong>9,900원</strong></span></body></html>`);
  assert.equal(r.soldOut, true);
});

test('never overstates the discount', () => {
  assert.equal(computeRate(8500, 10000), 15);
  assert.equal(computeRate(8501, 10000), 14);
  assert.equal(computeRate(10000, 9000), 0);
  assert.equal(parsePrice('1,234,500원'), 1234500);
  assert.equal(parsePrice(''), null);
});

test('recognises block pages', () => {
  assert.equal(isBlockedPage(403, classicPage), true);
  assert.equal(isBlockedPage(200, '<html>Access Denied</html>'), true);
  assert.equal(isBlockedPage(200, classicPage), false);
});

test('parses listing pages into candidates', () => {
  const html = `<ul>
    <li class="search-product"><a href="/vp/products/111?itemId=1"><img src="//img/a.jpg" alt="A 상품"><div class="name">A 상품</div>
      <span>40%</span><del class="base-price">50,000원</del><strong class="price-value">30,000원</strong></a></li>
    <li class="search-product"><a href="/vp/products/222"><div class="name">B 상품</div><strong>9,900원</strong></a></li>
  </ul>`;
  const list = parseListPage(html);
  assert.equal(list.length, 2);
  assert.equal(list[0].productId, '111');
  assert.equal(list[0].discountRate, 40);
  assert.equal(list[0].price, 30000);
  assert.equal(list[1].discountRate, 0);
});

test('url helpers', () => {
  assert.deepEqual(parseProductIds('https://www.coupang.com/vp/products/77?itemId=8&vendorItemId=9&q=x'), {
    productId: '77',
    itemId: '8',
    vendorItemId: '9',
  });
  assert.equal(parseProductIds('https://link.coupang.com/re/AFFSDP?lptag=AF1&pageKey=555&itemId=6')?.productId, '555');
  assert.equal(parseProductIds('https://example.com/'), null);
  assert.equal(canonicalProductUrl({ productId: '1', itemId: '2', vendorItemId: '' }), 'https://www.coupang.com/vp/products/1?itemId=2');
  assert.equal(isPartnerShortLink('https://link.coupang.com/a/bXyZ12'), true);
  assert.equal(isPartnerShortLink('https://www.coupang.com/vp/products/1'), false);
});

test('schedule uses Korean time', () => {
  const times = ['09:00', '15:00', '21:00'];
  // 2026-09-28 10:00 KST = 01:00 UTC → next is 15:00 KST (06:00 UTC)
  assert.equal(nextRunAt(times, new Date('2026-09-28T01:00:00Z')).toISOString(), '2026-09-28T06:00:00.000Z');
  // 22:00 KST → tomorrow 09:00 KST (00:00 UTC next day)
  assert.equal(nextRunAt(times, new Date('2026-09-28T13:00:00Z')).toISOString(), '2026-09-29T00:00:00.000Z');
  assert.equal(formatKst('2026-09-28T06:00:00Z'), '15:00');
});

test('applyResult tracks price drops and status', () => {
  const deal = { id: 'a', partnerUrl: 'https://link.coupang.com/a/x', price: null, history: [], status: 'pending' };
  const t1 = new Date('2026-09-28T00:00:00Z');
  applyResult(deal, { ok: true, data: { title: 'T', price: 10000, originalPrice: 20000, discountRate: 50 } }, t1);
  assert.equal(deal.status, 'active');
  assert.equal(deal.prevPrice ?? null, null);
  assert.equal(isPublic(deal, t1.getTime()), true);

  const t2 = new Date('2026-09-28T06:00:00Z');
  assert.equal(applyResult(deal, { ok: true, data: { price: 9000, originalPrice: 20000, discountRate: 55 } }, t2), true);
  assert.equal(deal.prevPrice, 10000);
  assert.equal(deal.history.length, 2);

  applyResult(deal, { ok: true, data: { price: 18000, originalPrice: 20000, discountRate: 10 } }, t2);
  assert.equal(deal.status, 'below');
  assert.equal(isPublic(deal, t2.getTime()), false);

  // A failed check keeps the last good state, until it goes stale.
  applyResult(deal, { ok: true, data: { price: 9000, originalPrice: 20000, discountRate: 55 } }, t2);
  applyResult(deal, { ok: false, error: 'blocked' }, t2);
  assert.equal(deal.status, 'active');
  assert.equal(deal.failCount, 1);
  assert.equal(isPublic(deal, t2.getTime() + 3600_000), true);
  assert.equal(isPublic(deal, t2.getTime() + 25 * 3600_000), false);
});

test('deals without a partner link are never public', () => {
  const deal = { partnerUrl: '', status: 'active', discountRate: 50, lastOkAt: new Date().toISOString() };
  assert.equal(isPublic(deal), false);
});

test('partners API signature header', () => {
  const header = authorization(
    'GET',
    '/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox',
    '',
    { accessKey: 'AK', secretKey: 'SK' },
    new Date('2026-09-28T01:02:03Z'),
  );
  assert.match(header, /^CEA algorithm=HmacSHA256, access-key=AK, signed-date=260928T010203Z, signature=[0-9a-f]{64}$/);
});
