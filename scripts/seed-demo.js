// Fills a separate demo database with SAMPLE products so the design can be previewed.
// It never touches the real data directory.
//
//   npm run demo
//   DATA_DIR=data-demo MONITOR_MODE=off PUBLISH_TARGET=none npm start
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';

const dir = path.join(ROOT, 'data-demo');
const imgDir = path.join(ROOT, 'public', 'demo');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(imgDir, { recursive: true });

const items = [
  ['생수 2L 24병 (샘플)', '식품', 21900, 13900, '💧', '#dbeafe'],
  ['무선 이어폰 노이즈캔슬링 (샘플)', '가전디지털', 159000, 69000, '🎧', '#ede9fe'],
  ['3겹 롤화장지 30롤 (샘플)', '생활용품', 32900, 22900, '🧻', '#fef3c7'],
  ['스테인리스 프라이팬 28cm (샘플)', '주방', 59000, 29500, '🍳', '#fee2e2'],
  ['수분 크림 100ml (샘플)', '뷰티', 38000, 24700, '🧴', '#fce7f3'],
  ['기능성 러닝화 (샘플)', '스포츠', 129000, 64500, '👟', '#dcfce7'],
  ['유아 물티슈 100매 10팩 (샘플)', '유아동', 25900, 17900, '👶', '#e0f2fe'],
  ['고양이 모래 7L 4개 (샘플)', '반려동물', 36000, 26900, '🐱', '#f5f5f4'],
  ['블루투스 스피커 (샘플)', '가전디지털', 89000, 44900, '🔊', '#e0e7ff'],
  ['견과류 선물세트 (샘플)', '식품', 45000, 27000, '🥜', '#ffedd5'],
  ['기모 맨투맨 (샘플)', '패션', 39900, 19900, '👕', '#f3e8ff'],
  ['전기포트 1.7L (샘플)', '주방', 42000, 33600, '🫖', '#ecfccb'],
];

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const deals = items.map(([title, category, orig, price, emoji, bg], i) => {
  const file = `item${i + 1}.svg`;
  fs.writeFileSync(
    path.join(imgDir, file),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><text x="200" y="235" font-size="170" text-anchor="middle">${emoji}</text><text x="200" y="370" font-size="22" text-anchor="middle" fill="#6b7280" font-family="sans-serif">SAMPLE</text></svg>`,
  );
  const dropped = i % 4 === 1;
  const prev = dropped ? price + Math.round(orig * 0.08 / 100) * 100 : null;
  const history = Array.from({ length: 9 }, (_, k) => {
    const wobble = [0.06, 0.02, 0.09, 0.04, 0.0, 0.07, 0.03, 0.05, 0][k];
    const p = Math.round((price * (1 + wobble)) / 100) * 100;
    return { t: iso((8 - k) * 8 * 3600_000), p: k === 8 ? price : k === 7 && prev ? prev : p, o: orig, r: 0 };
  });
  return {
    id: `de${String(i).padStart(4, '0')}`,
    productUrl: `https://www.coupang.com/vp/products/${1000 + i}`,
    partnerUrl: 'https://link.coupang.com/a/SAMPLE',
    productId: String(1000 + i),
    itemId: '',
    vendorItemId: '',
    title,
    image: `/static/demo/${file}`,
    category,
    memo: '데모',
    rocket: i % 3 !== 2,
    price,
    originalPrice: orig,
    discountRate: Math.floor(((orig - price) / orig) * 100),
    prevPrice: prev,
    priceChangedAt: dropped ? iso(2 * 3600_000) : null,
    status: 'active',
    lastCheckedAt: iso(2 * 3600_000),
    lastOkAt: iso(2 * 3600_000),
    lastError: '',
    failCount: 0,
    history,
    hidden: false,
    createdAt: iso(i * 3600_000),
    updatedAt: iso(0),
  };
});

fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ deals, candidates: [], runs: [], meta: {} }, null, 1));
console.log(`샘플 ${deals.length}개를 data-demo/ 에 만들었습니다.`);
console.log('미리보기: DATA_DIR=data-demo MONITOR_MODE=off PUBLISH_TARGET=none npm start  → http://127.0.0.1:3000');
