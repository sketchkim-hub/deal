import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the store at a throwaway directory before any app module loads config.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teukga-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.SITE_URL = 'https://example.com';
process.env.PUBLISH_TARGET = 'github';
process.env.BASE_PATH = '';

const store = await import('../src/store.js');
const { buildSite } = await import('../src/build.js');
const { prevRunAt } = await import('../src/scheduler.js');

test('builds a static site with live and ended deals', () => {
  const now = Date.now();
  const iso = new Date(now - 3600_000).toISOString();
  const base = { partnerUrl: 'https://link.coupang.com/a/abc', lastOkAt: iso, originalPrice: 20000, category: '식품' };
  const live = store.addDeal({ ...base, title: '라이브 <특가>', price: 10000, discountRate: 50, status: 'active' });
  const ended = store.addDeal({ ...base, title: '끝난 특가', price: 19000, discountRate: 5, status: 'below' });
  store.addDeal({ ...base, title: '숨김', price: 10000, discountRate: 50, status: 'active', hidden: true });

  const out = path.join(tmp, 'dist');
  const r = buildSite({ outDir: out, now });
  assert.equal(r.deals, 1);
  assert.equal(r.pages, 2);

  const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(index, /라이브 &lt;특가&gt;/);
  assert.doesNotMatch(index, /끝난 특가/);
  assert.match(index, /href="https:\/\/link\.coupang\.com\/a\/abc"[^>]*rel="sponsored nofollow noopener"/);
  assert.match(index, /쿠팡 파트너스 활동의 일환으로/);

  const endedPage = fs.readFileSync(path.join(out, 'd', ended.id, 'index.html'), 'utf8');
  assert.match(endedPage, /노출되지 않아요/);
  assert.match(endedPage, /noindex/);
  assert.ok(fs.existsSync(path.join(out, 'd', live.id, 'index.html')));

  assert.equal(fs.readFileSync(path.join(out, 'CNAME'), 'utf8').trim(), 'example.com');
  assert.ok(fs.existsSync(path.join(out, 'static', 'style.css')));
  assert.ok(!fs.existsSync(path.join(out, 'static', 'admin.css')));
  const json = JSON.parse(fs.readFileSync(path.join(out, 'deals.json'), 'utf8'));
  assert.equal(json.deals.length, 1);
});

test('prevRunAt finds the slot a sleeping PC missed', () => {
  const times = ['09:00', '15:00', '21:00'];
  // 16:30 KST → last slot was 15:00 KST (06:00 UTC)
  assert.equal(prevRunAt(times, new Date('2026-09-28T07:30:00Z')).toISOString(), '2026-09-28T06:00:00.000Z');
  // 08:00 KST → last slot was 21:00 KST the day before
  assert.equal(prevRunAt(times, new Date('2026-09-27T23:00:00Z')).toISOString(), '2026-09-27T12:00:00.000Z');
});
