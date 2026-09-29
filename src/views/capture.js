import { config, CATEGORIES } from '../config.js';
import { formatKst } from '../scheduler.js';
import { h, won } from './util.js';

const shell = (title, body) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${h(title)} | ${h(config.siteName)}</title>
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/static/admin.css"></head>
<body class="capture-body"><main class="capture">${body}</main><script src="/static/admin.js" defer></script></body></html>`;

const catOptions = (selected) =>
  CATEGORIES.map((c) => `<option ${c === selected ? 'selected' : ''}>${h(c)}</option>`).join('');

function rateNote(data) {
  if (data.price == null) return '<p class="warn-box">가격을 읽지 못했어요. 쿠팡 화면에 보이는 가격을 직접 입력해 주세요.</p>';
  if (data.soldOut) return '<p class="warn-box">품절로 표시된 상품이에요. 저장하면 사이트에는 노출되지 않아요.</p>';
  if ((data.discountRate ?? 0) < config.minDiscount) {
    return `<p class="warn-box">할인율 ${data.discountRate ?? 0}% — ${config.minDiscount}% 미만이라 저장해도 사이트에는 노출되지 않아요. 정가가 비어 있다면 직접 입력해 보세요.</p>`;
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

export function captureNewPage(data) {
  return shell('특가 담기', `
<h1>⚡ 새 특가 담기</h1>
<p class="sub">쿠팡 화면에서 읽어 온 값입니다. 틀린 곳이 있으면 고친 뒤 저장하세요.</p>
<form method="post" action="/admin/capture" class="cap-form">
  <input type="hidden" name="productUrl" value="${h(data.productUrl)}">
  ${fields(data)}
  <label><span>파트너스 단축링크 <b class="req">필수</b></span>
    <input name="partnerUrl" placeholder="https://link.coupang.com/a/xxxxxx" required autofocus>
  </label>
  <p class="help">쿠팡 파트너스 → 링크 생성에서 <b>이 상품</b>의 단축링크를 만들어 붙여넣으세요.
    <a href="https://partners.coupang.com/" target="_blank" rel="noopener">파트너스 열기 ↗</a></p>
  <label>카테고리<select name="category">${catOptions('기타')}</select></label>
  <button class="primary big">저장하고 사이트에 올리기</button>
</form>`);
}

export function captureUpdatePage(deal, data) {
  const diff = deal.price != null && data.price != null ? data.price - deal.price : 0;
  return shell('가격 업데이트', `
<h1>⚡ 가격 업데이트</h1>
<p class="sub">이미 등록된 상품입니다. 지금 화면의 가격으로 갱신합니다.</p>
<div class="cap-compare">
  <div><span class="k">이전 (${formatKst(deal.lastOkAt, { withDate: true }) || '-'})</span><b>${won(deal.price) || '-'}</b> ${deal.discountRate ?? '-'}%</div>
  <div><span class="k">지금</span><b>${won(data.price) || '-'}</b> ${data.discountRate ?? '-'}%
    ${diff < 0 ? `<span class="pill ok">▼ ${won(-diff)} 내림</span>` : diff > 0 ? `<span class="pill warn">▲ ${won(diff)} 오름</span>` : '<span class="pill idle">변동 없음</span>'}</div>
</div>
<form method="post" action="/admin/capture" class="cap-form">
  <input type="hidden" name="dealId" value="${h(deal.id)}">
  ${fields({ ...data, title: deal.titleLocked ? deal.title : data.title || deal.title })}
  <button class="primary big">업데이트 저장</button>
</form>`);
}

export function captureErrorPage(message) {
  return shell('특가 담기', `
<h1>⚠ 담지 못했어요</h1>
<p class="warn-box">${h(message)}</p>
<p class="help">쿠팡 <b>상품 상세 페이지</b>(주소에 /vp/products/ 가 들어간 화면)에서 버튼을 눌러 주세요.</p>
<button type="button" onclick="window.close()">창 닫기</button>`);
}

export function captureDonePage(message, deal) {
  return shell('저장 완료', `
<h1>✅ ${h(message)}</h1>
<p class="sub">${h(deal.title)}</p>
<p>${won(deal.price)} · ${deal.discountRate ?? 0}% · ${deal.status === 'active' ? '<span class="pill ok">사이트 노출</span>' : '<span class="pill warn">노출 안 됨</span>'}</p>
<p class="help">30초 뒤 사이트에 반영됩니다. 이 창은 잠시 후 자동으로 닫혀요.</p>
<p><button type="button" onclick="window.close()">창 닫기</button> <a href="/admin" target="_blank">관리자 대시보드</a></p>
<script>setTimeout(function(){window.close()},2500)</script>`);
}
