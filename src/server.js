// Runs on the home PC: admin page, site preview, scheduled price checks, and publishing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, ROOT, CATEGORIES } from './config.js';
import * as store from './store.js';
import { runMonitor, isRunning } from './monitor.js';
import { startSchedule } from './scheduler.js';
import { lastCheckedAt, relatedDeals } from './build.js';
import { publish, schedulePublish } from './publish.js';
import { lookupGeo } from './geo.js';
import { apiEnabled, createDeeplinks } from './coupang/api.js';
import { parseProductIds, canonicalProductUrl, isPartnerShortLink, isCoupangUrl, resolvePartnerLink } from './coupang/url.js';
import { homePage } from './views/home.js';
import { dealPage } from './views/deal.js';
import { adminPage } from './views/admin.js';

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

// ── checks: every run is followed by publishing the site ──────────────

async function checkAndPublish(opts) {
  const run = await runMonitor(opts);
  if (!run.error) await publish();
  return run;
}

let queuedIds = null;
function requestCheck(ids = null, reason = 'admin') {
  if (isRunning()) {
    if (ids) queuedIds = [...new Set([...(queuedIds || []), ...ids])];
    return;
  }
  checkAndPublish({ ids, reason }).then(() => {
    if (queuedIds) {
      const next = queuedIds;
      queuedIds = null;
      requestCheck(next, reason);
    }
  });
}

async function createDeal({ partnerUrl = '', productUrl = '', category = '기타', memo = '', title = '' }) {
  partnerUrl = partnerUrl.trim();
  productUrl = productUrl.trim();
  if (partnerUrl && !isPartnerShortLink(partnerUrl)) {
    // Allow pasting the product URL into the first box by mistake.
    if (!productUrl && parseProductIds(partnerUrl)) [productUrl, partnerUrl] = [partnerUrl, ''];
    else throw new Error('파트너스 단축링크는 https://link.coupang.com/a/… 형식이어야 합니다.');
  }
  if (!partnerUrl && !apiEnabled()) throw new Error('파트너스 단축링크를 입력해 주세요. (API 승인 전에는 필수)');
  if (productUrl && !isCoupangUrl(productUrl)) throw new Error('상품 URL은 쿠팡 주소여야 합니다.');

  let ids = productUrl ? parseProductIds(productUrl) : null;
  if (!ids && partnerUrl) ids = await resolvePartnerLink(partnerUrl);
  if (!ids) throw new Error('상품 번호를 찾지 못했습니다. 상품 URL을 확인해 주세요.');

  const dup = store.findDealByProduct(ids.productId, ids.itemId);
  if (dup) throw new Error(`이미 등록된 상품입니다: ${dup.title || dup.productUrl}`);

  if (!partnerUrl) {
    const [link] = await createDeeplinks([canonicalProductUrl(ids)]);
    partnerUrl = link?.shortenUrl || '';
  }
  return store.addDeal({
    productId: ids.productId,
    itemId: ids.itemId,
    vendorItemId: ids.vendorItemId,
    productUrl: canonicalProductUrl(ids),
    partnerUrl,
    category: CATEGORIES.includes(category) ? category : '기타',
    memo,
    ...(title ? { title, titleLocked: true } : {}),
  });
}

// ── admin ─────────────────────────────────────────────────────────────

async function handleAdmin(req, res, url) {
  if (!adminAuthorized(req)) {
    if (!config.adminPassword) return send(res, 403, 'HOST 를 127.0.0.1 이 아닌 값으로 바꿨다면 .env 에 ADMIN_PASSWORD 를 꼭 설정하세요.');
    return send(res, 401, '로그인이 필요합니다.', { 'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"' });
  }
  if (req.method === 'POST' && !sameOrigin(req)) return send(res, 403, 'bad origin');

  const back = (msg) => redirect(res, `/admin${msg ? `?msg=${encodeURIComponent(msg)}` : ''}`);
  // Edits that change what visitors see get published shortly after.
  const changed = (msg) => {
    schedulePublish();
    return back(`${msg} 30초 뒤 사이트에 반영됩니다.`);
  };
  const p = url.pathname;

  if (req.method === 'GET' && p === '/admin') {
    let geo = null;
    let geoError = '';
    try {
      geo = await lookupGeo();
    } catch (e) {
      geoError = e.message;
    }
    return send(res, 200, adminPage({
      deals: store.deals(),
      candidates: store.candidates(),
      runs: store.load().runs,
      isPublic: (d) => store.isPublic(d),
      geo,
      geoError,
      running: isRunning(),
      msg: url.searchParams.get('msg'),
      apiOn: apiEnabled(),
      lastPublish: store.meta().lastPublish,
    }), { 'Cache-Control': 'no-store' });
  }
  if (req.method !== 'POST') return send(res, 404, 'not found');
  const body = await readBody(req);

  if (p === '/admin/run') {
    requestCheck(null, 'admin');
    return back('전체 확인을 시작했습니다. 끝나면 사이트에 자동으로 게시됩니다.');
  }
  if (p === '/admin/publish') {
    const r = await publish();
    return back(r.ok ? `게시했습니다 (특가 ${r.deals}개).` : `게시 실패: ${r.error}`);
  }
  if (p === '/admin/deals') {
    try {
      const deal = await createDeal(body);
      requestCheck([deal.id], 'add');
      return back('등록했습니다. 가격 확인이 끝나면 사이트에 자동으로 게시됩니다.');
    } catch (e) {
      return back(`등록 실패: ${e.message}`);
    }
  }
  if (p === '/admin/deals/bulk') {
    const lines = String(body.lines || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const ok = [];
    const fail = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const partnerUrl = parts.find(isPartnerShortLink) || '';
      const productUrl = parts.find((x) => isCoupangUrl(x) && !isPartnerShortLink(x)) || '';
      const category = parts.find((x) => CATEGORIES.includes(x)) || '기타';
      try {
        ok.push((await createDeal({ partnerUrl, productUrl, category })).id);
      } catch (e) {
        fail.push(`${parts[0]}: ${e.message}`);
      }
    }
    if (ok.length) requestCheck(ok, 'add');
    return back(`${ok.length}개 등록${fail.length ? `, ${fail.length}개 실패 — ${fail.join(' / ')}` : ''}`);
  }

  let m;
  if ((m = p.match(/^\/admin\/deals\/([a-f0-9]+)(?:\/(check|toggle|delete))?$/))) {
    const deal = store.getDeal(m[1]);
    if (!deal) return back('상품을 찾지 못했습니다.');
    if (m[2] === 'check') {
      requestCheck([deal.id], 'admin');
      return back('가격 확인을 시작했습니다.');
    }
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
    const ids = body.productUrl ? parseProductIds(body.productUrl) : null;
    if (ids) Object.assign(deal, ids, { productUrl: canonicalProductUrl(ids) });
    deal.title = body.title ? body.title.trim() : deal.title;
    deal.titleLocked = Boolean(body.title);
    if (CATEGORIES.includes(body.category)) deal.category = body.category;
    deal.memo = body.memo || '';
    deal.updatedAt = new Date().toISOString();
    store.save();
    return changed('저장했습니다.');
  }
  if ((m = p.match(/^\/admin\/candidates\/([a-f0-9]+)\/(promote|delete)$/))) {
    const list = store.candidates();
    const i = list.findIndex((c) => c.id === m[1]);
    if (i < 0) return back('후보를 찾지 못했습니다.');
    const c = list[i];
    if (m[2] === 'promote') {
      try {
        const deal = await createDeal({ partnerUrl: body.partnerUrl || c.partnerUrl, productUrl: c.productUrl, category: body.category });
        list.splice(i, 1);
        store.save();
        requestCheck([deal.id], 'add');
        return back('등록했습니다. 가격 확인이 끝나면 사이트에 자동으로 게시됩니다.');
      } catch (e) {
        return back(`등록 실패: ${e.message}`);
      }
    }
    list.splice(i, 1);
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

  if (p === '/') return send(res, 200, homePage({ deals: store.publicDeals(), lastCheckedAt: lastCheckedAt() }));
  const m = p.match(/^\/d\/([a-f0-9]+)\/?$/);
  if (m) {
    const deal = store.getDeal(m[1]);
    if (!deal || deal.hidden || !deal.partnerUrl) return send(res, 404, '<p>상품을 찾을 수 없어요. <a href="/">특가 목록으로</a></p>');
    return send(res, 200, dealPage({ deal, isLive: store.isPublic(deal), related: relatedDeals(deal, store.publicDeals()) }));
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
  console.log(`[server] 관리자: http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}/admin`);
  console.log(`[server] 게시 대상: ${config.publishTarget} · 정기 확인: ${config.monitorMode === 'on' ? config.checkTimes.join(', ') : '꺼짐'}`);
  if (!isLoopback(config.host) && !config.adminPassword) console.warn('[server] ⚠ 외부에서 접속 가능한데 ADMIN_PASSWORD 가 없어 관리자 화면을 막았습니다.');
  if (config.monitorMode === 'on') {
    startSchedule(config.checkTimes, () => checkAndPublish({ reason: 'schedule' }), {
      lastRunAt: store.meta().lastRun?.startedAt,
    });
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.saveNow();
    process.exit(0);
  });
}
