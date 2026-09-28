(() => {
  // The page is a static file, so the next check time is worked out in the browser (KST = UTC+9).
  const KST = 9 * 3600e3;
  const nextCheck = (times, now = Date.now()) => {
    const k = new Date(now + KST);
    let best = Infinity;
    for (const day of [0, 1]) {
      for (const t of times) {
        const [hh, mm] = t.split(':').map(Number);
        const at = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + day, hh, mm || 0) - KST;
        if (at > now && at < best) best = at;
      }
    }
    return best;
  };

  // Tell visitors when the prices on the page are old (e.g. the home PC was off for a while).
  const built = Date.parse(document.body.dataset.built);
  const staleHours = Number(document.body.dataset.staleHours) || 24;
  if (built && Date.now() - built > staleHours * 3600e3) {
    const note = document.querySelector('.stale-note');
    if (note) note.hidden = false;
  }

  // ── countdown to the next price check ──
  const cd = document.querySelector('.countdown');
  if (cd) {
    const times = (cd.dataset.times || '').split(',').filter(Boolean);
    const label = document.querySelector('.next-time');
    let target = nextCheck(times);
    const tick = () => {
      if (Date.now() >= target) target = nextCheck(times);
      if (label) {
        const d = new Date(target + KST);
        label.textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      }
      const s = Math.max(0, Math.round((target - Date.now()) / 1000));
      const hh = Math.floor(s / 3600);
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      cd.textContent = hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ── share ──
  document.querySelectorAll('.share').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const data = { title: btn.dataset.title, url: location.href };
      try {
        if (navigator.share) return await navigator.share(data);
        await navigator.clipboard.writeText(location.href);
        btn.textContent = '링크를 복사했어요';
      } catch {
        /* cancelled */
      }
    });
  });

  // ── filters & sort (state lives in the URL so it can be shared) ──
  const grid = document.getElementById('grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.card')];
  const empty = document.getElementById('empty');
  const sortSel = document.getElementById('sort');
  const params = new URLSearchParams(location.search);
  const state = {
    cat: params.get('cat') || '',
    min: Number(params.get('min')) || 0,
    sort: params.get('sort') || 'rate',
  };

  const num = (el, k) => Number(el.dataset[k]) || 0;
  const sorters = {
    rate: (a, b) => num(b, 'rate') - num(a, 'rate') || num(a, 'price') - num(b, 'price'),
    drop: (a, b) => num(b, 'drop') - num(a, 'drop') || num(b, 'rate') - num(a, 'rate'),
    save: (a, b) => num(b, 'save') - num(a, 'save'),
    low: (a, b) => num(a, 'price') - num(b, 'price'),
    new: (a, b) => num(b, 'new') - num(a, 'new'),
  };

  function apply() {
    let shown = 0;
    for (const c of cards) {
      const ok = (!state.cat || c.dataset.cat === state.cat) && num(c, 'rate') >= state.min;
      c.hidden = !ok;
      if (ok) shown++;
    }
    cards.sort(sorters[state.sort] || sorters.rate).forEach((c) => grid.appendChild(c));
    if (empty) empty.hidden = shown > 0;

    document.querySelectorAll('.chip[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === state.cat));
    const rateChips = [...document.querySelectorAll('.chip[data-min]')];
    const active = rateChips.filter((b) => Number(b.dataset.min) <= state.min).pop() || rateChips[0];
    rateChips.forEach((b) => b.classList.toggle('on', b === active));
    if (sortSel) sortSel.value = state.sort;

    const q = new URLSearchParams();
    if (state.cat) q.set('cat', state.cat);
    if (state.min && rateChips[0] && state.min > Number(rateChips[0].dataset.min)) q.set('min', state.min);
    if (state.sort !== 'rate') q.set('sort', state.sort);
    history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
  }

  document.querySelectorAll('.chip[data-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      state.cat = b.dataset.cat;
      apply();
    }),
  );
  document.querySelectorAll('.chip[data-min]').forEach((b) =>
    b.addEventListener('click', () => {
      state.min = Number(b.dataset.min);
      apply();
    }),
  );
  sortSel?.addEventListener('change', () => {
    state.sort = sortSel.value;
    apply();
  });

  apply();
})();
