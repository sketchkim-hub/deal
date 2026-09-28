import { config, CATEGORIES } from '../config.js';
import { formatKst, nextRunAt } from '../scheduler.js';
import { h, won, timeAgo } from './util.js';

const STATUS = {
  active: ['노출 중', 'ok'],
  below: ['할인 부족', 'warn'],
  soldout: ['품절', 'warn'],
  error: ['확인 실패', 'bad'],
  pending: ['확인 대기', 'idle'],
};

const catOptions = (selected) =>
  CATEGORIES.map((c) => `<option ${c === selected ? 'selected' : ''}>${h(c)}</option>`).join('');

function runRow(r) {
  const geo = r.geo ? `${h(r.geo.country)} ${h(r.geo.ip || '')}` : '-';
  return `<tr>
    <td>${formatKst(r.startedAt, { withDate: true })}</td>
    <td>${h(r.reason)}</td>
    <td>${geo}</td>
    <td>${r.error ? `<span class="pill bad">${h(r.error)}</span>` : `${r.ok}/${r.checked} 성공 · 변동 ${r.changed}${r.via ? ` · ${h(r.via)}` : ''}`}${r.discovered ? ` · 후보 +${r.discovered}` : ''}${r.apiError ? ` · API 오류: ${h(r.apiError)}` : ''}</td>
  </tr>`;
}

function dealRow(d, isPublic) {
  const [label, tone] = STATUS[d.status] || [d.status, 'idle'];
  return `<tr class="${d.hidden ? 'dim' : ''}">
    <td class="t-thumb">${d.image ? `<img src="${h(d.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</td>
    <td class="t-title">
      <a href="/d/${d.id}/" target="_blank">${h(d.title || d.productUrl || d.partnerUrl)}</a>
      <div class="sub">${h(d.category)}${d.memo ? ` · ${h(d.memo)}` : ''}</div>
      ${d.lastError ? `<div class="sub err">${h(d.lastError)}</div>` : ''}
      ${!d.partnerUrl ? '<div class="sub err">파트너스 링크 없음 — 노출되지 않습니다</div>' : ''}
    </td>
    <td><span class="pill ${tone}">${label}</span>${isPublic ? ' <span class="pill ok">공개</span>' : ''}${d.hidden ? ' <span class="pill idle">숨김</span>' : ''}</td>
    <td class="num">${won(d.price)}<div class="sub">${d.originalPrice ? `<s>${won(d.originalPrice)}</s>` : ''}</div></td>
    <td class="num"><b>${d.discountRate ?? '-'}%</b></td>
    <td>${d.lastCheckedAt ? timeAgo(d.lastCheckedAt) : '-'}</td>
    <td class="actions">
      <form method="post" action="/admin/deals/${d.id}/check"><button>확인</button></form>
      <form method="post" action="/admin/deals/${d.id}/toggle"><button>${d.hidden ? '표시' : '숨김'}</button></form>
      <details><summary>편집</summary>
        <form method="post" action="/admin/deals/${d.id}" class="edit">
          <label>파트너스 링크<input name="partnerUrl" value="${h(d.partnerUrl)}"></label>
          <label>상품 URL<input name="productUrl" value="${h(d.productUrl)}"></label>
          <label>제목(비우면 자동)<input name="title" value="${d.titleLocked ? h(d.title) : ''}" placeholder="${h(d.title)}"></label>
          <label>카테고리<select name="category">${catOptions(d.category)}</select></label>
          <label>메모<input name="memo" value="${h(d.memo)}"></label>
          <button>저장</button>
        </form>
        <form method="post" action="/admin/deals/${d.id}/delete" data-confirm="삭제할까요?"><button class="danger">삭제</button></form>
      </details>
    </td>
  </tr>`;
}

function candidateRow(c) {
  return `<tr>
    <td class="t-thumb">${c.image ? `<img src="${h(c.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</td>
    <td class="t-title"><a href="${h(c.productUrl)}" target="_blank" rel="noopener">${h(c.title || c.productUrl)}</a>
      <div class="sub">${h(c.source)} · ${timeAgo(c.seenAt)}</div></td>
    <td class="num">${won(c.price)}</td>
    <td class="num"><b>${c.discountRate ?? '-'}%</b></td>
    <td class="actions">
      <form method="post" action="/admin/candidates/${c.id}/promote" class="promote">
        ${c.partnerUrl ? `<input type="hidden" name="partnerUrl" value="${h(c.partnerUrl)}">` : `<input name="partnerUrl" placeholder="파트너스 단축링크 붙여넣기" required>`}
        <select name="category">${catOptions('기타')}</select>
        <button>게시</button>
      </form>
      <form method="post" action="/admin/candidates/${c.id}/delete"><button class="ghost">빼기</button></form>
    </td>
  </tr>`;
}

const TARGET = { github: 'GitHub Pages', firebase: 'Firebase Hosting', none: '게시 안 함 (미리보기만)' };

function publishLine(lastPublish) {
  const target = `<b>${h(TARGET[config.publishTarget] || config.publishTarget)}</b>`;
  if (!lastPublish) return `${target} · 아직 게시 전`;
  return `${target} · ${formatKst(lastPublish.at, { withDate: true })} ${
    lastPublish.ok ? `<span class="pill ok">성공</span> 특가 ${lastPublish.deals}개` : `<span class="pill bad">실패: ${h(lastPublish.error)}</span>`
  }`;
}

export function adminPage({ deals, candidates, runs, isPublic, geo, geoError, running, msg, apiOn, lastPublish }) {
  const next = nextRunAt(config.checkTimes);
  const publicCount = deals.filter(isPublic).length;
  const geoLine = geo
    ? `<span class="pill ${geo.country === 'KR' ? 'ok' : 'bad'}">${h(geo.country)}</span> ${h(geo.ip)} <span class="sub">${h(geo.org || '')}</span>`
    : `<span class="pill bad">확인 실패</span> ${h(geoError || '')}`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>관리자 | ${h(config.siteName)}</title>
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/static/admin.css"></head>
<body>
<header class="a-top"><a href="/" target="_blank">⚡ ${h(config.siteName)}</a><span>관리자</span></header>
<main class="a-main">
${msg ? `<div class="flash">${h(msg)}</div>` : ''}

<section class="panel status">
  <div><span class="k">공개 중</span><b>${publicCount}</b> / ${deals.length}개</div>
  <div><span class="k">가격 확인</span>${config.monitorMode === 'on' ? `다음 <b>${formatKst(next, { withDate: true })}</b> (${h(config.checkTimes.join(', '))})` : '<b>정기 확인 꺼짐</b>'}${running ? ' <span class="pill warn">실행 중…</span>' : ''}</div>
  <div><span class="k">이 PC의 IP</span>${geoLine}</div>
  <div><span class="k">사이트 게시</span>${publishLine(lastPublish)}${config.siteUrl ? ` · <a href="${h(config.siteUrl)}" target="_blank" rel="noopener">사이트 열기</a>` : ''}</div>
  <div><span class="k">파트너스 API</span>${apiOn ? '<span class="pill ok">사용</span>' : '<span class="pill idle">미설정 (승인 후 .env에 키 입력)</span>'}</div>
  <div class="btns">
    <form method="post" action="/admin/run"><button class="primary" ${running ? 'disabled' : ''}>지금 전체 확인</button></form>
    <form method="post" action="/admin/publish"><button>지금 게시</button></form>
    <a class="preview" href="/" target="_blank">미리보기</a>
  </div>
</section>

<section class="panel">
  <h2>상품 등록</h2>
  <p class="help">쿠팡 파트너스 → <a href="https://partners.coupang.com/" target="_blank" rel="noopener">링크 생성</a>에서 상품 링크를 만든 뒤 <b>단축링크(link.coupang.com/a/…)</b>를 붙여넣으세요. 상품 정보·썸네일·가격은 자동으로 채워집니다. 할인율이 ${config.minDiscount}% 미만이면 등록은 되지만 노출되지 않습니다.</p>
  <form method="post" action="/admin/deals" class="add">
    <input name="partnerUrl" placeholder="https://link.coupang.com/a/xxxxxx" required>
    <input name="productUrl" placeholder="상품 URL (선택: 단축링크로 못 찾을 때)">
    <select name="category">${catOptions('기타')}</select>
    <input name="memo" placeholder="메모 (선택)">
    <button class="primary">등록하고 가격 확인</button>
  </form>
  <details class="bulk"><summary>여러 개 한 번에 등록</summary>
    <form method="post" action="/admin/deals/bulk">
      <p class="help">한 줄에 하나씩: <code>단축링크 [카테고리]</code> 또는 <code>단축링크 상품URL [카테고리]</code></p>
      <textarea name="lines" rows="6" placeholder="https://link.coupang.com/a/abc123 식품&#10;https://link.coupang.com/a/def456 https://www.coupang.com/vp/products/123 주방"></textarea>
      <button class="primary">일괄 등록</button>
    </form>
  </details>
</section>

<section class="panel">
  <h2>상품 (${deals.length})</h2>
  <div class="table-wrap"><table>
    <thead><tr><th></th><th>상품</th><th>상태</th><th>가격</th><th>할인</th><th>확인</th><th></th></tr></thead>
    <tbody>${deals.map((d) => dealRow(d, isPublic(d))).join('') || '<tr><td colspan="7" class="sub">아직 등록된 상품이 없어요.</td></tr>'}</tbody>
  </table></div>
</section>

<section class="panel">
  <h2>후보 (${candidates.length})</h2>
  <p class="help">${config.discoverUrls.length || apiOn ? `${config.minDiscount}% 이상 할인 중인 상품 후보입니다. 파트너스 링크를 붙여 게시하세요.` : '후보 자동 탐색이 꺼져 있습니다. API 승인 후 골드박스 특가가 자동으로 들어오거나, .env의 DISCOVER_URLS로 켤 수 있습니다.'}</p>
  ${candidates.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>상품</th><th>가격</th><th>할인</th><th></th></tr></thead><tbody>${candidates.map(candidateRow).join('')}</tbody></table></div>` : ''}
</section>

<section class="panel">
  <h2>실행 기록</h2>
  <div class="table-wrap"><table><thead><tr><th>시각</th><th>방식</th><th>IP 국가</th><th>결과</th></tr></thead>
  <tbody>${runs.map(runRow).join('') || '<tr><td colspan="4" class="sub">아직 실행 기록이 없어요.</td></tr>'}</tbody></table></div>
</section>
</main>
<script src="/static/admin.js" defer></script>
</body></html>`;
}
