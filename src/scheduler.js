// Korea has no daylight saving time, so KST is always UTC+9.
const KST_OFFSET = 9 * 3600_000;

export function nextRunAt(times, now = new Date()) {
  const k = new Date(now.getTime() + KST_OFFSET);
  let best = null;
  for (const dayOffset of [0, 1]) {
    for (const t of times) {
      const [hh, mm] = t.split(':').map(Number);
      const at = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + dayOffset, hh, mm || 0) - KST_OFFSET;
      if (at > now.getTime() && (best === null || at < best)) best = at;
    }
  }
  return new Date(best);
}

export function formatKst(date, { withDate = false } = {}) {
  if (!date) return '';
  const d = new Date(new Date(date).getTime() + KST_OFFSET);
  const p = (n) => String(n).padStart(2, '0');
  const hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  return withDate ? `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hm}` : hm;
}

// Most recent scheduled slot at or before `now`.
export function prevRunAt(times, now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 3600_000 - 1000);
  let t = nextRunAt(times, dayAgo);
  for (let n = nextRunAt(times, t); n <= now; n = nextRunAt(times, n)) t = n;
  return t;
}

// A home PC sleeps and wakes, so instead of one long timer we look at the clock every minute.
// If a slot was missed (PC off or asleep), the check runs as soon as the PC is back.
export function startSchedule(times, task, { lastRunAt = null, log = console.log } = {}) {
  let last = lastRunAt ? new Date(lastRunAt) : null;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const now = new Date();
    const due = prevRunAt(times, now);
    if (last && last >= due) return;
    if (!last) {
      // First start ever: don't run immediately, wait for the next slot.
      last = now;
      log(`[schedule] 다음 확인: ${formatKst(nextRunAt(times, now), { withDate: true })} (KST)`);
      return;
    }
    busy = true;
    last = now;
    try {
      await task();
    } catch (e) {
      console.error('[schedule]', e);
    } finally {
      busy = false;
      log(`[schedule] 다음 확인: ${formatKst(nextRunAt(times), { withDate: true })} (KST)`);
    }
  };
  tick();
  const timer = setInterval(tick, 60_000);
  return () => clearInterval(timer);
}
