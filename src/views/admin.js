import { config, CATEGORIES } from '../config.js';
import { formatKst, nextRunAt } from '../scheduler.js';
import { h, won, timeAgo } from './util.js';

const STATUS = {
  active: ['할인 중', 'ok'],
  below: ['할인 부족', 'warn'],
  soldout: ['품절', 'warn'],
  error: ['확인 실패', 'bad'],
  pending: ['가격 없음', 'idle'],
};

const TARGET = { github: 'GitHub Pages', firebase: 'Firebase Hosting', none: '게시 안 함 (미리보기만)' };

const catOptions = (selected) =>
  CATEGORIES.map((c) => `<option ${c === selected ? 'selected' : ''}>${h(c)}</option>`).join('');

const ageHours = (iso, now) => (iso ? (now - Date.parse(iso)) / 3600_000 : Infinity);

// Which filter tab a deal belongs to on the dashboard.
function bucket(d, isPublic, now) {
  if (d.hidden) return 'hidden';
  if (isPublic && ageHours(d.lastOkAt, now) >= config.refreshHours) return 'refresh';
  if (isPublic) return 'live';
  return 'off';
}

function publishLine(lastPublish) {
  const target = `<b>${h(TARGET[config.publishTarget] || config.publishTarget)}</b>`;
  if (!lastPublish) return `${target} · 아직 게시 전`;
  return `${target} · ${formatKst(lastPublish.at, { withDate: true })} ${
    lastPublish.ok ? '<span class="pill ok">성공</span>' : `<span class="pill bad">실패: ${h(lastPublish.error)}</span>`
  }`;
}

function dealRow(d, isPublic, now) {
  const [label, tone] = STATUS[d.status] || [d.status, 'idle'];
  const age = ageHours(d.lastOkAt, now);
  const hideIn = config.staleHours - age;
  return `<tr data-bucket="${bucket(d, isPublic, now)}" class="${d.hidden ? 'dim' : ''}">
    <td class="t-thumb">${d.image ? `<img src="${h(d.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</td>
    <td class="t-title">
      <a href="/d/${d.id}/" target="_blank">${h(d.title || d.productUrl)}</a>
      <div class="sub">${h(d.category)}${d.memo ? ` · ${h(d.memo)}` : ''}</div>
      ${d.lastError ? `<div class="sub err">${h(d.lastError)}</div>` : ''}
      ${!d.partnerUrl ? '<div class="sub err">파트너스 링크 없음 — 노출되지 않습니다</div>' : ''}
    </td>
    <td><span class="pill ${tone}">${label}</span>${isPublic ? ' <span class="pill ok">노출</span>' : ''}${d.hidden ? ' <span class="pill idle">숨김</span>' : ''}</td>
    <td class="num">${won(d.price)}<div class="sub">${d.originalPrice ? `<s>${won(d.originalPrice)}</s>` : ''}</div></td>
    <td class="num"><b>${d.discountRate ?? '-'}%</b></td>
    <td>${d.lastOkAt ? timeAgo(d.lastOkAt, now) : '-'}${isPublic && hideIn < 12 ? `<div class="sub err">${Math.max(0, Math.round(hideIn))}시간 뒤 숨김</div>` : ''}</td>
    <td class="actions">
      <a class="btn" href="${h(d.productUrl)}" target="_blank" rel="noopener" title="쿠팡에서 열고 '특가 담기'를 누르면 가격이 갱신됩니다">쿠팡 열기</a>
      <form method="post" action="/admin/deals/${d.id}/toggle"><button>${d.hidden ? '표시' : '숨김'}</button></form>
      <details><summary>편집</summary>
        <form method="post" action="/admin/deals/${d.id}" class="edit">
          <label>상품명(비우면 담기 때마다 자동)<input name="title" value="${d.titleLocked ? h(d.title) : ''}" placeholder="${h(d.title)}"></label>
          <div class="row2">
            <label>판매가<input name="price" value="${d.price ?? ''}" inputmode="numeric"></label>
            <label>정가<input name="originalPrice" value="${d.originalPrice ?? ''}" inputmode="numeric"></label>
          </div>
          <label>파트너스 링크<input name="partnerUrl" value="${h(d.partnerUrl)}"></label>
          <label>이미지 주소<input name="image" value="${h(d.image)}"></label>
          <label>카테고리<select name="category">${catOptions(d.category)}</select></label>
          <label>메모<input name="memo" value="${h(d.memo)}"></label>
          <button>저장</button>
        </form>
        <form method="post" action="/admin/deals/${d.id}/delete" data-confirm="삭제할까요?"><button class="danger">삭제</button></form>
      </details>
    </td>
  </tr>`;
}

function refreshRow(d, now) {
  return `<li>
    ${d.image ? `<img src="${h(d.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}
    <div class="grow"><b>${h(d.title)}</b><div class="sub">${won(d.price)} · ${d.discountRate}% · ${timeAgo(d.lastOkAt, now)} 확인</div></div>
    <a class="btn primary" href="${h(d.productUrl)}" target="_blank" rel="noopener">쿠팡 열기</a>
  </li>`;
}

function candidateRow(c) {
  return `<tr>
    <td class="t-thumb">${c.image ? `<img src="${h(c.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</td>
    <td class="t-title"><a href="${h(c.productUrl)}" target="_blank" rel="noopener">${h(c.title || c.productUrl)}</a>
      <div class="sub">${h(c.source)} · ${timeAgo(c.seenAt)}</div></td>
    <td class="num">${won(c.price)}</td>
    <td class="num"><b>${c.discountRate ?? '-'}%</b></td>
    <td class="actions">
      <form method="post" action="/admin/candidates/${c.id}/delete"><button class="ghost">빼기</button></form>
    </td>
  </tr>`;
}

function runRow(r) {
  const geo = r.geo ? `${h(r.geo.country)} ${h(r.geo.ip || '')}` : '-';
  return `<tr>
    <td>${formatKst(r.startedAt, { withDate: true })}</td>
    <td>${h(r.reason)}</td>
    <td>${geo}</td>
    <td>${r.error ? `<span class="pill bad">${h(r.error)}</span>` : `${r.ok}/${r.checked} 성공 · 변동 ${r.changed}${r.via ? ` · ${h(r.via)}` : ''}`}</td>
  </tr>`;
}

export function adminPage({ deals, candidates, runs, isPublic, running, msg, apiOn, lastPublish, bookmarklet, now = Date.now() }) {
  const pub = new Map(deals.map((d) => [d.id, isPublic(d)]));
  const counts = { live: 0, refresh: 0, off: 0, hidden: 0 };
  for (const d of deals) counts[bucket(d, pub.get(d.id), now)]++;
  const needRefresh = deals
    .filter((d) => bucket(d, pub.get(d.id), now) === 'refresh')
    .sort((a, b) => Date.parse(a.lastOkAt) - Date.parse(b.lastOkAt));
  const auto = config.monitorMode === 'on';

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>관리자 | ${h(config.siteName)}</title>
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/static/admin.css"></head>
<body>
<header class="a-top">
  <a href="/admin">⚡ ${h(config.siteName)} <span>관리자</span></a>
  <nav>
    <a href="/" target="_blank">미리보기</a>
    ${config.siteUrl ? `<a href="${h(config.siteUrl)}" target="_blank" rel="noopener">사이트 열기 ↗</a>` : ''}
  </nav>
</header>
<main class="a-main">
${msg ? `<div class="flash">${h(msg)}</div>` : ''}

<section class="kpis">
  <button class="kpi" data-filter="live"><span>사이트 노출</span><b>${counts.live + counts.refresh}</b></button>
  <button class="kpi ${counts.refresh ? 'alert' : ''}" data-filter="refresh"><span>갱신 필요</span><b>${counts.refresh}</b><small>${config.refreshHours}시간 넘게 확인 안 함</small></button>
  <button class="kpi" data-filter="off"><span>노출 안 됨</span><b>${counts.off}</b><small>할인 부족·품절·오래됨</small></button>
  <button class="kpi" data-filter="all"><span>전체 상품</span><b>${deals.length}</b></button>
</section>

<section class="panel publish">
  <div><span class="k">사이트 게시</span>${publishLine(lastPublish)}</div>
  <form method="post" action="/admin/publish"><button class="primary">지금 게시</button></form>
  ${auto ? `<div><span class="k">자동 가격 확인</span>다음 ${formatKst(nextRunAt(config.checkTimes), { withDate: true })}${running ? ' <span class="pill warn">실행 중…</span>' : ''}</div>
  <form method="post" action="/admin/run"><button ${running ? 'disabled' : ''}>지금 전체 확인</button></form>` : ''}
</section>

<details class="panel install" ${deals.length ? '' : 'open'}>
  <summary><h2>⚡ '특가 담기' 버튼 설치 · 사용법</h2></summary>
  <ol class="steps">
    <li>크롬에서 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>를 눌러 <b>북마크바</b>를 켭니다.</li>
    <li>아래 빨간 버튼을 마우스로 끌어서 <b>북마크바에 놓습니다.</b> (클릭하지 말고 끌어다 놓기)
      <p><a class="bookmarklet" href="${h(bookmarklet)}" onclick="alert('클릭하지 말고, 북마크바로 끌어다 놓으세요.');return false;">⚡ 특가 담기</a></p></li>
    <li>쿠팡에서 할인 중인 <b>상품 상세 페이지</b>를 엽니다.</li>
    <li>북마크바의 <b>⚡ 특가 담기</b>를 누르면 작은 창이 뜹니다. 값을 확인하고 파트너스 단축링크를 붙여 저장하면 끝.</li>
    <li>이미 담은 상품에서 다시 누르면 <b>가격만 업데이트</b>됩니다. 아래 '갱신 필요' 목록의 <b>쿠팡 열기</b> → <b>특가 담기</b> 순서로 하루 한 번 정도 눌러 주세요.</li>
  </ol>
  <p class="help">이 관리자 화면(이 PC의 프로그램)이 켜져 있어야 버튼이 동작합니다. 가격은 ${config.staleHours}시간 동안 갱신되지 않으면 사이트에서 자동으로 숨겨집니다.</p>
</details>

${needRefresh.length ? `<section class="panel">
  <h2>🔄 갱신 필요 (${needRefresh.length})</h2>
  <p class="help">쿠팡 열기 → 열린 페이지에서 <b>⚡ 특가 담기</b> → 저장. 오래된 순서입니다.</p>
  <ul class="refresh-list">${needRefresh.slice(0, 30).map((d) => refreshRow(d, now)).join('')}</ul>
</section>` : ''}

<section class="panel">
  <div class="panel-head">
    <h2>상품 (${deals.length})</h2>
    <div class="tabs" role="tablist">
      <button class="tab on" data-filter="all">전체</button>
      <button class="tab" data-filter="live">노출</button>
      <button class="tab" data-filter="refresh">갱신 필요</button>
      <button class="tab" data-filter="off">노출 안 됨</button>
      <button class="tab" data-filter="hidden">숨김</button>
    </div>
  </div>
  <div class="table-wrap"><table id="deals">
    <thead><tr><th></th><th>상품</th><th>상태</th><th>가격</th><th>할인</th><th>확인</th><th></th></tr></thead>
    <tbody>${deals.map((d) => dealRow(d, pub.get(d.id), now)).join('') || '<tr><td colspan="7" class="sub">아직 담은 상품이 없어요. 위의 \'특가 담기\' 버튼을 설치해 첫 상품을 담아 보세요.</td></tr>'}</tbody>
  </table></div>
</section>

${candidates.length || apiOn ? `<section class="panel">
  <h2>후보 (${candidates.length})</h2>
  <p class="help">${config.minDiscount}% 이상 할인 중인 상품 후보입니다. 쿠팡에서 열어 '특가 담기'로 등록하세요.</p>
  ${candidates.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>상품</th><th>가격</th><th>할인</th><th></th></tr></thead><tbody>${candidates.map(candidateRow).join('')}</tbody></table></div>` : ''}
</section>` : ''}

${auto ? `<section class="panel">
  <h2>자동 확인 기록</h2>
  <div class="table-wrap"><table><thead><tr><th>시각</th><th>방식</th><th>IP 국가</th><th>결과</th></tr></thead>
  <tbody>${runs.map(runRow).join('') || '<tr><td colspan="4" class="sub">아직 기록이 없어요.</td></tr>'}</tbody></table></div>
</section>` : ''}
</main>
<script src="/static/admin.js" defer></script>
</body></html>`;
}
