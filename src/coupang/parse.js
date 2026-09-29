import * as cheerio from 'cheerio';
import { PRODUCT, LIST } from './selectors.js';
import { parseProductIds, canonicalProductUrl } from './url.js';

export { parsePrice, parseRate, computeRate, cleanTitle } from '../shared/price.js';
import { parsePrice, parseRate, computeRate, cleanTitle } from '../shared/price.js';

function absUrl(src, base = 'https://www.coupang.com/') {
  if (!src) return '';
  src = src.trim();
  if (src.startsWith('//')) return `https:${src}`;
  try {
    return new URL(src, base).toString();
  } catch {
    return '';
  }
}

function firstText($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first();
    const t = el.text().trim();
    if (t) return t;
  }
  return '';
}

function jsonLdProduct($) {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    let data;
    try {
      data = JSON.parse($(el).contents().text());
    } catch {
      continue;
    }
    const nodes = [data, ...(Array.isArray(data) ? data : []), ...(data?.['@graph'] || [])];
    const product = nodes.find((n) => n && /Product/i.test(String(n['@type'])));
    if (product) return product;
  }
  return null;
}

// Returns whatever could be read from a product page; `price` is null when parsing failed.
export function parseProductPage(html, pageUrl = '') {
  const $ = cheerio.load(html);
  const meta = (p) => $(`meta[property="${p}"]`).attr('content') || $(`meta[name="${p}"]`).attr('content') || '';

  const ld = jsonLdProduct($);
  const offers = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;

  const title = cleanTitle(meta('og:title') || ld?.name || firstText($, PRODUCT.title));
  let image = meta('og:image') || (Array.isArray(ld?.image) ? ld.image[0] : ld?.image) || '';
  if (!image) {
    for (const sel of PRODUCT.image) {
      const src = $(sel).first().attr('src') || $(sel).first().attr('data-src');
      if (src) {
        image = src;
        break;
      }
    }
  }

  let price = parsePrice(firstText($, PRODUCT.salePrice));
  if (!price) price = parsePrice(offers?.price ?? offers?.lowPrice ?? meta('product:price:amount'));

  let originalPrice = parsePrice(firstText($, PRODUCT.originalPrice));
  if (originalPrice && price && originalPrice <= price) originalPrice = null;

  const shownRate = parseRate(firstText($, PRODUCT.discountRate));
  let discountRate = computeRate(price, originalPrice);
  // Coupang sometimes shows a rate without a crossed-out price; use it only if we couldn't compute one.
  if (!discountRate && shownRate) discountRate = shownRate;

  const soldOut =
    PRODUCT.soldOut.some((sel) => $(sel).length > 0) ||
    /OutOfStock|SoldOut/i.test(String(offers?.availability || ''));
  const rocket = PRODUCT.rocket.some((sel) => $(sel).length > 0);

  const ids = parseProductIds(pageUrl) || {};

  return {
    ...ids,
    title,
    image: absUrl(image),
    price,
    originalPrice,
    discountRate: price ? discountRate : null,
    soldOut,
    rocket,
  };
}

export function isBlockedPage(status, html) {
  if (status === 403 || status === 429 || status >= 500) return true;
  if (!html || html.length < 2000) return true;
  return /Access Denied|Reference #\d|비정상적인 접근|captcha|보안 확인/i.test(html.slice(0, 20000));
}

// Scan a listing page (search results, goldbox, category) for products with a visible discount.
export function parseListPage(html, pageUrl = 'https://www.coupang.com/') {
  const $ = cheerio.load(html);
  const seen = new Map();
  $('a[href*="/vp/products/"]').each((_, a) => {
    const href = absUrl($(a).attr('href'), pageUrl);
    const ids = parseProductIds(href);
    if (!ids || seen.has(ids.productId)) return;
    let box = $(a);
    for (const sel of LIST.item) {
      const c = $(a).closest(sel);
      if (c.length) {
        box = c;
        break;
      }
    }
    const text = box.text().replace(/\s+/g, ' ');
    const img = box.find('img').first();
    const title = cleanTitle(
      box.find('.name, [class*="name"], [class*="title"]').first().text() || img.attr('alt') || '',
    );
    const prices = [...text.matchAll(/(\d{1,3}(?:,\d{3})+)\s*원/g)].map((m) => parsePrice(m[1]));
    const price = prices.length ? Math.min(...prices) : null;
    const originalPrice = prices.length > 1 ? Math.max(...prices) : null;
    const discountRate = computeRate(price, originalPrice) || parseRate(text) || 0;
    seen.set(ids.productId, {
      ...ids,
      productUrl: canonicalProductUrl(ids),
      title,
      image: absUrl(img.attr('src') || img.attr('data-img-src') || img.attr('data-src'), pageUrl),
      price,
      originalPrice,
      discountRate,
    });
  });
  return [...seen.values()];
}
