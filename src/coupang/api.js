import crypto from 'node:crypto';
import { config } from '../config.js';

// Coupang Partners Open API client. Inactive until COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY are set.
const HOST = 'https://api-gateway.coupang.com';
const BASE = '/v2/providers/affiliate_open_api/apis/openapi/v1';

export const apiEnabled = () => Boolean(config.coupang.accessKey && config.coupang.secretKey);

function signedDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

export function authorization(method, path, query, { accessKey, secretKey }, date = new Date()) {
  const datetime = signedDate(date);
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${datetime}${method}${path}${query}`)
    .digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

async function call(method, path, { query = {}, body } = {}) {
  if (!apiEnabled()) throw new Error('쿠팡 파트너스 API 키가 설정되지 않았습니다.');
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
  const fullPath = `${BASE}${path}`;
  const res = await fetch(`${HOST}${fullPath}${qs ? `?${qs}` : ''}`, {
    method,
    headers: {
      Authorization: authorization(method, fullPath, qs, config.coupang),
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.rCode && json.rCode !== '0')) {
    throw new Error(`쿠팡 API 오류 ${res.status}: ${json.rMessage || json.message || ''}`);
  }
  return json.data;
}

// Up to 20 product URLs per call → [{ originalUrl, shortenUrl, landingUrl }]
export async function createDeeplinks(urls) {
  const out = [];
  for (let i = 0; i < urls.length; i += 20) {
    const data = await call('POST', '/deeplink', {
      body: { coupangUrls: urls.slice(i, i + 20), subId: config.coupang.subId || undefined },
    });
    out.push(...(data || []));
  }
  return out;
}

// Today's Goldbox deals; productUrl in the response is already an affiliate link.
export async function goldbox() {
  const data = await call('GET', '/products/goldbox', { query: { subId: config.coupang.subId } });
  return (data || []).map((p) => ({
    productId: String(p.productId || ''),
    title: p.productName,
    image: p.productImage,
    price: p.productPrice ?? null,
    originalPrice: null,
    discountRate: p.discountRate ?? null,
    rocket: Boolean(p.isRocket),
    partnerUrl: p.productUrl,
  }));
}
