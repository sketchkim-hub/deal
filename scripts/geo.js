import { lookupGeo } from '../src/geo.js';

const geo = await lookupGeo({ force: true });
console.log(`IP ${geo.ip} · 국가 ${geo.country} · ${geo.org || ''}`);
console.log(geo.country === 'KR' ? '✅ 한국 IP입니다. 모니터링을 실행할 수 있습니다.' : '❌ 한국 IP가 아닙니다. VPN을 끄고 한국 인터넷에 연결된 PC에서 실행하세요.');
process.exit(geo.country === 'KR' ? 0 : 1);
