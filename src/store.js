import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

// A single JSON file is plenty for a few thousand deals and is trivial to back up.
const FILE = path.join(config.dataDir, 'db.json');
const EMPTY = { deals: [], candidates: [], runs: [], meta: {} };

let db = null;
let saveTimer = null;

export function load() {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  db = fs.existsSync(FILE)
    ? { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }
    : structuredClone(EMPTY);
  return db;
}

export function saveNow() {
  if (!db) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

// Updates arrive in bursts during a check run; coalesce writes.
export function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 1000);
}

export const newId = () => crypto.randomBytes(4).toString('hex');

export const deals = () => load().deals;
export const candidates = () => load().candidates;
export const meta = () => load().meta;

export function getDeal(id) {
  return deals().find((d) => d.id === id);
}

export function findDealByProduct(productId, itemId) {
  return deals().find(
    (d) => d.productId && d.productId === productId && (d.itemId || '') === (itemId || ''),
  );
}

export function addDeal(fields) {
  const now = new Date().toISOString();
  const deal = {
    id: newId(),
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
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
  deals().unshift(deal);
  save();
  return deal;
}

export function removeDeal(id) {
  const list = deals();
  const i = list.findIndex((d) => d.id === id);
  if (i >= 0) list.splice(i, 1);
  save();
}

export function addRun(run) {
  const runs = load().runs;
  runs.unshift(run);
  runs.length = Math.min(runs.length, 50);
  save();
}

// Deals a visitor may see: has an affiliate link, is currently on sale, and was verified recently.
export function isPublic(deal, now = Date.now()) {
  if (deal.hidden || !deal.partnerUrl || deal.discountRate == null) return false;
  if (deal.discountRate < config.minDiscount) return false;
  // A failed check keeps the last good status; staleness below hides it eventually.
  if (deal.status !== 'active' || !deal.lastOkAt) return false;
  return now - Date.parse(deal.lastOkAt) <= config.staleHours * 3600_000;
}

export function publicDeals(now = Date.now()) {
  return deals().filter((d) => isPublic(d, now));
}
