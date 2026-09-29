// Capture window opened by the "⚡ 특가 담기" bookmarklet on a Coupang product page.
import { $, h, won, formatKst, catOptions, loadConfig, connect } from './common.js';
import { applyResult, newDeal, findDeal, emptyDb } from './shared/rules.js';
import { parseCapture, parseFormData } from './shared/capture.js';
import { isPartnerShortLink } from './shared/ids.js';

const app = $('#app');
let cfg;

function showError(message) {
  app.innerHTML = `
<h1>⚠ 담지 못했어요</h1>
<p class="warn-box">${h(message)}</p>
<p class="help">쿠팡 <b>상품 상세 페이지</b>(주소에 /vp/products/ 가 들어간 화면)에서 버튼을 눌러 주세요.</p>
<button type="button" id="close">창 닫기</button>`;
  $('#close').onclick = () => window.close();
}

function rateNote(data) {
  if (data.price == null) return '<p class="warn-box">가격을 읽지 못했어요. 쿠팡 화면에 보이는 가격을 직접 입력해 주세요.</p>';
  if (data.soldOut) return '<p class="warn-box">품절로 표시된 상품이에요. 저장하면 사이트에는 노출되지 않아요.</p>';
  if ((data.discountRate ?? 0) < cfg.minDiscount) {
    return `<p class="warn-box">할인율 ${data.discountRate ?? 0}% — ${cfg.minDiscount}% 미만이라 저장해도 사이트에는 노출되지 않아요. 정가가 비어 있다면 직접 입력해 보세요.</p>`;
  }
  return `<p class="ok-box">할인율 <b>${data.discountRate}%</b> — 저장하면 사이트에 노출됩니다.</p>`;
}

function fields(data) {
  return `
  <div class="cap-preview">
    ${data.image ? `<img src="${h(data.image)}" alt="" referrerpolicy="no-referrer">` : '<div class="noimg">🛒</div>'}
    <div>
      <div class="cap-rate">${data.discountRate ?? 0}%</div>
      <div class="cap-price">${won(data.price) || '가격 없음'}</div>
      ${data.originalPrice ? `<s class="sub">${won(data.originalPrice)}</s>` : ''}
    </div>
  </div>
  ${rateNote(data)}
  <label>상품명<input name="title" value="${h(data.title)}" required></label>
  <div class="row3">
    <label>판매가<input name="price" value="${data.price ?? ''}" inputmode="numeric" required></label>
    <label>정가(취소선 가격)<input name="originalPrice" value="${data.originalPrice ?? ''}" inputmode="numeric"></label>
    <label>할인율 %<input name="rate" value="${data.originalPrice ? '' : data.discountRate || ''}" inputmode="numeric" placeholder="정가 없을 때만"></label>
  </div>
  <label>이미지 주소<input name="image" value="${h(data.image)}"></label>
  <div class="checks">
    <label class="check"><input type="checkbox" name="rocket" value="1" ${data.rocket ? 'checked' : ''}> 로켓배송</label>
    <label class="check"><input type="checkbox" name="soldOut" value="1" ${data.soldOut ? 'checked' : ''}> 품절</label>
  </div>`;
}

function showDone(message, deal) {
  const live = deal.status === 'active';
  app.innerHTML = `
<h1>✅ ${h(message)}</h1>
<p class="sub">${h(deal.title)}</p>
<p>${won(deal.price)} · ${deal.discountRate ?? 0}% · ${live ? '<span class="pill ok">사이트 노출</span>' : '<span class="pill warn">노출 안 됨</span>'}</p>
<p class="help">1~2분 뒤 사이트에 반영됩니다. 이 창은 잠시 후 자동으로 닫혀요.</p>
<p><button type="button" id="close">창 닫기</button> <a href="./" target="_blank">관리자 대시보드</a></p>`;
  $('#close').onclick = () => window.close();
  setTimeout(() => window.close(), 2500);
}

function bindSubmit(form, onSave) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button.primary', form);
    btn.disabled = true;
    btn.textContent = '저장 중…';
    try {
      await onSave(Object.fromEntries(new FormData(form)));
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '다시 저장';
      let box = $('.save-error', form);
      if (!box) {
        box = document.createElement('p');
        box.className = 'warn-box save-error';
        form.prepend(box);
      }
      box.textContent = err.message;
      box.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

function showNew(repo, data) {
  app.innerHTML = `
<h1>⚡ 새 특가 담기</h1>
<p class="sub">쿠팡 화면에서 읽어 온 값입니다. 틀린 곳이 있으면 고친 뒤 저장하세요.</p>
<form class="cap-form">
  ${fields(data)}
  <label><span>파트너스 단축링크 <b class="req">필수</b></span>
    <input name="partnerUrl" placeholder="https://link.coupang.com/a/xxxxxx" required autofocus>
  </label>
  <p class="help">쿠팡 파트너스 → 링크 생성에서 <b>이 상품</b>의 단축링크를 만들어 붙여넣으세요.
    <a href="https://partners.coupang.com/" target="_blank" rel="noopener">파트너스 열기 ↗</a></p>
  <label>카테고리<select name="category">${catOptions(cfg.categories, '기타')}</select></label>
  <button class="primary big">저장하고 사이트에 올리기</button>
</form>`;
  bindSubmit($('form', app), async (f) => {
    const partnerUrl = String(f.partnerUrl || '').trim();
    if (!isPartnerShortLink(partnerUrl)) throw new Error('파트너스 단축링크는 https://link.coupang.com/a/… 형식이어야 합니다.');
    const values = parseFormData(f);
    if (values.price == null && !values.soldOut) throw new Error('판매가를 입력해 주세요.');
    const { result } = await repo.update(
      (db) => {
        if (findDeal(db.deals, data.productId, data.itemId)) throw new Error('이미 담긴 상품입니다. 창을 닫고 버튼을 다시 누르면 가격 업데이트 창이 떠요.');
        const deal = newDeal({
          productId: data.productId,
          itemId: data.itemId,
          vendorItemId: data.vendorItemId,
          productUrl: data.productUrl,
          partnerUrl,
          category: cfg.categories.includes(f.category) ? f.category : '기타',
        });
        applyResult(deal, { ok: true, data: values }, new Date(), cfg.minDiscount);
        db.deals.unshift(deal);
        return deal;
      },
      `특가 담기: ${values.title}`,
      emptyDb,
    );
    showDone('특가를 담았어요', result);
  });
}

function showUpdate(repo, deal, data) {
  const diff = deal.price != null && data.price != null ? data.price - deal.price : 0;
  app.innerHTML = `
<h1>⚡ 가격 업데이트</h1>
<p class="sub">이미 담은 상품입니다. 지금 화면의 가격으로 갱신합니다.</p>
<div class="cap-compare">
  <div><span class="k">이전 (${formatKst(deal.lastOkAt, { withDate: true }) || '-'})</span><b>${won(deal.price) || '-'}</b> ${deal.discountRate ?? '-'}%</div>
  <div><span class="k">지금</span><b>${won(data.price) || '-'}</b> ${data.discountRate ?? '-'}%
    ${diff < 0 ? `<span class="pill ok">▼ ${won(-diff)} 내림</span>` : diff > 0 ? `<span class="pill warn">▲ ${won(diff)} 오름</span>` : '<span class="pill idle">변동 없음</span>'}</div>
</div>
<form class="cap-form">
  ${fields({ ...data, title: deal.titleLocked ? deal.title : data.title || deal.title })}
  <button class="primary big">업데이트 저장</button>
</form>`;
  bindSubmit($('form', app), async (f) => {
    const values = parseFormData(f);
    if (values.price == null && !values.soldOut) throw new Error('판매가를 입력해 주세요.');
    const { result } = await repo.update(
      (db) => {
        const d = db.deals.find((x) => x.id === deal.id);
        if (!d) throw new Error('상품이 삭제된 것 같아요. 대시보드를 확인해 주세요.');
        if (d.titleLocked) delete values.title;
        applyResult(d, { ok: true, data: values }, new Date(), cfg.minDiscount);
        return d;
      },
      `가격 업데이트: ${deal.title}`,
      emptyDb,
    );
    showDone('가격을 업데이트했어요', result);
  });
}

async function main() {
  cfg = await loadConfig();
  const data = parseCapture(new URLSearchParams(location.search).get('d'));
  if (!data) return showError('쿠팡 상품 정보를 읽지 못했습니다.');
  const repo = await connect(cfg, app, { compact: true });
  app.innerHTML = '<p class="help">불러오는 중…</p>';
  const { db } = await repo.readDb();
  const existing = findDeal(db?.deals || [], data.productId, data.itemId);
  if (existing) showUpdate(repo, existing, data);
  else showNew(repo, data);
}

main().catch((e) => showError(e.message));
