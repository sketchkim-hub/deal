import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader: existing environment variables win.
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnv(path.join(ROOT, '.env'));

// Site settings committed to the repository (edited on github.com); env / .env still win.
function loadSiteConfig(file) {
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(data)) {
    if (/^[A-Z0-9_]+$/.test(key) && process.env[key] === undefined) {
      process.env[key] = Array.isArray(value) ? value.join(',') : String(value);
    }
  }
}
loadSiteConfig(path.join(ROOT, 'site.config.json'));

const env = (key, fallback = '') => process.env[key] ?? fallback;
const num = (key, fallback) => {
  const n = Number(env(key, ''));
  return Number.isFinite(n) && env(key, '') !== '' ? n : fallback;
};
const bool = (key, fallback) => {
  const v = env(key, '').toLowerCase();
  if (!v) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v);
};
const list = (key, fallback = []) => {
  const v = env(key, '');
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
};

export const config = {
  siteName: env('SITE_NAME', '오늘의특가'),
  siteUrl: env('SITE_URL', '').replace(/\/$/, ''),
  port: num('PORT', 3000),
  host: env('HOST', '127.0.0.1'),
  adminPassword: env('ADMIN_PASSWORD', ''),

  minDiscount: num('MIN_DISCOUNT', 15),
  // Hide a deal when its price hasn't been refreshed for this long.
  staleHours: num('STALE_HOURS', 48),
  // The dashboard lists deals older than this under "갱신 필요".
  refreshHours: num('REFRESH_HOURS', 20),

  // off (default): prices come in through the "특가 담기" bookmarklet.
  // on: also fetch product pages automatically at CHECK_TIMES (Coupang may block this).
  monitorMode: env('MONITOR_MODE', 'off'),
  checkTimes: list('CHECK_TIMES', ['09:00', '15:00', '21:00']),
  fetchMode: env('FETCH_MODE', 'auto'),
  requireKrIp: bool('REQUIRE_KR_IP', true),
  delayMinMs: num('DELAY_MIN_MS', 3000),
  delayMaxMs: num('DELAY_MAX_MS', 8000),
  browserPath: env('BROWSER_PATH', ''),

  // Static site publishing: github | firebase | none
  publishTarget: env('PUBLISH_TARGET', 'none'),
  // Sub-path when served from https://<user>.github.io/<repo>/ without a custom domain, e.g. /teukga
  basePath: env('BASE_PATH', '').replace(/\/$/, ''),
  github: {
    remote: env('GITHUB_REPO_URL'),
    branch: env('GITHUB_BRANCH', 'gh-pages'),
    token: env('GITHUB_TOKEN'),
  },
  firebase: {
    project: env('FIREBASE_PROJECT'),
  },
  distDir: path.resolve(ROOT, env('DIST_DIR', 'dist')),

  discoverUrls: list('DISCOVER_URLS'),

  coupang: {
    accessKey: env('COUPANG_ACCESS_KEY'),
    secretKey: env('COUPANG_SECRET_KEY'),
    subId: env('COUPANG_SUB_ID'),
  },

  // content/db.json is committed: the web dashboard edits it through the GitHub API.
  dataDir: path.resolve(ROOT, env('DATA_DIR', 'content')),
};

export const DISCLOSURE =
  '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';

export const CATEGORIES = [
  '식품',
  '생활용품',
  '주방',
  '가전디지털',
  '뷰티',
  '패션',
  '유아동',
  '반려동물',
  '스포츠',
  '기타',
];
