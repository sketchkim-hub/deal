// Renders the public site into plain files (dist/) for GitHub Pages or Firebase Hosting.
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT, CATEGORIES } from './config.js';
import * as store from './store.js';
import { homePage } from './views/home.js';
import { dealPage } from './views/deal.js';
import { u } from './views/util.js';

export function lastCheckedAt() {
  const run = store.meta().lastRun;
  if (run && !run.error) return run.finishedAt;
  return store.deals().reduce((m, d) => (d.lastOkAt && d.lastOkAt > (m || '') ? d.lastOkAt : m), null);
}

export function relatedDeals(deal, pub) {
  return pub
    .filter((d) => d.id !== deal.id)
    .sort((a, b) => (b.category === deal.category) - (a.category === deal.category) || b.discountRate - a.discountRate)
    .slice(0, 8);
}

// Deal pages are kept for ended deals too, so links already shared on KakaoTalk etc. don't break.
export const pageDeals = () => store.deals().filter((d) => !d.hidden && d.partnerUrl && d.lastOkAt);

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// owner/name of the repository the web dashboard saves to.
function repoName() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const m = String(config.github.remote || '').match(/github\.com[/:]([^/]+\/[^/.]+)/);
  return m ? m[1] : '';
}

// The web dashboard is plain static files: admin/*, the shared rule modules, and a config file.
function copyAdmin(outDir) {
  const dir = path.join(outDir, 'admin');
  fs.cpSync(path.join(ROOT, 'admin'), dir, { recursive: true });
  fs.cpSync(path.join(ROOT, 'src', 'shared'), path.join(dir, 'shared'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'public', 'admin.css'), path.join(dir, 'admin.css'));
  fs.copyFileSync(path.join(ROOT, 'public', 'favicon.svg'), path.join(dir, 'favicon.svg'));
  write(
    path.join(dir, 'site-config.json'),
    JSON.stringify({
      repo: repoName(),
      branch: process.env.GITHUB_REF_NAME || 'main',
      dataPath: path.relative(ROOT, path.join(config.dataDir, 'db.json')).split(path.sep).join('/'),
      siteName: config.siteName,
      siteUrl: config.siteUrl || u(''),
      minDiscount: config.minDiscount,
      staleHours: config.staleHours,
      refreshHours: config.refreshHours,
      categories: CATEGORIES,
    }),
  );
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    // Sample images only belong in a demo build.
    if (e.isDirectory() && e.name === 'demo' && path.basename(config.dataDir) !== 'data-demo') continue;
    if (e.isDirectory()) copyDir(s, d);
    else if (!/^admin\./.test(e.name)) fs.copyFileSync(s, d);
  }
}

export function buildSite({ outDir = config.distDir, now = Date.now() } = {}) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const pub = store.publicDeals(now);
  write(path.join(outDir, 'index.html'), homePage({ deals: pub, lastCheckedAt: lastCheckedAt(), now }));

  const pages = pageDeals();
  for (const deal of pages) {
    const html = dealPage({ deal, isLive: store.isPublic(deal, now), related: relatedDeals(deal, pub), now, siteUpdatedAt: lastCheckedAt() });
    write(path.join(outDir, 'd', deal.id, 'index.html'), html);
  }

  copyDir(path.join(ROOT, 'public'), path.join(outDir, 'static'));
  copyAdmin(outDir);

  const deals = pub.map(({ id, title, image, category, price, originalPrice, discountRate, rocket, lastOkAt, prevPrice, partnerUrl }) => ({
    id, title, image, category, price, originalPrice, discountRate, rocket, lastOkAt, prevPrice, partnerUrl, page: u(`/d/${id}/`),
  }));
  write(path.join(outDir, 'deals.json'), JSON.stringify({ updatedAt: lastCheckedAt(), builtAt: new Date(now).toISOString(), deals }));

  const base = config.siteUrl;
  write(path.join(outDir, 'robots.txt'), `User-agent: *\nDisallow: ${u('/admin/')}\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
  if (base) {
    const urls = ['/', ...pub.map((d) => `/d/${d.id}/`)];
    write(
      path.join(outDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((x) => `<url><loc>${base}${x}</loc></url>`).join('')}</urlset>\n`,
    );
    // GitHub Pages custom domain
    const host = new URL(base).host;
    if (config.publishTarget === 'github' && !config.basePath) write(path.join(outDir, 'CNAME'), `${host}\n`);
  }
  write(
    path.join(outDir, '404.html'),
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>페이지를 찾을 수 없어요</title><link rel="stylesheet" href="${u('/static/style.css')}"></head><body><main class="empty-state"><div class="big">🔎</div><h2>페이지를 찾을 수 없어요</h2><p><a href="${u('/')}">오늘의 특가 보러 가기 →</a></p></main></body></html>`,
  );
  write(path.join(outDir, '.nojekyll'), '');

  return { outDir, deals: pub.length, pages: pages.length };
}
