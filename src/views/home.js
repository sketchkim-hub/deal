import { config, CATEGORIES } from '../config.js';
import { formatKst } from '../scheduler.js';
import { layout } from './layout.js';
import { h, u, won, dropOf, savingOf } from './util.js';

export const dealPath = (deal) => u(`/d/${deal.id}/`);

// The buy button goes straight to the Coupang Partners link (the site is static, so no redirect hop).
export const buyLink = (deal, label, cls = 'cta') =>
  `<a class="${cls}" href="${h(deal.partnerUrl)}" target="_blank" rel="sponsored nofollow noopener">${label}</a>`;

const img = (deal, cls = '') =>
  deal.image
    ? `<img class="${cls}" src="${h(u(deal.image))}" alt="${h(deal.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<div class="${cls} noimg" aria-hidden="true">🛒</div>`;

export function card(deal, now = Date.now()) {
  const drop = dropOf(deal, now);
  const saving = savingOf(deal);
  return `<article class="card" data-cat="${h(deal.category)}" data-rate="${deal.discountRate}" data-price="${deal.price}" data-save="${saving}" data-new="${Date.parse(deal.createdAt) || 0}" data-drop="${drop}">
  <a class="card-link" href="${dealPath(deal)}" aria-label="${h(deal.title)} 자세히">
    <div class="thumb">
      ${img(deal)}
      <span class="rate-badge">${deal.discountRate}<small>%</small></span>
      ${drop ? `<span class="drop-badge">▼ 방금 인하</span>` : ''}
      ${deal.rocket ? `<span class="rocket">로켓</span>` : ''}
    </div>
    <h3 class="title">${h(deal.title || '상품 정보 확인 중')}</h3>
  </a>
  <div class="prices">
    ${deal.originalPrice ? `<s class="orig">${won(deal.originalPrice)}</s>` : ''}
    <div class="now"><em>${deal.discountRate}%</em><strong>${won(deal.price)}</strong></div>
    <div class="meta">
      ${drop ? `<span class="dropped">${won(drop)} 내림</span>` : saving ? `<span class="save">${won(saving)} 절약</span>` : ''}
      <span class="checked">${formatKst(deal.lastOkAt)} 확인</span>
    </div>
  </div>
  ${buyLink(deal, '쿠팡에서 보기 <span aria-hidden="true">→</span>')}
</article>`;
}

function dropRail(deals, now) {
  const drops = deals
    .map((d) => [d, dropOf(d, now)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  if (!drops.length) return '';
  return `<section class="rail-wrap" aria-labelledby="rail-h">
  <h2 id="rail-h" class="section-h"><span class="flash">▼</span> 방금 가격 내려갔어요</h2>
  <div class="rail">
    ${drops
      .map(
        ([d, v]) => `<a class="rail-item" href="${dealPath(d)}">
      <div class="thumb">${img(d)}<span class="rate-badge sm">${d.discountRate}<small>%</small></span></div>
      <div class="rail-title">${h(d.title)}</div>
      <div class="rail-price"><strong>${won(d.price)}</strong><span class="dropped">▼${won(v)}</span></div>
    </a>`,
      )
      .join('')}
  </div>
</section>`;
}

export function homePage({ deals, lastCheckedAt, now = Date.now() }) {
  const sorted = [...deals].sort((a, b) => b.discountRate - a.discountRate || (a.price ?? 0) - (b.price ?? 0));
  const rates = sorted.map((d) => d.discountRate);
  const max = rates.length ? Math.max(...rates) : 0;
  const avg = rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 0;
  const cats = CATEGORIES.filter((c) => sorted.some((d) => d.category === c));

  const hero = `<section class="hero">
  <p class="eyebrow">오늘의 쿠팡 특가</p>
  <h1>${config.minDiscount}% 이상 할인만<br>골라 모았어요</h1>
  <dl class="stats">
    <div><dt>특가</dt><dd>${sorted.length}<small>개</small></dd></div>
    <div><dt>최대 할인</dt><dd class="hot">${max}<small>%</small></dd></div>
    <div><dt>평균 할인</dt><dd>${avg}<small>%</small></dd></div>
  </dl>
  ${lastCheckedAt ? `<p class="hero-note">마지막 가격 확인 ${formatKst(lastCheckedAt, { withDate: true })} · 매일 ${h(config.checkTimes.join(' · '))} 갱신</p>` : ''}
</section>`;

  const filters = `<nav class="filters" aria-label="상품 필터">
  <div class="chips" role="group" aria-label="카테고리">
    <button class="chip on" data-cat="">전체</button>
    ${cats.map((c) => `<button class="chip" data-cat="${h(c)}">${h(c)}</button>`).join('')}
  </div>
  <div class="filter-row">
    <div class="chips" role="group" aria-label="할인율">
      <button class="chip rate on" data-min="${config.minDiscount}">${config.minDiscount}%+</button>
      <button class="chip rate" data-min="30">30%+</button>
      <button class="chip rate" data-min="50">50%+</button>
    </div>
    <label class="sort"><span class="sr-only">정렬</span>
      <select id="sort">
        <option value="rate">할인율 높은 순</option>
        <option value="drop">방금 내린 순</option>
        <option value="save">많이 절약하는 순</option>
        <option value="low">낮은 가격 순</option>
        <option value="new">새로 올라온 순</option>
      </select>
    </label>
  </div>
</nav>`;

  const grid = sorted.length
    ? `<section class="grid" id="grid" aria-live="polite">${sorted.map((d) => card(d, now)).join('')}</section>
<p class="empty" id="empty" hidden>조건에 맞는 특가가 없어요. 필터를 바꿔 보세요.</p>`
    : `<section class="empty-state"><div class="big">⏳</div><h2>특가를 준비하고 있어요</h2><p>매일 ${h(config.checkTimes.join(' · '))}에 새 가격을 확인합니다.</p></section>`;

  return layout({
    path: '/',
    image: sorted[0]?.image,
    builtAt: new Date(now),
    body: `<main>${hero}${sorted.length ? filters : ''}${dropRail(sorted, now)}${grid}</main>`,
  });
}
