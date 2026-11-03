import crypto from 'node:crypto';
export const holdTracks = ['ddd-bri-hold.mp3', 'ddd-check-your-phone-hold.mp3'];
const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const signature = (call, expires, secret) => crypto.createHmac('sha256', secret).update(`${call}:${expires}:ddd-hold-audio`).digest('hex');
export function createHoldMusicUrl(baseUrl, secret, call, now = Date.now()) {
  if (!secret || !/^CA[0-9a-f]{32}$/i.test(call)) return '';
  const expires = String(now + 10 * 60000);
  const query = new URLSearchParams({ call, expires, token: signature(call, expires, secret), track: String(parseInt(call.slice(-1), 16) % 2) });
  return new URL('/api/voice/hold-music?' + query, baseUrl).toString();
}
export function verifyHoldMusic(query, secret, now = Date.now()) {
  const { call, expires, token } = query;
  if (!secret || typeof call !== 'string' || typeof expires !== 'string' || typeof token !== 'string' || !/^CA[0-9a-f]{32}$/i.test(call || '') || !/^\d+$/.test(expires || '') || Number(expires) <= now || Number(expires) > now + 11 * 60000 || !/^[0-9a-f]{64}$/.test(token || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(signature(call, expires, secret), 'hex'));
}
export function holdMusicTwiml(baseUrl, query) {
  const tracks = [...holdTracks];
  if (query.track === '1') tracks.reverse();
  const params = new URLSearchParams({ call: query.call, expires: query.expires, token: query.token });
  return `<Response>${tracks.map(file => `<Play>${xml(new URL('/api/voice/hold-audio/' + file + '?' + params, baseUrl))}</Play>`).join('')}<Redirect method="GET">${xml(new URL('/api/voice/hold-music?' + params + '&track=' + (query.track === '1' ? '1' : '0'), baseUrl))}</Redirect></Response>`;
}
