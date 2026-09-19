// Recovery tool for when the boss forgets their own password — nobody above them can reset it
// through the app itself. Run via Render's Shell tab (or locally), against whichever storage
// the server itself is configured for: Upstash if UPSTASH_REDIS_REST_URL/TOKEN are set in the
// environment, otherwise the local/DB_PATH JSON file.
// Usage: node server/reset-boss-password.mjs <new-password>
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { uid } from '../src/lib/utils.js';
import { createUpstashAdapter } from './upstashAdapter.js';

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(String(password), salt, 64)).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function fileAdapter(dbPath) {
  const filename = resolve(dbPath);
  return {
    async read() { return JSON.parse((await readFile(filename, 'utf8')).replace(/^﻿/, '')); },
    async write(value) {
      const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, filename);
    },
  };
}

const [newPassword] = process.argv.slice(2);
if (!newPassword) throw new Error('Usage: node server/reset-boss-password.mjs <new-password>');
if (newPassword.trim().length < 8) throw new Error('Yangi parol kamida 8 belgidan iborat bo‘lsin.');

const usingUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const adapter = usingUpstash
  ? createUpstashAdapter(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
  : fileAdapter(process.env.DB_PATH || './server/db.json');

const state = await adapter.read();
if (!state || !Array.isArray(state.users) || !state.users.length) throw new Error('Baza topilmadi yoki bo‘sh: users massivi yo‘q.');
const boss = state.users.find(user => user.role === 'boss');
if (!boss) throw new Error('Bazada boshliq (role: "boss") hisobi topilmadi.');

boss.passwordHash = await hashPassword(newPassword);
boss.authVersion = (boss.authVersion || 0) + 1;
boss.firstLogin = false;
state.revision = (state.revision || 0) + 1;
state.auditLog = [{ id: uid(), at: new Date().toISOString(), actor: 'System', action: `${boss.name}: parol qayta o'rnatildi (server konsolidan).` }, ...(state.auditLog || [])];

await adapter.write(state);

console.log(JSON.stringify({ reset: true, login: boss.phone, storage: usingUpstash ? 'upstash' : 'file' }));
