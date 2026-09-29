// Coupang URL helpers. No Node APIs here: the browser dashboard imports this file too.

export function isPartnerShortLink(url) {
  return /^https?:\/\/link\.coupang\.com\/(a|re)\//i.test(url || '');
}

export function isCoupangUrl(url) {
  return /^https?:\/\/([a-z0-9-]+\.)*coupang\.com\//i.test(url || '');
}

// Extract productId / itemId / vendorItemId from a product page URL or a partner redirect URL.
export function parseProductIds(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const q = u.searchParams;
  const m = u.pathname.match(/\/vp\/products\/(\d+)/) || u.pathname.match(/\/products\/(\d+)/);
  const productId = m?.[1] || (/^\d+$/.test(q.get('pageKey') || '') ? q.get('pageKey') : '');
  if (!productId) return null;
  return {
    productId,
    itemId: q.get('itemId') || '',
    vendorItemId: q.get('vendorItemId') || '',
  };
}

export function canonicalProductUrl({ productId, itemId, vendorItemId }) {
  const u = new URL(`https://www.coupang.com/vp/products/${productId}`);
  if (itemId) u.searchParams.set('itemId', itemId);
  if (vendorItemId) u.searchParams.set('vendorItemId', vendorItemId);
  return u.toString();
}
