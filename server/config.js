import crypto from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, linkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function signingSecret(env) {
  if (typeof env.JWT_SECRET === 'string' && env.JWT_SECRET.trim().length >= 32) return env.JWT_SECRET;
  // Persist a strong key next to the database, outside served assets.
  const filename = env.JWT_SECRET_FILE || join(dirname(resolve(env.DB_PATH || './server/db.json')), '.jwt-secret');
  const read = () => {
    const value = readFileSync(filename, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('The saved signing key is invalid. Restore the key file or configure a strong JWT_SECRET.');
    return value;
  };
  try { return read(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  mkdirSync(dirname(filename), { recursive: true });
  const temporary = `${filename}.${crypto.randomBytes(12).toString('hex')}.tmp`;
  writeFileSync(temporary, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  try {
    // Publish a complete file exclusively; simultaneous startups cannot overwrite it.
    try { linkSync(temporary, filename); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { unlinkSync(temporary); }
  return read();
}

export function serverConfig(env = process.env) {
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port. On Render, use the PORT provided by the service.');
  return { port, host: '0.0.0.0', secret: signingSecret(env) };
}
