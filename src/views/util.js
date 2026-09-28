import { config } from '../config.js';

// Site-relative URL, respecting BASE_PATH (e.g. https://user.github.io/repo/ before a custom domain).
export const u = (p) => (p && p.startsWith('/') && !p.startsWith('//') ? `${config.basePath}${p}` : p);

export function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const won = (n) => (n == null ? '' : `${Number(n).toLocaleString('ko-KR')}원`);

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.round(hr / 24)}일 전`;
}

// Price dropped since the previous check, within the last day.
export function dropOf(deal, now = Date.now()) {
  if (!deal.prevPrice || deal.price == null || deal.price >= deal.prevPrice) return 0;
  if (!deal.priceChangedAt || now - Date.parse(deal.priceChangedAt) > 24 * 3600_000) return 0;
  return deal.prevPrice - deal.price;
}

export const savingOf = (deal) =>
  deal.originalPrice && deal.price ? Math.max(0, deal.originalPrice - deal.price) : 0;
