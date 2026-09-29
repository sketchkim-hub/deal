// Web admin dashboard: runs entirely in the browser, stores data in the GitHub repository.
import { $, h, won, timeAgo, formatKst, catOptions, loadConfig, connect, setToken, toast } from './common.js';
import { applyResult, isPublic, emptyDb } from './shared/rules.js';
import { parseFormData, bookmarkletHref } from './shared/capture.js';
import { isPartnerShortLink } from './shared/ids.js';

const app = $('#app');
let cfg;
let repo;
let db;

const STATUS = {
  active: ['할인 중', 'ok'],
  below: ['할인 부족', 'warn'],
  soldout: ['품절', 'warn'],
  error: ['확인 실패', 'bad'],
  pending: ['가격 없음', 'idle'],
};

const ageHours = (iso, now) => (iso ? (now - Date.parse(iso)) / 3600_000 : Infinity);
const pub = (d, now) => isPublic(d, now, cfg);

function bucket(d, now) {
  if (d.hidden) return 'hidden';
  const live = pub(d, now);
  if (live && ageHours(d.lastOkAt, now) >= cfg.refreshHours) return 'refresh';
  return live ? 'live' : 'off';
}

// ── rendering ─────────────────────────────────────────────────────────

function dealRow(d, now) {
  const [label, tone] = STATUS[d.status] || [d.status, 'idle'];
  const live = pub(d, now);
  const hideIn = cfg.staleHours - ageHours(d.lastOkAt, now);
  return `<tr data-bucket="${bucket(d, now)}" class="${d.hidden ? 'dim' : ''}">
    <td class="t-thumb">${d.image ? `<img src="${h(d.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</td>
    <td class="t-title">
      <a href="${h(cfg.siteUrl)}/d/${h(d.id)}/" target="_blank" rel="noopener">${h(d.title || d.productUrl)}</a>
      <div class="sub">${h(d.category)}${d.memo ? ` · ${h(d.memo)}` : ''}</div>
      ${!d.partnerUrl ? '<div class="sub err">파트너스 링크 없음 — 노출되지 않습니다</div>' : ''}
    </td>
    <td><span class="pill ${tone}">${label}</span>${live ? ' <span class="pill ok">노출</span>' : ''}${d.hidden ? ' <span class="pill idle">숨김</span>' : ''}</td>
    <td class="num">${won(d.price)}<div class="sub">${d.originalPrice ? `<s>${won(d.originalPrice)}</s>` : ''}</div></td>
    <td class="num"><b>${d.discountRate ?? '-'}%</b></td>
    <td>${d.lastOkAt ? timeAgo(d.lastOkAt, now) : '-'}${live && hideIn < 12 ? `<div class="sub err">${Math.max(0, Math.round(hideIn))}시간 뒤 숨김</div>` : ''}</td>
    <td class="actions" data-id="${h(d.id)}">
      <a class="btn" href="${h(d.productUrl)}" target="_blank" rel="noopener" title="쿠팡에서 열고 '특가 담기'를 누르면 가격이 갱신됩니다">쿠팡 열기</a>
      <button data-act="toggle">${d.hidden ? '표시' : '숨김'}</button>
      <details><summary>편집</summary>
        <form class="edit" data-act="edit">
          <label>상품명(비우면 담기 때마다 자동)<input name="title" value="${d.titleLocked ? h(d.title) : ''}" placeholder="${h(d.title)}"></label>
          <div class="row2">
            <label>판매가<input name="price" value="${d.price ?? ''}" inputmode="numeric"></label>
            <label>정가<input name="originalPrice" value="${d.originalPrice ?? ''}" inputmode="numeric"></label>
          </div>
          <label>파트너스 링크<input name="partnerUrl" value="${h(d.partnerUrl)}"></label>
          <label>이미지 주소<input name="image" value="${h(d.image)}"></label>
          <label>카테고리<select name="category">${catOptions(cfg.categories, d.category)}</select></label>
          <label>메모<input name="memo" value="${h(d.memo)}"></label>
          <button class="primary">저장</button>
        </form>
        <button class="danger" data-act="delete">삭제</button>
      </details>
    </td>
  </tr>`;
}

function publishHtml(run) {
  if (run === undefined) return '<span class="sub">확인 중…</span>';
  if (run === null) return '<span class="sub">아직 게시 기록이 없어요 (Settings → Pages 설정 확인)</span>';
  const when = formatKst(run.updated_at, { withDate: true });
  const link = `<a href="${h(run.html_url)}" target="_blank" rel="noopener">기록</a>`;
  if (run.status !== 'completed') return `<span class="pill warn">사이트에 반영 중…</span> ${when} · ${link}`;
  if (run.conclusion === 'success') return `<span class="pill ok">게시 완료</span> ${when} · ${link}`;
  return `<span class="pill bad">게시 실패</span> ${when} · ${link}`;
}

function render() {
  const now = Date.now();
  const deals = db.deals;
  const counts = { live: 0, refresh: 0, off: 0, hidden: 0 };
  for (const d of deals) counts[bucket(d, now)]++;
  const needRefresh = deals.filter((d) => bucket(d, now) === 'refresh').sort((a, b) => Date.parse(a.lastOkAt) - Date.parse(b.lastOkAt));
  const captureUrl = new URL('capture.html', location.href).href;

  app.innerHTML = `
<section class="kpis">
  <button class="kpi" data-filter="live"><span>사이트 노출</span><b>${counts.live + counts.refresh}</b></button>
  <button class="kpi ${counts.refresh ? 'alert' : ''}" data-filter="refresh"><span>갱신 필요</span><b>${counts.refresh}</b><small>${cfg.refreshHours}시간 넘게 확인 안 함</small></button>
  <button class="kpi" data-filter="off"><span>노출 안 됨</span><b>${counts.off}</b><small>할인 부족·품절·오래됨</small></button>
  <button class="kpi" data-filter="all"><span>전체 상품</span><b>${deals.length}</b></button>
</section>

<section class="panel publish">
  <div><span class="k">사이트 게시</span><span id="publish-status">${publishHtml(undefined)}</span></div>
  <span class="sub">저장하면 1~2분 뒤 사이트에 자동으로 반영됩니다.</span>
</section>

<details class="panel install" ${deals.length ? '' : 'open'}>
  <summary><h2>⚡ '특가 담기' 버튼 설치 · 사용법</h2></summary>
  <ol class="steps">
    <li>크롬에서 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>를 눌러 <b>북마크바</b>를 켭니다.</li>
    <li>아래 빨간 버튼을 마우스로 <b>꾹 누른 채 끌어서</b> 북마크바에 놓습니다.
      <p><a class="bookmarklet" href="${h(bookmarkletHref(captureUrl))}" onclick="alert('클릭하지 말고, 북마크바로 끌어다 놓으세요.');return false;">⚡ 특가 담기</a></p>
      <p class="sub">끌어다 놓기가 어려우면: 버튼에 마우스 오른쪽 클릭 → '링크 주소 복사' → 북마크바 빈 곳 오른쪽 클릭 → '페이지 추가' → 이름 <code>⚡ 특가 담기</code>, URL에 붙여넣기.</p></li>
    <li>쿠팡에서 할인 중인 <b>상품 상세 페이지</b>를 엽니다.</li>
    <li>북마크바의 <b>⚡ 특가 담기</b>를 누르면 작은 창이 뜹니다. 값을 확인하고 파트너스 단축링크를 붙여 저장하면 끝.</li>
    <li>이미 담은 상품에서 다시 누르면 <b>가격만 업데이트</b>됩니다. 아래 '갱신 필요' 목록을 하루 한 번 정도 처리해 주세요.</li>
  </ol>
  <p class="help">PC를 바꾸면: 이 대시보드 주소로 들어와 토큰으로 로그인하고, 버튼만 다시 끌어다 놓으면 됩니다. 가격은 ${cfg.staleHours}시간 동안 갱신되지 않으면 사이트에서 자동으로 숨겨집니다.</p>
</details>

${needRefresh.length ? `<section class="panel">
  <h2>🔄 갱신 필요 (${needRefresh.length})</h2>
  <p class="help">쿠팡 열기 → 열린 페이지에서 <b>⚡ 특가 담기</b> → 업데이트 저장. 오래된 순서입니다.</p>
  <ul class="refresh-list">${needRefresh.slice(0, 30).map((d) => `<li>
    ${d.image ? `<img src="${h(d.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}
    <div class="grow"><b>${h(d.title)}</b><div class="sub">${won(d.price)} · ${d.discountRate}% · ${timeAgo(d.lastOkAt, now)} 확인</div></div>
    <a class="btn primary" href="${h(d.productUrl)}" target="_blank" rel="noopener">쿠팡 열기</a>
  </li>`).join('')}</ul>
</section>` : ''}

<section class="panel">
  <div class="panel-head">
    <h2>상품 (${deals.length})</h2>
    <div class="tabs">
      <button class="tab on" data-filter="all">전체</button>
      <button class="tab" data-filter="live">노출</button>
      <button class="tab" data-filter="refresh">갱신 필요</button>
      <button class="tab" data-filter="off">노출 안 됨</button>
      <button class="tab" data-filter="hidden">숨김</button>
    </div>
  </div>
  <div class="table-wrap"><table id="deals">
    <thead><tr><th></th><th>상품</th><th>상태</th><th>가격</th><th>할인</th><th>확인</th><th></th></tr></thead>
    <tbody>${deals.map((d) => dealRow(d, now)).join('') || '<tr><td colspan="7" class="sub">아직 담은 상품이 없어요. 위의 \'특가 담기\' 버튼을 설치해 첫 상품을 담아 보세요.</td></tr>'}</tbody>
  </table></div>
</section>

${db.candidates?.length ? `<section class="panel">
  <h2>후보 (${db.candidates.length})</h2>
  <p class="help">${cfg.minDiscount}% 이상 할인 중인 상품 후보입니다. 쿠팡에서 열어 '특가 담기'로 등록하세요.</p>
  <ul class="refresh-list">${db.candidates.map((c) => `<li>
    ${c.image ? `<img src="${h(c.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}
    <div class="grow"><b>${h(c.title || c.productUrl)}</b><div class="sub">${won(c.price)} · ${c.discountRate ?? '-'}%</div></div>
    <a class="btn primary" href="${h(c.productUrl)}" target="_blank" rel="noopener">쿠팡 열기</a>
  </li>`).join('')}</ul>
</section>` : ''}`;

  bind();
  refreshPublishStatus();
}

// ── actions ───────────────────────────────────────────────────────────

let publishTimer;
async function refreshPublishStatus() {
  clearTimeout(publishTimer);
  const el = $('#publish-status');
  if (!el) return;
  let run;
  try {
    run = await repo.latestPublish();
  } catch {
    el.innerHTML = '<span class="sub">게시 상태를 볼 수 없어요 (토큰에 Actions: Read-only 권한을 추가하면 보입니다)</span>';
    return;
  }
  el.innerHTML = publishHtml(run);
  if (run && run.status !== 'completed') publishTimer = setTimeout(refreshPublishStatus, 15000);
}

async function save(mutate, message) {
  try {
    const out = await repo.update(mutate, message, emptyDb);
    db = out.db;
    render();
    toast(`${out.result || '저장했어요'} · 1~2분 뒤 사이트에 반영됩니다.`);
    setTimeout(refreshPublishStatus, 4000);
  } catch (e) {
    toast(`저장 실패: ${e.message}`, 'bad');
  }
}

function withDeal(id, fn) {
  return (data) => {
    const deal = data.deals.find((d) => d.id === id);
    if (!deal) throw new Error('상품을 찾지 못했습니다. 새로 고침해 주세요.');
    return fn(deal, data);
  };
}

function bind() {
  const rows = [...app.querySelectorAll('#deals tbody tr[data-bucket]')];
  const tabs = [...app.querySelectorAll('.tab')];
  app.querySelectorAll('[data-filter]').forEach((el) =>
    el.addEventListener('click', () => {
      const name = el.dataset.filter;
      for (const r of rows) {
        const b = r.dataset.bucket;
        r.hidden = !(name === 'all' || b === name || (name === 'live' && b === 'refresh'));
      }
      tabs.forEach((t) => t.classList.toggle('on', t.dataset.filter === name));
      if (el.classList.contains('kpi')) $('#deals').scrollIntoView({ behavior: 'smooth' });
    }),
  );

  app.querySelectorAll('.actions').forEach((cell) => {
    const id = cell.dataset.id;
    cell.querySelector('[data-act=toggle]').addEventListener('click', () =>
      save(withDeal(id, (d) => ((d.hidden = !d.hidden), d.hidden ? '숨겼어요' : '다시 표시해요')), '상품 숨김/표시'),
    );
    cell.querySelector('[data-act=delete]').addEventListener('click', () => {
      if (!confirm('삭제할까요?')) return;
      save((data) => {
        data.deals = data.deals.filter((d) => d.id !== id);
        return '삭제했어요';
      }, '상품 삭제');
    });
    cell.querySelector('form[data-act=edit]').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const partnerUrl = String(f.partnerUrl || '').trim();
      if (partnerUrl && !isPartnerShortLink(partnerUrl)) return toast('파트너스 단축링크는 https://link.coupang.com/a/… 형식이어야 합니다.', 'bad');
      save(
        withDeal(id, (d) => {
          d.partnerUrl = partnerUrl;
          d.title = f.title ? f.title.trim() : d.title;
          d.titleLocked = Boolean(f.title);
          const img = parseFormData({ image: f.image }).image;
          if (img) d.image = img;
          if (cfg.categories.includes(f.category)) d.category = f.category;
          d.memo = f.memo || '';
          d.updatedAt = new Date().toISOString();
          // A typed-in price counts as a fresh price check.
          const typed = parseFormData({ price: f.price, originalPrice: f.originalPrice });
          if (typed.price != null && (typed.price !== d.price || typed.originalPrice !== d.originalPrice)) {
            applyResult(d, { ok: true, data: { ...typed, title: '', image: '', soldOut: d.status === 'soldout', rocket: d.rocket } }, new Date(), cfg.minDiscount);
          }
          return '저장했어요';
        }),
        `상품 수정: ${f.title || ''}`.trim(),
      );
    });
  });
}

async function reload() {
  const out = await repo.readDb();
  db = out.db || emptyDb();
  render();
}

// ── start ─────────────────────────────────────────────────────────────

async function main() {
  cfg = await loadConfig();
  document.title = `관리자 | ${cfg.siteName}`;
  $('#site-name').textContent = cfg.siteName;
  $('#top-links').innerHTML = `<a href="${h(cfg.siteUrl)}/" target="_blank" rel="noopener">사이트 열기 ↗</a><a href="#" id="logout">로그아웃</a>`;
  $('#logout').addEventListener('click', (e) => {
    e.preventDefault();
    setToken('');
    location.reload();
  });
  repo = await connect(cfg, app);
  app.innerHTML = '<p class="help">불러오는 중…</p>';
  await reload();
  // Back from a capture window: show the new prices (unless an edit form is open).
  let last = Date.now();
  window.addEventListener('focus', () => {
    if (Date.now() - last < 5000 || app.querySelector('#deals details[open]')) return;
    last = Date.now();
    reload().catch(() => {});
  });
}

main().catch((e) => {
  app.innerHTML = `<p class="warn-box">대시보드를 열지 못했어요: ${h(e.message)}</p>`;
});
