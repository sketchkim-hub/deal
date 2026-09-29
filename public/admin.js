document.querySelectorAll('form[data-confirm]').forEach((f) =>
  f.addEventListener('submit', (e) => {
    if (!confirm(f.dataset.confirm)) e.preventDefault();
  }),
);

// Dashboard: KPI cards and tabs filter the product table.
const rows = [...document.querySelectorAll('#deals tbody tr[data-bucket]')];
const tabs = [...document.querySelectorAll('.tab[data-filter]')];
function filter(name) {
  for (const r of rows) {
    const b = r.dataset.bucket;
    r.hidden = !(name === 'all' || b === name || (name === 'live' && b === 'refresh'));
  }
  tabs.forEach((t) => t.classList.toggle('on', t.dataset.filter === name));
}
document.querySelectorAll('[data-filter]').forEach((el) =>
  el.addEventListener('click', () => {
    filter(el.dataset.filter);
    if (el.classList.contains('kpi')) document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' });
  }),
);

// Refresh while an automatic check is running so results show up without clicking.
if (document.querySelector('.publish .pill.warn')) setTimeout(() => location.reload(), 15000);

// Coming back from a capture window: reload so the new prices show, unless an edit form is open.
let lastReload = Date.now();
window.addEventListener('focus', () => {
  if (!document.getElementById('deals') || Date.now() - lastReload < 3000) return;
  if (document.querySelector('#deals details[open]')) return;
  lastReload = Date.now();
  location.reload();
});
