import fs from 'node:fs/promises';
import path from 'node:path';

// Shared by all automatic call SMS paths. Keep uncertain sends reserved: providers
// do not offer an idempotency contract, so retrying could text the customer twice.
export async function reserveCallSms({ dataDir, phone, windowMs = 30 * 60_000 }) {
  const digits = String(phone || '').replace(/\D/g, '');
  const normalized = digits.length === 10 ? `1${digits}` : digits;
  if (!/^1\d{10}$/.test(normalized)) return null;
  const directory = path.join(dataDir, 'call-sms-claims');
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `${normalized}.json`);
  // mkdir provides a cross-process lock, including during expiration replacement.
  const lock = `${file}.lock`;
  try { await fs.mkdir(lock); } catch (error) { if (error.code === 'EEXIST') return null; throw error; }
  try {
    const now = Date.now();
    try {
      const old = JSON.parse(await fs.readFile(file, 'utf8'));
      if (now - old.reservedAt < windowMs) return null;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const claim = { phone: `+${normalized}`, reservedAt: now };
    await fs.writeFile(file, JSON.stringify(claim));
    return claim;
  } finally { await fs.rmdir(lock); }
}
