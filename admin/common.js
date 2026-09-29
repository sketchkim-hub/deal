// Small helpers shared by the dashboard and the capture window.
import { Repo, GitHubError } from './github.js';

export const $ = (sel, el = document) => el.querySelector(sel);

export function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const won = (n) => (n == null ? '' : `${Number(n).toLocaleString('ko-KR')}원`);

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.round(hr / 24)}일 전`;
}

export function formatKst(date, { withDate = false } = {}) {
  if (!date) return '';
  const d = new Date(new Date(date).getTime() + 9 * 3600_000);
  const p = (n) => String(n).padStart(2, '0');
  const hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  return withDate ? `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hm}` : hm;
}

export const catOptions = (cats, selected) =>
  cats.map((c) => `<option ${c === selected ? 'selected' : ''}>${h(c)}</option>`).join('');

export async function loadConfig() {
  const res = await fetch('site-config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('site-config.json 을 읽지 못했습니다.');
  return res.json();
}

// The token lives only in this browser (localStorage). A new PC just asks for it again.
const KEY = 'teukga_github_token';
export function getToken() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* private window: token is kept for this page only */
  }
}

export const repoFor = (cfg, token) =>
  new Repo({ repo: cfg.repo, branch: cfg.branch, dataPath: cfg.dataPath, token });

// Ask for a token until one with write access is given. Resolves with a ready Repo.
export function login(cfg, mount, { compact = false } = {}) {
  return new Promise((resolve) => {
    const tokenUrl = 'https://github.com/settings/personal-access-tokens/new';
    mount.innerHTML = `
<section class="panel login">
  <h2>🔑 관리자 로그인</h2>
  <p class="help">이 PC에서 처음 쓰는 경우 GitHub 토큰을 한 번 붙여넣어 주세요. 이 브라우저에만 저장되며, 다른 PC에서는 같은 토큰을 다시 넣으면 됩니다.</p>
  ${compact ? '' : `<ol class="steps">
    <li><a href="${tokenUrl}" target="_blank" rel="noopener">GitHub 토큰 만들기 페이지</a>를 엽니다 (GitHub 로그인 필요).</li>
    <li><b>Token name</b>: <code>teukga-admin</code> · <b>Expiration</b>: 원하는 기간 (예: 1년)</li>
    <li><b>Repository access</b>: <i>Only select repositories</i> → <code>${h(cfg.repo)}</code> 선택</li>
    <li><b>Permissions</b> → Repository permissions → <b>Contents: Read and write</b>, <b>Actions: Read-only</b></li>
    <li>맨 아래 <b>Generate token</b> → 나온 <code>github_pat_…</code> 값을 복사해 아래에 붙여넣기</li>
  </ol>`}
  <form class="login-form">
    <input name="token" type="password" placeholder="github_pat_..." autocomplete="off" required>
    <button class="primary">로그인</button>
  </form>
  <p class="login-error err" hidden></p>
</section>`;
    const form = $('.login-form', mount);
    const err = $('.login-error', mount);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = form.token.value.trim();
      const btn = $('button', form);
      btn.disabled = true;
      err.hidden = true;
      try {
        const repo = repoFor(cfg, token);
        await repo.check();
        setToken(token);
        resolve(repo);
      } catch (e2) {
        err.textContent = e2 instanceof GitHubError && e2.status === 401 ? '토큰이 올바르지 않거나 만료되었습니다.' : e2.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  });
}

// Use the saved token if it still works, otherwise show the login form.
export async function connect(cfg, mount, opts) {
  const saved = getToken();
  if (saved) {
    const repo = repoFor(cfg, saved);
    try {
      await repo.check();
      return repo;
    } catch (e) {
      if (!(e instanceof GitHubError) || (e.status !== 401 && e.status !== 403)) throw e;
      setToken('');
    }
  }
  return login(cfg, mount, opts);
}

export function toast(message, tone = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = `toast ${tone}`;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 4000);
}
