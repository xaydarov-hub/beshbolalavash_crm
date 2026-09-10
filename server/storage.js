import { mkdir, readFile, writeFile, link, unlink, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

// An explicit migration never overwrites either the source or an existing target.
export async function migrateDatabase(source, destination) {
  const from = resolve(source), to = resolve(destination);
  if (from === to) throw new Error('Source and destination must differ.');
  const bytes = await readFile(from);
  const state = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(state.users) || !state.users.length || !Array.isArray(state.branches)) throw new Error('Source is not a complete CRM database.');
  await mkdir(dirname(to), { recursive: true });
  const temporary = `${to}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
  try { await link(temporary, to); } finally { await unlink(temporary); }
  return { accounts: state.users.length, checksum: crypto.createHash('sha256').update(bytes).digest('hex') };
}

export async function prepareDatabase(env = process.env) {
  const filename = resolve(env.DB_PATH || './server/db.json');
  try { await access(filename); return filename; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (env.DB_SEED_PATH) {
    await migrateDatabase(env.DB_SEED_PATH, filename);
  } else if (env.RENDER && env.DB_PATH) {
    throw new Error('Persistent CRM database is missing. Restore the current database backup to DB_PATH before starting. No empty replacement was created.');
  } else {
    await mkdir(dirname(filename), { recursive: true });
  }
  return filename;
}
