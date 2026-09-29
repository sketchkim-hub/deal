// Runs on the home PC: admin dashboard, "특가 담기" capture, site preview, and publishing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, ROOT, CATEGORIES } from './config.js';
import * as store from './store.js';
import { runMonitor, runApiOnly, isRunning, applyResult } from './monitor.js';
import { startSchedule } from './scheduler.js';
import { lastCheckedAt, relatedDeals } from './build.js';
import { publish, schedulePublish } from './publish.js';
import { apiEnabled, createDeeplinks } from './coupang/api.js';
import { parseProductIds, isPartnerShortLink, resolvePartnerLink } from './coupang/url.js';
import { bookmarkletHref, parseCapture, parseFormData } from './capture.js';
import { homePage } from './views/home.js';
import { dealPage } from './views/deal.js';
import { adminPage } from './views/admin.js';
import { captureNewPage, captureUpdatePage, captureErrorPage, captureDonePage } from './views/capture.js';

const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };

store.load();

// ── helpers ───────────────────────────────────────────────────────────

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}
const redirect = (res, to, status = 303) => send(res, status, '', { Location: to });

async function readBody(req, limit = 2_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const isLoopback = (host) => ['127.0.0.1', 'localhost', '::1'].includes(host);

// The admin page listens on this PC only by default, so a password is optional there.
function adminAuthorized(req) {
  if (!config.adminPassword) return isLoopback(config.host);
  const m = (req.headers.authorization || '').match(/^Basic (.+)$/);
  if (!m) return false;
  const [user, ...rest] = Buffer.from(m[1], 'base64').toString().split(':');
  return user === 'admin' && safeEqual(rest.join(':'), config.adminPassword);
}

// Reject form posts coming from other sites.
function sameOrigin(req) {
  const src = req.headers.origin || req.headers.referer;
  if (!src) return true;
  try {
    return new URL(src).host === req.headers.host;
  } catch {
    return false;
  }
}

// The same product can be captured with a different option (itemId); fall back to the product id.
function findExisting(productId, itemId) {
  const exact = store.findDealByProduct(productId, itemId);
  if (exact) return exact;
  const same = store.deals().filter((d) => d.productId === productId);
  return same.length === 1 ? same[0] : null;
}

// ── automatic checks (only with MONITOR_MODE=on) ──────────────────────

async function checkAndPublish(opts) {
  const run = await runMonitor(opts);
  if (!run.error) await publish();
  return run;
}

// ── "특가 담기" ───────────────────────────────────────────────────────

async function saveCapture(body) {
  const productIds = parseProductIds(body.productUrl || '');
  const existing = body.dealId ? store.getDeal(body.dealId) : null;
  if (body.dealId && !existing) throw new Error('상품을 찾지 못했습니다. 관리자 화면을 새로 고쳐 주세요.');

  const data = parseFormData(body);
  if (data.price == null && !data.soldOut) throw new Error('판매가를 입력해 주세요.');

  if (existing) {
    if (existing.titleLocked) delete data.title;
    applyResult(existing, { ok: true, data });
    store.save();
    schedulePublish();
    return { deal: existing, message: '가격을 업데이트했어요' };
  }

  if (!productIds) throw new Error('쿠팡 상품 주소를 읽지 못했습니다.');
  const dup = findExisting(productIds.productId, productIds.itemId);
  if (dup) throw new Error(`이미 담긴 상품입니다: ${dup.title}`);

  let partnerUrl = String(body.partnerUrl || '').trim();
  if (partnerUrl && !isPartnerShortLink(partnerUrl)) throw new Error('파트너스 단축링크는 https://link.coupang.com/a/… 형식이어야 합니다.');
  if (!partnerUrl) {
    if (!apiEnabled()) throw new Error('파트너스 단축링크를 붙여넣어 주세요.');
    const [link] = await createDeeplinks([body.productUrl]);
    partnerUrl = link?.shortenUrl || '';
  } else {
    // Catch the easy mistake of pasting the link of a different product.
    const target = await resolvePartnerLink(partnerUrl).catch(() => null);
    if (target && target.productId !== productIds.productId) {
      throw new Error('붙여넣은 단축링크가 이 상품의 링크가 아닙니다. 파트너스에서 이 상품의 링크를 다시 만들어 주세요.');
    }
  }

  const deal = store.addDeal({
    ...productIds,
    productUrl: body.productUrl,
    partnerUrl,
    category: CATEGORIES.includes(body.category) ? body.category : '기타',
  });
  applyResult(deal, { ok: true, data });
  store.save();
  schedulePublish();
  return { deal, message: '특가를 담았어요' };
}

// ── admin ─────────────────────────────────────────────────────────────

async function handleAdmin(req, res, url) {
  if (!adminAuthorized(req)) {
    if (!config.adminPassword) return send(res, 403, 'HOST 를 127.0.0.1 이 아닌 값으로 바꿨다면 .env 에 ADMIN_PASSWORD 를 꼭 설정하세요.');
    return send(res, 401, '로그인이 필요합니다.', { 'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"' });
  }
  if (req.method === 'POST' && !sameOrigin(req)) return send(res, 403, 'bad origin');

  const back = (msg) => redirect(res, `/admin${msg ? `?msg=${encodeURIComponent(msg)}` : ''}`);
  const changed = (msg) => {
    schedulePublish();
    return back(`${msg} 30초 뒤 사이트에 반영됩니다.`);
  };
  const p = url.pathname;
  const noStore = { 'Cache-Control': 'no-store' };

  if (req.method === 'GET' && p === '/admin') {
    return send(res, 200, adminPage({
      deals: store.deals(),
      candidates: store.candidates(),
      runs: store.load().runs,
      isPublic: (d) => store.isPublic(d),
      running: isRunning(),
      msg: url.searchParams.get('msg'),
      apiOn: apiEnabled(),
      lastPublish: store.meta().lastPublish,
      bookmarklet: bookmarkletHref(`http://${req.headers.host}`),
    }), noStore);
  }

  if (req.method === 'GET' && p === '/admin/capture') {
    const data = parseCapture(url.searchParams.get('d'));
    if (!data) return send(res, 200, captureErrorPage('쿠팡 상품 정보를 읽지 못했습니다.'), noStore);
    const existing = findExisting(data.productId, data.itemId);
    return send(res, 200, existing ? captureUpdatePage(existing, data) : captureNewPage(data), noStore);
  }

  if (req.method !== 'POST') return send(res, 404, 'not found');
  const body = await readBody(req);

  if (p === '/admin/capture') {
    try {
      const { deal, message } = await saveCapture(body);
      return send(res, 200, captureDonePage(message, deal), noStore);
    } catch (e) {
      return send(res, 200, captureErrorPage(e.message), noStore);
    }
  }
  if (p === '/admin/publish') {
    const r = await publish();
    return back(r.ok ? `게시했습니다 (특가 ${r.deals}개).` : `게시 실패: ${r.error}`);
  }
  if (p === '/admin/run' && config.monitorMode === 'on') {
    if (!isRunning()) checkAndPublish({ reason: 'admin' });
    return back('전체 확인을 시작했습니다. 끝나면 사이트에 자동으로 게시됩니다.');
  }

  let m;
  if ((m = p.match(/^\/admin\/deals\/([a-f0-9]+)(?:\/(toggle|delete))?$/))) {
    const deal = store.getDeal(m[1]);
    if (!deal) return back('상품을 찾지 못했습니다.');
    if (m[2] === 'toggle') {
      deal.hidden = !deal.hidden;
      store.save();
      return changed(deal.hidden ? '숨겼습니다.' : '다시 표시합니다.');
    }
    if (m[2] === 'delete') {
      store.removeDeal(deal.id);
      return changed('삭제했습니다.');
    }
    // edit
    const partnerUrl = String(body.partnerUrl || '').trim();
    if (partnerUrl && !isPartnerShortLink(partnerUrl)) return back('파트너스 단축링크 형식이 아닙니다.');
    deal.partnerUrl = partnerUrl;
    deal.title = body.title ? body.title.trim() : deal.title;
    deal.titleLocked = Boolean(body.title);
    if (body.image) deal.image = parseFormData({ image: body.image }).image || deal.image;
    if (CATEGORIES.includes(body.category)) deal.category = body.category;
    deal.memo = body.memo || '';
    deal.updatedAt = new Date().toISOString();
    // A typed-in price counts as a fresh price check.
    const typed = parseFormData({ price: body.price, originalPrice: body.originalPrice });
    if (typed.price != null && (typed.price !== deal.price || typed.originalPrice !== deal.originalPrice)) {
      applyResult(deal, { ok: true, data: { ...typed, title: '', image: '', soldOut: deal.status === 'soldout', rocket: deal.rocket } });
    }
    store.save();
    return changed('저장했습니다.');
  }
  if ((m = p.match(/^\/admin\/candidates\/([a-f0-9]+)\/delete$/))) {
    const list = store.candidates();
    const i = list.findIndex((c) => c.id === m[1]);
    if (i >= 0) list.splice(i, 1);
    store.save();
    return back('후보에서 뺐습니다.');
  }
  return send(res, 404, 'not found');
}

// ── site preview (the same pages that get published) ──────────────────

function serveStatic(res, rel) {
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return send(res, 404, 'not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  let p = url.pathname;
  if (config.basePath && p.startsWith(`${config.basePath}/`)) p = p.slice(config.basePath.length);

  if (p.startsWith('/admin')) return handleAdmin(req, res, url);
  if (p.startsWith('/static/')) return serveStatic(res, p.slice('/static/'.length));
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');

  const updatedAt = lastCheckedAt();
  if (p === '/') return send(res, 200, homePage({ deals: store.publicDeals(), lastCheckedAt: updatedAt }));
  const m = p.match(/^\/d\/([a-f0-9]+)\/?$/);
  if (m) {
    const deal = store.getDeal(m[1]);
    if (!deal || deal.hidden || !deal.partnerUrl) return send(res, 404, '<p>상품을 찾을 수 없어요. <a href="/">특가 목록으로</a></p>');
    return send(res, 200, dealPage({ deal, isLive: store.isPublic(deal), related: relatedDeals(deal, store.publicDeals()), siteUpdatedAt: updatedAt }));
  }
  if (p === '/favicon.ico') return serveStatic(res, 'favicon.svg');
  return send(res, 404, '<p>페이지를 찾을 수 없어요. <a href="/">특가 목록으로</a></p>');
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, e.status === 413 ? 'too large' : '오류가 발생했습니다.');
  });
});

server.listen(config.port, config.host, () => {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  console.log(`[server] 관리자 대시보드: http://${host}:${config.port}/admin  (이 창을 닫으면 '특가 담기'가 동작하지 않아요)`);
  console.log(`[server] 게시 대상: ${config.publishTarget} · 자동 가격 확인: ${config.monitorMode === 'on' ? config.checkTimes.join(', ') : '꺼짐 (특가 담기 버튼 사용)'}`);
  if (!isLoopback(config.host) && !config.adminPassword) console.warn('[server] ⚠ 외부에서 접속 가능한데 ADMIN_PASSWORD 가 없어 관리자 화면을 막았습니다.');
  if (config.monitorMode === 'on') {
    startSchedule(config.checkTimes, () => checkAndPublish({ reason: 'schedule' }), {
      lastRunAt: store.meta().lastRun?.startedAt,
    });
  } else if (apiEnabled()) {
    // Partner links for new deals and Goldbox candidates via the official API.
    startSchedule(config.checkTimes, () => runApiOnly().then(() => publish()), {
      lastRunAt: store.meta().lastApiRun?.startedAt,
    });
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.saveNow();
    process.exit(0);
  });
}
