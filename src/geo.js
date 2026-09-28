// Which country is this machine's public IP in? Coupang serves (or blocks) overseas IPs
// differently, so monitoring only runs when this returns KR.

const SOURCES = [
  { url: 'https://ipinfo.io/json', pick: (j) => ({ ip: j.ip, country: j.country, org: j.org }) },
  { url: 'https://ipapi.co/json/', pick: (j) => ({ ip: j.ip, country: j.country_code, org: j.org }) },
  { url: 'https://ipwho.is/', pick: (j) => ({ ip: j.ip, country: j.country_code, org: j.connection?.org }) },
];

let cache = null;

export async function lookupGeo({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < 3600_000) return cache.value;
  const errors = [];
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const value = s.pick(await res.json());
      if (!value.country) throw new Error('no country');
      cache = { at: Date.now(), value };
      return value;
    } catch (e) {
      errors.push(`${new URL(s.url).host}: ${e.message}`);
    }
  }
  throw new Error(`IP 위치 확인 실패 (${errors.join(', ')})`);
}
