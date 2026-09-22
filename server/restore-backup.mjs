// Restores a backup downloaded via GET /api/backup (or the boss "Zaxira nusxa olish" button)
// into whichever storage the server is configured for: Upstash if UPSTASH_REDIS_REST_URL/TOKEN
// are set in the environment, otherwise the local/DB_PATH JSON file. Run via Render's Shell tab
// (or locally) after verifying the backup file is the one you actually mean to restore.
// Usage: node server/restore-backup.mjs <backup-file.json>
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import crypto from 'node:crypto';
import { createUpstashAdapter } from './upstashAdapter.js';

function fileAdapter(dbPath) {
  const filename = resolve(dbPath);
  return {
    async write(value) {
      const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, filename);
    },
  };
}

const [backupPath] = process.argv.slice(2);
if (!backupPath) throw new Error('Usage: node server/restore-backup.mjs <backup-file.json>');

const state = JSON.parse((await readFile(resolve(backupPath), 'utf8')).replace(/^﻿/, ''));
if (!Array.isArray(state.users) || !state.users.length || !Array.isArray(state.branches)) throw new Error('Backup faylida to‘liq CRM bazasi yo‘q (users/branches massivlari kerak).');
if (!state.users.some(user => user.role === 'boss')) throw new Error('Backup faylida boshliq (role: "boss") hisobi yo‘q.');

const usingUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const adapter = usingUpstash
  ? createUpstashAdapter(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
  : fileAdapter(process.env.DB_PATH || './server/db.json');

await adapter.write(state);

console.log(JSON.stringify({ restored: true, storage: usingUpstash ? 'upstash' : 'file', users: state.users.length, branches: state.branches.length, revision: state.revision ?? 0 }));
