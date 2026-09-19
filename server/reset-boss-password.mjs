// Recovery tool for when the boss forgets their own password — nobody above them can reset it
// through the app itself. Run via Render's Shell tab against the live DB_PATH, or locally.
// Usage: node server/reset-boss-password.mjs <db-path> <new-password>
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { uid } from '../src/lib/utils.js';

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(String(password), salt, 64)).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

const [dbPath, newPassword] = process.argv.slice(2);
if (!dbPath || !newPassword) throw new Error('Usage: node server/reset-boss-password.mjs <db-path> <new-password>');
if (newPassword.trim().length < 8) throw new Error('Yangi parol kamida 8 belgidan iborat bo‘lsin.');

const filename = resolve(dbPath);
const state = JSON.parse((await readFile(filename, 'utf8')).replace(/^﻿/, ''));
if (!Array.isArray(state.users) || !state.users.length) throw new Error('Fayl to‘g‘ri CRM bazasi emas: users massivi yo‘q.');
const boss = state.users.find(user => user.role === 'boss');
if (!boss) throw new Error('Bazada boshliq (role: "boss") hisobi topilmadi.');

boss.passwordHash = await hashPassword(newPassword);
boss.authVersion = (boss.authVersion || 0) + 1;
boss.firstLogin = false;
state.revision = (state.revision || 0) + 1;
state.auditLog = [{ id: uid(), at: new Date().toISOString(), actor: 'System', action: `${boss.name}: parol qayta o'rnatildi (server konsolidan).` }, ...(state.auditLog || [])];

const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
await rename(temporary, filename);

console.log(JSON.stringify({ reset: true, login: boss.phone }));
