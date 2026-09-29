import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { bookmarkletHref, parseCapture, parseFormData } from '../src/capture.js';

test('parses what the bookmarklet sends', () => {
  const d = parseCapture(
    JSON.stringify({
      u: 'https://www.coupang.com/vp/products/9152056213?itemId=29058362309&vendorItemId=1&q=x',
      t: '맛있는 생수 2L x 24병 | 쿠팡',
      i: '//thumbnail9.coupangcdn.com/a.jpg',
      p: '13,900원',
      o: '21,900원',
      r: '36%',
      so: 0,
      rk: 1,
    }),
  );
  assert.equal(d.productId, '9152056213');
  assert.equal(d.itemId, '29058362309');
  assert.equal(d.productUrl, 'https://www.coupang.com/vp/products/9152056213?itemId=29058362309&vendorItemId=1');
  assert.equal(d.title, '맛있는 생수 2L x 24병');
  assert.equal(d.image, 'https://thumbnail9.coupangcdn.com/a.jpg');
  assert.equal(d.price, 13900);
  assert.equal(d.originalPrice, 21900);
  assert.equal(d.discountRate, 36);
  assert.equal(d.rocket, true);
  assert.equal(d.soldOut, false);
});

test('uses the shown rate when there is no crossed-out price', () => {
  const d = parseCapture({ u: 'https://www.coupang.com/vp/products/1', p: '9,900', o: '', r: '20%' });
  assert.equal(d.originalPrice, null);
  assert.equal(d.discountRate, 20);
});

test('rejects non-product pages and junk', () => {
  assert.equal(parseCapture('not json'), null);
  assert.equal(parseCapture({ u: 'https://www.coupang.com/np/search?q=a' }), null);
  assert.equal(parseCapture(null), null);
});

test('form values accept typed numbers and ignore bad image urls', () => {
  const f = parseFormData({ title: '상품', price: '12,000원', originalPrice: '20000', image: 'javascript:alert(1)', rocket: '1' });
  assert.equal(f.price, 12000);
  assert.equal(f.originalPrice, 20000);
  assert.equal(f.discountRate, 40);
  assert.equal(f.image, '');
  assert.equal(f.rocket, true);
});

test('bookmarklet reads a product page and opens the capture form', () => {
  const href = bookmarkletHref('http://127.0.0.1:3000');
  assert.match(href, /^javascript:/);
  const code = decodeURIComponent(href.slice('javascript:'.length));

  // A tiny fake of the parts of the DOM the bookmarklet touches.
  const elements = {
    'meta[property="og:title"]': { getAttribute: () => '테스트 상품 | 쿠팡' },
    'meta[property="og:image"]': { getAttribute: () => '//img.example/p.jpg' },
    '.prod-sale-price .total-price strong': { textContent: '9,900원' },
    '.prod-origin-price .origin-price': { textContent: '19,900원' },
  };
  let opened = null;
  const sandbox = {
    location: { hostname: 'www.coupang.com', href: 'https://www.coupang.com/vp/products/42?itemId=7' },
    document: {
      querySelector: (s) => elements[s] || null,
      querySelectorAll: () => [],
    },
    window: { open: (url) => (opened = url) },
    alert: () => {
      throw new Error('should not alert');
    },
    encodeURIComponent,
    JSON,
    String,
    Array,
  };
  vm.runInNewContext(code, sandbox);
  assert.ok(opened.startsWith('http://127.0.0.1:3000/admin/capture?d='));
  const d = parseCapture(decodeURIComponent(opened.split('?d=')[1]));
  assert.equal(d.productId, '42');
  assert.equal(d.price, 9900);
  assert.equal(d.originalPrice, 19900);
  assert.equal(d.discountRate, 50);
  assert.equal(d.title, '테스트 상품');
});
