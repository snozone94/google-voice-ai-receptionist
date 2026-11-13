import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const pending = new Map();
const footer = 'Reply STOP to stop.';
const phone = value => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? `1${digits}` : digits;
};
const hasDisclosure = text => /\b(?:reply|text)\s+STOP\s+to\s+(?:stop|unsubscribe)\b/i.test(text || '');

export function smsDisclosureBody(message, include) {
  const clean = String(message || '').replace(/\b(?:reply|text)\s+STOP\s+to\s+(?:stop|unsubscribe)[.!]?/gi, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return include && clean ? `${clean.slice(0, 1000 - footer.length - 2).trim()}\n\n${footer}` : clean;
}

// Both staff replies and automated messages use one queue and a durable marker.
// An existing accepted message containing the disclosure seeds older customers.
export async function sendWithSmsDisclosure({ dataDir, from, to, message, send }) {
  const sender = phone(from), recipient = phone(to);
  const key = path.join(dataDir, 'sms-disclosures', createHash('sha256').update(`${sender}:${recipient}`).digest('hex') + '.json');
  const previous = pending.get(key) || Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    let disclosed = false;
    try { disclosed = Boolean(JSON.parse(await fs.readFile(key, 'utf8')).disclosedAt); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!disclosed) {
      let history = '';
      try { history = await fs.readFile(path.join(dataDir, 'sms.jsonl'), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      disclosed = history.split('\n').some(line => {
        let row; try { row = JSON.parse(line); } catch { return false; }
        return row.direction === 'outbound' && phone(row.to) === recipient && phone(row.from) === sender && ['accepted', 'queued', 'sending', 'sent', 'delivered', 'success'].includes(String(row.status)) && hasDisclosure(row.body);
      });
    }
    const body = smsDisclosureBody(message, !disclosed);
    const result = await send(body);
    if (disclosed || result.ok && !['failed', 'undelivered'].includes(String(result.status))) {
      await fs.mkdir(path.dirname(key), { recursive: true });
      await fs.writeFile(key, JSON.stringify({ disclosedAt: new Date().toISOString() }), { mode: 0o600 });
    }
    return { ...result, messageBody: body };
  });
  pending.set(key, operation);
  try { return await operation; }
  finally { if (pending.get(key) === operation) pending.delete(key); }
}
