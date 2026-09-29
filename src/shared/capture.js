// "특가 담기" bookmarklet: runs on a Coupang product page the admin has open in their own browser,
// reads what is shown on screen, and opens the admin capture form with it. Nothing is fetched
// automatically, so Coupang's bot protection never comes into play.
// No Node APIs here: the web dashboard imports this file too.
import { PRODUCT } from './selectors.js';
import { parsePrice, parseRate, computeRate, cleanTitle, absImage } from './price.js';
import { parseProductIds, canonicalProductUrl } from './ids.js';

// Source of the in-page script. Kept as plain ES5-ish code so it runs in any browser.
function bookmarkletSource(captureUrl) {
  const sel = JSON.stringify({
    title: PRODUCT.title,
    sale: PRODUCT.salePrice,
    orig: PRODUCT.originalPrice,
    rate: PRODUCT.discountRate,
    img: PRODUCT.image,
    sold: PRODUCT.soldOut,
    rocket: PRODUCT.rocket,
  });
  return `(function(){
var S=${sel};
if(!/coupang\\.com/.test(location.hostname)){alert('쿠팡 상품 페이지에서 눌러 주세요.');return;}
function q(s){try{return document.querySelector(s);}catch(e){return null;}}
function txt(list){for(var i=0;i<list.length;i++){var e=q(list[i]);if(e&&e.textContent.trim())return e.textContent.trim();}return '';}
function any(list){for(var i=0;i<list.length;i++){if(q(list[i]))return 1;}return 0;}
function meta(p){var e=q('meta[property="'+p+'"]')||q('meta[name="'+p+'"]');return e?e.getAttribute('content')||'':'';}
var ld=null;
var ss=document.querySelectorAll('script[type="application/ld+json"]');
for(var i=0;i<ss.length&&!ld;i++){try{var d=JSON.parse(ss[i].textContent);var ns=[d].concat(Array.isArray(d)?d:[],d['@graph']||[]);for(var j=0;j<ns.length;j++){if(ns[j]&&/Product/.test(String(ns[j]['@type']))){ld=ns[j];break;}}}catch(e){}}
var off=ld&&(Array.isArray(ld.offers)?ld.offers[0]:ld.offers);
var img=meta('og:image');
if(!img&&ld&&ld.image)img=Array.isArray(ld.image)?ld.image[0]:ld.image;
if(!img){for(var k=0;k<S.img.length;k++){var ie=q(S.img[k]);if(ie&&(ie.getAttribute('src')||ie.getAttribute('data-src'))){img=ie.getAttribute('src')||ie.getAttribute('data-src');break;}}}
var d={u:location.href,t:meta('og:title')||(ld&&ld.name)||txt(S.title),i:img||'',p:txt(S.sale)||(off&&String(off.price||off.lowPrice||''))||'',o:txt(S.orig),r:txt(S.rate),so:any(S.sold)||(off&&/OutOfStock|SoldOut/.test(String(off.availability)))?1:0,rk:any(S.rocket)};
var url=${JSON.stringify(captureUrl)}+'?d='+encodeURIComponent(JSON.stringify(d));
var w=window.open(url,'teukga_capture','width=560,height=820');
if(!w)location.href=url;
})();`;
}

// captureUrl: the capture page to open, e.g. https://user.github.io/deal/admin/capture.html
export function bookmarkletHref(captureUrl) {
  const code = bookmarkletSource(captureUrl)
    .split('\n')
    .map((l) => l.trim())
    .join('');
  return `javascript:${encodeURIComponent(code)}`;
}


// Turn the raw strings the bookmarklet sent into the same shape parseProductPage() returns.
export function parseCapture(raw) {
  let d = raw;
  if (typeof raw === 'string') {
    try {
      d = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== 'object') return null;
  const ids = parseProductIds(String(d.u || ''));
  if (!ids) return null;
  const price = parsePrice(d.p);
  let originalPrice = parsePrice(d.o);
  if (originalPrice && price && originalPrice <= price) originalPrice = null;
  return {
    ...ids,
    productUrl: canonicalProductUrl(ids),
    title: cleanTitle(d.t).slice(0, 200),
    image: absImage(d.i),
    price,
    originalPrice,
    discountRate: price ? computeRate(price, originalPrice) || parseRate(d.r) || 0 : null,
    soldOut: Boolean(Number(d.so)),
    rocket: Boolean(Number(d.rk)),
  };
}

// Values posted from the capture / edit forms (numbers may be typed as "12,900원").
export function parseFormData(body, base = {}) {
  const price = parsePrice(body.price);
  let originalPrice = parsePrice(body.originalPrice);
  if (originalPrice && price && originalPrice <= price) originalPrice = null;
  return {
    ...base,
    title: cleanTitle(body.title || base.title || '').slice(0, 200),
    image: absImage(body.image) || base.image || '',
    price,
    originalPrice,
    discountRate: price ? computeRate(price, originalPrice) || parseRate(`${body.rate ?? ''}%`) || 0 : null,
    soldOut: body.soldOut === '1' || body.soldOut === 'on',
    rocket: body.rocket === '1' || body.rocket === 'on',
  };
}
