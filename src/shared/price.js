// Price and text helpers shared by the site builder and the browser dashboard.

export function parsePrice(text) {
  if (text == null) return null;
  const m = String(text).replace(/\s/g, '').match(/\d{1,3}(?:,\d{3})+|\d+/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return n > 0 && n < 1e9 ? n : null;
}

export function parseRate(text) {
  const m = String(text ?? '').match(/(\d{1,2})\s*%/);
  return m ? Number(m[1]) : null;
}

// Floor so the site never shows a bigger discount than the real one.
export function computeRate(price, originalPrice) {
  if (!price || !originalPrice || originalPrice <= price) return 0;
  return Math.floor(((originalPrice - price) * 100) / originalPrice);
}

export function cleanTitle(title) {
  return String(title || '')
    .replace(/\s*[|\-]\s*쿠팡!?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Only http(s) image URLs are kept, so nothing odd ends up in an <img src>.
export function absImage(src) {
  if (!src) return '';
  src = String(src).trim();
  if (src.startsWith('//')) return `https:${src}`;
  return /^https?:\/\//.test(src) ? src : '';
}
