import { config, DISCLOSURE } from '../config.js';
import { nextRunAt, formatKst } from '../scheduler.js';
import { h, u } from './util.js';

const FONT =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

// With automatic checks the header counts down to the next one; without them it states
// when prices were last updated, so the page never promises a check that won't happen.
function statusPill(builtAt, siteUpdatedAt) {
  if (config.monitorMode === 'on') {
    return `<div class="next-check" title="하루 ${config.checkTimes.length}번(${h(config.checkTimes.join(' · '))}) 가격을 다시 확인해요">
    <span class="dot" aria-hidden="true"></span>
    <span class="label-long">다음 가격 확인</span> <b class="next-time">${formatKst(nextRunAt(config.checkTimes, builtAt))}</b>
    <span class="countdown" data-times="${h(config.checkTimes.join(','))}"></span>
  </div>`;
  }
  if (!siteUpdatedAt) return '';
  return `<div class="next-check" title="가격은 상품마다 확인한 시각이 함께 표시돼요">
    <span class="dot" aria-hidden="true"></span>
    <span class="label-long">가격</span> 업데이트 <b>${formatKst(siteUpdatedAt, { withDate: true })}</b>
  </div>`;
}

export const scheduleNote = () =>
  config.monitorMode === 'on'
    ? `매일 ${config.checkTimes.join(' · ')} (한국 시간) 가격을 다시 확인합니다.`
    : '가격은 수시로 다시 확인해 업데이트하며, 상품마다 확인한 시각을 표시합니다.';

export function layout({ title, description = '', image = '', path = '/', body, noindex = false, builtAt = new Date(), siteUpdatedAt = null }) {
  const fullTitle = title ? `${title} | ${config.siteName}` : `${config.siteName} — 쿠팡 ${config.minDiscount}% 이상 할인만 모았어요`;
  const desc = description || `쿠팡에서 ${config.minDiscount}% 이상 할인 중인 상품만 모았습니다. 상품마다 가격 확인 시각을 함께 보여드려요.`;
  const url = config.siteUrl ? `${config.siteUrl}${path}` : '';
  const ogImage = image && image.startsWith('/') && config.siteUrl ? `${config.siteUrl}${image}` : image;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${h(fullTitle)}</title>
<meta name="description" content="${h(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="#14151A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${h(config.siteName)}">
<meta property="og:title" content="${h(fullTitle)}">
<meta property="og:description" content="${h(desc)}">
${ogImage ? `<meta property="og:image" content="${h(ogImage)}">` : ''}
${url ? `<meta property="og:url" content="${h(url)}"><link rel="canonical" href="${h(url)}">` : ''}
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="${u('/static/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="${FONT}">
<link rel="stylesheet" href="${u('/static/style.css')}">
</head>
<body data-built="${builtAt.toISOString()}" data-stale-hours="${config.staleHours}">
<div class="disclosure" role="note">${h(DISCLOSURE)}</div>
<header class="topbar">
  <a class="logo" href="${u('/')}"><span class="bolt" aria-hidden="true">⚡</span>${h(config.siteName)}</a>
  ${statusPill(builtAt, siteUpdatedAt)}
</header>
<div class="stale-note" hidden>가격 정보가 한동안 갱신되지 않았어요. 쿠팡에서 현재 가격을 꼭 확인하세요.</div>
${body}
<footer class="footer">
  <p class="footer-disclosure">${h(DISCLOSURE)}</p>
  <p>표시된 가격과 할인율은 확인 시각 기준이며, 쿠팡의 실제 판매가·쿠폰·옵션에 따라 다를 수 있습니다. 구매 전 쿠팡에서 최종 가격을 꼭 확인하세요.</p>
  <p>${h(scheduleNote())}</p>
  <p class="copy">© ${builtAt.getFullYear()} ${h(config.siteName)}</p>
</footer>
<script src="${u('/static/app.js')}" defer></script>
</body>
</html>`;
}
