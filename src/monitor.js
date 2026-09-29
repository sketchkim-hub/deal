import { config } from './config.js';
import * as store from './store.js';
import { createFetcher } from './coupang/fetcher.js';
import { parseProductPage, parseListPage, isBlockedPage } from './coupang/parse.js';
import { apiEnabled, createDeeplinks, goldbox } from './coupang/api.js';
import { lookupGeo } from './geo.js';
import { applyResult as sharedApplyResult } from './shared/rules.js';

const CANDIDATE_LIMIT = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const politeDelay = () =>
  sleep(config.delayMinMs + Math.random() * Math.max(0, config.delayMaxMs - config.delayMinMs));

// ── Checking one page ───────────────────────────────────────────────────

export async function checkUrl(url, fetcher) {
  try {
    const res = await fetcher.get(url);
    if (isBlockedPage(res.status, res.html)) {
      return { ok: false, blocked: true, via: res.via, error: `차단 또는 오류 응답 (HTTP ${res.status}, ${res.via})` };
    }
    const data = parseProductPage(res.html, res.finalUrl || url);
    if (!data.price && !data.soldOut) {
      return { ok: false, via: res.via, error: '가격을 읽지 못했습니다 — 쿠팡 페이지 구조가 바뀌었을 수 있습니다 (selectors.js 확인)' };
    }
    return { ok: true, via: res.via, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Apply one check result to a deal (rules shared with the web dashboard).
export function applyResult(deal, result, now = new Date()) {
  return sharedApplyResult(deal, result, now, config.minDiscount);
}

export function mergeCandidates(found, source) {
  const list = store.candidates();
  const now = new Date().toISOString();
  let added = 0;
  for (const c of found) {
    if (!c.productId || (c.discountRate ?? 0) < config.minDiscount) continue;
    if (store.findDealByProduct(c.productId, c.itemId)) continue;
    const existing = list.find((x) => x.productId === c.productId);
    if (existing) Object.assign(existing, c, { seenAt: now });
    else {
      list.unshift({ id: store.newId(), ...c, source, foundAt: now, seenAt: now });
      added++;
    }
  }
  list.length = Math.min(list.length, CANDIDATE_LIMIT);
  store.save();
  return added;
}

export async function discover(urls, fetcher) {
  const found = [];
  for (const url of urls) {
    try {
      const res = await fetcher.get(url);
      if (!isBlockedPage(res.status, res.html)) found.push(...parseListPage(res.html, res.finalUrl || url));
    } catch (e) {
      console.error('[discover]', url, e.message);
    }
    await politeDelay();
  }
  return found;
}

// ── Geo guard ───────────────────────────────────────────────────────────

export async function korGuard() {
  let geo;
  try {
    geo = await lookupGeo();
  } catch (e) {
    if (config.requireKrIp) throw e;
    return { country: '?', ip: '', error: e.message };
  }
  if (config.requireKrIp && geo.country !== 'KR') {
    throw new Error(
      `현재 IP(${geo.ip}, ${geo.country})가 한국이 아닙니다. VPN을 끄고 한국 인터넷에 연결된 PC에서 실행하세요. (REQUIRE_KR_IP=false 로 끌 수 있지만 권장하지 않습니다)`,
    );
  }
  return geo;
}

// ── Runs ────────────────────────────────────────────────────────────────

let running = null;
export const isRunning = () => Boolean(running);

function recordRun(run) {
  store.addRun(run);
  store.meta().lastRun = run;
  store.saveNow();
}

// Called by the scheduler and the admin buttons (local mode).
export async function runMonitor({ reason = 'schedule', ids = null, log = console.log } = {}) {
  if (running) return running;
  running = (async () => {
    const run = { startedAt: new Date().toISOString(), reason, checked: 0, ok: 0, failed: 0, changed: 0 };
    try {
      run.geo = await korGuard();
    } catch (e) {
      run.error = e.message;
      run.finishedAt = new Date().toISOString();
      recordRun(run);
      log(`[monitor] 중단: ${e.message}`);
      return run;
    }

    const targets = store.deals().filter((d) => !d.hidden && d.productUrl && (!ids || ids.includes(d.id)));
    const fetcher = createFetcher();
    try {
      for (const [i, deal] of targets.entries()) {
        const result = await checkUrl(deal.productUrl, fetcher);
        run.checked++;
        result.ok ? run.ok++ : run.failed++;
        if (result.via) run.via = result.via;
        if (applyResult(deal, result)) run.changed++;
        store.save();
        log(`[monitor] ${i + 1}/${targets.length} ${result.ok ? `${deal.price}원 ${deal.discountRate}%` : `실패: ${result.error}`} — ${deal.title || deal.productUrl}`);
        if (i < targets.length - 1) await politeDelay();
      }
      if (!ids) await extras(fetcher, run, log);
    } finally {
      await fetcher.close();
    }
    run.finishedAt = new Date().toISOString();
    recordRun(run);
    log(`[monitor] 완료: ${run.ok}개 성공, ${run.failed}개 실패, ${run.changed}개 변동`);
    return run;
  })().finally(() => {
    running = null;
  });
  return running;
}

// Things that only happen on full scheduled runs.
async function apiExtras(run, log) {
  if (!apiEnabled()) return;
  try {
    await fillPartnerLinks();
    run.goldbox = mergeCandidates(await goldbox(), 'goldbox-api');
  } catch (e) {
    log(`[api] ${e.message}`);
    run.apiError = e.message;
  }
}

// The official API isn't blocked like page fetches are, so it can run even with MONITOR_MODE=off.
export async function runApiOnly({ log = console.log } = {}) {
  const run = { startedAt: new Date().toISOString(), reason: 'api' };
  await apiExtras(run, log);
  run.finishedAt = new Date().toISOString();
  store.meta().lastApiRun = run;
  store.saveNow();
  return run;
}

async function extras(fetcher, run, log) {
  await apiExtras(run, log);
  if (config.discoverUrls.length) {
    run.discovered = mergeCandidates(await discover(config.discoverUrls, fetcher), 'discover');
  }
}

// With API access: create affiliate links for deals that don't have one yet.
export async function fillPartnerLinks() {
  const missing = store.deals().filter((d) => !d.partnerUrl && d.productUrl);
  if (!missing.length) return 0;
  const links = await createDeeplinks(missing.map((d) => d.productUrl));
  for (const [i, link] of links.entries()) if (link?.shortenUrl && missing[i]) missing[i].partnerUrl = link.shortenUrl;
  store.save();
  return links.length;
}
