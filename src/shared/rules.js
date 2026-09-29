// How a price observation changes a deal, and when a deal is shown on the site.
// Shared by the site builder (Node) and the web dashboard (browser).

export const HISTORY_LIMIT = 60;

export const emptyDb = () => ({ deals: [], candidates: [], runs: [], meta: {} });

function randomId() {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newDeal(fields = {}, now = new Date()) {
  const iso = now.toISOString();
  return {
    id: randomId(),
    productUrl: '',
    partnerUrl: '',
    productId: '',
    itemId: '',
    vendorItemId: '',
    title: '',
    image: '',
    category: '기타',
    memo: '',
    rocket: false,
    price: null,
    originalPrice: null,
    discountRate: null,
    prevPrice: null,
    priceChangedAt: null,
    status: 'pending',
    lastCheckedAt: null,
    lastOkAt: null,
    lastError: '',
    failCount: 0,
    history: [],
    hidden: false,
    createdAt: iso,
    updatedAt: iso,
    ...fields,
  };
}

// Apply one price observation to a deal. Returns true when the price or discount changed.
export function applyResult(deal, result, now = new Date(), minDiscount = 15) {
  const iso = now.toISOString();
  deal.lastCheckedAt = iso;
  deal.updatedAt = iso;
  if (!result.ok) {
    deal.failCount = (deal.failCount || 0) + 1;
    deal.lastError = result.error || '알 수 없는 오류';
    if (!deal.lastOkAt) deal.status = 'error';
    return false;
  }
  const d = result.data;
  let changed = false;
  if (d.price != null && deal.price != null && d.price !== deal.price) {
    deal.prevPrice = deal.price;
    deal.priceChangedAt = iso;
    changed = true;
  }
  if (d.discountRate != null && d.discountRate !== deal.discountRate) changed = true;

  if (!deal.titleLocked && d.title) deal.title = d.title;
  if (!deal.imageLocked && d.image) deal.image = d.image;
  for (const k of ['productId', 'itemId', 'vendorItemId']) if (!deal[k] && d[k]) deal[k] = d[k];
  if (d.price != null) {
    deal.price = d.price;
    deal.originalPrice = d.originalPrice ?? null;
    deal.discountRate = d.discountRate ?? 0;
  }
  deal.rocket = Boolean(d.rocket);
  deal.status = d.soldOut ? 'soldout' : (deal.discountRate ?? 0) >= minDiscount ? 'active' : 'below';
  deal.lastOkAt = iso;
  deal.failCount = 0;
  deal.lastError = '';

  deal.history ??= [];
  deal.history.push({ t: iso, p: deal.price, o: deal.originalPrice, r: deal.discountRate, s: d.soldOut ? 1 : 0 });
  if (deal.history.length > HISTORY_LIMIT) deal.history.splice(0, deal.history.length - HISTORY_LIMIT);
  return changed;
}

// A visitor sees a deal only with an affiliate link, a real discount, and a recent price.
export function isPublic(deal, now = Date.now(), { minDiscount = 15, staleHours = 48 } = {}) {
  if (deal.hidden || !deal.partnerUrl || deal.discountRate == null) return false;
  if (deal.discountRate < minDiscount) return false;
  if (deal.status !== 'active' || !deal.lastOkAt) return false;
  return now - Date.parse(deal.lastOkAt) <= staleHours * 3600_000;
}

// The same product can be captured with a different option (itemId); fall back to the product id.
export function findDeal(deals, productId, itemId) {
  const exact = deals.find((d) => d.productId === productId && (d.itemId || '') === (itemId || ''));
  if (exact) return exact;
  const same = deals.filter((d) => d.productId === productId);
  return same.length === 1 ? same[0] : null;
}
