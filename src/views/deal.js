import { config, DISCLOSURE } from '../config.js';
import { formatKst } from '../scheduler.js';
import { layout } from './layout.js';
import { card, buyLink } from './home.js';
import { h, u, won, dropOf, savingOf } from './util.js';

function priceChart(history) {
  const pts = (history || []).filter((x) => x.p);
  if (pts.length < 2) return '<p class="chart-empty">가격 기록이 쌓이면 변동 그래프가 표시돼요.</p>';
  const W = 600;
  const H = 160;
  const pad = { l: 8, r: 8, t: 18, b: 22 };
  const ps = pts.map((x) => x.p);
  let lo = Math.min(...ps);
  let hi = Math.max(...ps);
  if (lo === hi) {
    lo *= 0.95;
    hi *= 1.05;
  }
  const x = (i) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (p) => pad.t + (1 - (p - lo) / (hi - lo)) * (H - pad.t - pad.b);
  // Step line: a price holds until the next check.
  let d = `M${x(0)},${y(ps[0])}`;
  for (let i = 1; i < pts.length; i++) d += ` H${x(i)} V${y(ps[i])}`;
  const last = pts.length - 1;
  // The SVG stretches to any width, so labels live in HTML where their size stays fixed.
  return `<figure class="chart-box">
  <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="최근 ${pts.length}회 가격 변동. 최저 ${won(Math.min(...ps))}, 최고 ${won(Math.max(...ps))}">
    <path d="${d} V${H - pad.b} H${x(0)} Z" class="area"/>
    <path d="${d}" class="line" vector-effect="non-scaling-stroke"/>
  </svg>
  <figcaption class="chart-axis">
    <span>${formatKst(pts[0].t, { withDate: true })}</span>
    <b>최저 ${won(Math.min(...ps))} · 최고 ${won(Math.max(...ps))}</b>
    <span>${formatKst(pts[last].t, { withDate: true })}</span>
  </figcaption>
</figure>`;
}

export function dealPage({ deal, isLive, related, now = Date.now() }) {
  const drop = dropOf(deal, now);
  const saving = savingOf(deal);
  const lowest = Math.min(...(deal.history || []).filter((x) => x.p).map((x) => x.p), deal.price ?? Infinity);

  const ended = `<div class="ended">
    <b>이 특가는 지금 노출되지 않아요.</b>
    <span>${deal.status === 'soldout' ? '품절되었어요.' : deal.status === 'below' ? `할인율이 ${config.minDiscount}% 아래로 내려갔어요.` : '최근 가격 확인이 되지 않았어요.'} 쿠팡에서 현재 가격을 확인하세요.</span>
  </div>`;

  const body = `<main class="detail">
  <a class="back" href="${u('/')}">← 특가 목록</a>
  ${isLive ? '' : ended}
  <div class="detail-grid">
    <div class="detail-thumb">
      ${deal.image ? `<img src="${h(u(deal.image))}" alt="${h(deal.title)}" referrerpolicy="no-referrer">` : '<div class="noimg">🛒</div>'}
      ${isLive ? `<span class="rate-badge lg">${deal.discountRate}<small>%</small></span>` : ''}
    </div>
    <div class="detail-info">
      <p class="cat">${h(deal.category)}${deal.rocket ? ' · <span class="rocket inline">로켓</span>' : ''}</p>
      <h1>${h(deal.title)}</h1>
      <div class="big-price">
        ${deal.originalPrice ? `<s class="orig">${won(deal.originalPrice)}</s>` : ''}
        <div class="now"><em>${deal.discountRate ?? 0}%</em><strong>${won(deal.price)}</strong></div>
      </div>
      <ul class="facts">
        ${saving ? `<li><span>절약</span><b>${won(saving)}</b></li>` : ''}
        ${drop ? `<li class="drop"><span>직전 확인 대비</span><b>▼ ${won(drop)} 내림</b></li>` : ''}
        ${Number.isFinite(lowest) ? `<li><span>기록상 최저가</span><b>${won(lowest)}${lowest === deal.price ? ' (지금)' : ''}</b></li>` : ''}
        <li><span>가격 확인</span><b>${formatKst(deal.lastOkAt, { withDate: true })}</b></li>
      </ul>
      ${buyLink(deal, '쿠팡에서 최종 가격 확인하기 →', 'cta big')}
      <button class="share" type="button" data-title="${h(`${deal.discountRate}% ${deal.title}`)}">공유하기</button>
      <p class="fine">${h(DISCLOSURE)}<br>가격·할인율은 확인 시각 기준이며 옵션·쿠폰에 따라 달라질 수 있어요.</p>
    </div>
  </div>
  <section class="history">
    <h2 class="section-h">가격 변동</h2>
    ${priceChart(deal.history)}
  </section>
  ${related.length ? `<section><h2 class="section-h">이런 특가도 있어요</h2><div class="grid">${related.map((d) => card(d, now)).join('')}</div></section>` : ''}
</main>`;

  return layout({
    title: `${deal.discountRate ?? 0}% ${deal.title}`,
    description: `${won(deal.price)}${deal.originalPrice ? ` (정가 ${won(deal.originalPrice)})` : ''} · ${formatKst(deal.lastOkAt, { withDate: true })} 확인`,
    image: deal.image,
    path: `/d/${deal.id}/`,
    noindex: !isLive,
    builtAt: new Date(now),
    body,
  });
}
