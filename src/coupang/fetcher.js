import { config } from '../config.js';
import { isBlockedPage } from './parse.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.5',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

async function httpGet(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  return { status: res.status, html, finalUrl: res.url, via: 'http' };
}

// Real Chromium for when Coupang's bot protection rejects plain requests.
async function createBrowser() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error('Chromium 방식을 쓰려면 `npm i playwright && npx playwright install chromium` 을 실행하세요.');
  }
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: config.browserPath || undefined,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': HEADERS['Accept-Language'] },
  });
  return {
    async get(url) {
      const page = await context.newPage();
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Prices are sometimes filled in after the first paint.
        await page
          .waitForSelector('.total-price, .final-price-amount, .price-amount, .oos-label', { timeout: 8000 })
          .catch(() => {});
        return { status: res?.status() ?? 0, html: await page.content(), finalUrl: page.url(), via: 'browser' };
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}

// mode: 'http' | 'browser' | 'auto' (http first; once blocked, stay on the browser for the rest of the run)
export function createFetcher(mode = config.fetchMode) {
  let browser = null;
  let useBrowser = mode === 'browser';

  const viaBrowser = async (url) => {
    browser ??= await createBrowser();
    return browser.get(url);
  };

  return {
    async get(url) {
      if (useBrowser) return viaBrowser(url);
      const res = await httpGet(url);
      if (mode === 'auto' && isBlockedPage(res.status, res.html)) {
        useBrowser = true;
        return viaBrowser(url);
      }
      return res;
    },
    async close() {
      if (browser) await browser.close().catch(() => {});
    },
  };
}
