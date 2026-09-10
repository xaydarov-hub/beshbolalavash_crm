// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrateDatabase, prepareDatabase } from './storage.js';
it('copies a verified database without replacing either existing file', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'crm-storage-'));
  try {
    const source = join(folder, 'source.json'), target = join(folder, 'persistent', 'db.json');
    const bytes = JSON.stringify({ users: [{ id: 'employee' }], branches: [], attendance: [{ id: 'att' }] });
    await writeFile(source, bytes);
    await expect(migrateDatabase(source, target)).resolves.toMatchObject({ accounts: 1 });
    await expect(migrateDatabase(source, target)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(source, 'utf8')).toBe(bytes);
    expect(await readFile(target, 'utf8')).toBe(bytes);
    await expect(prepareDatabase({ RENDER: 'true', DB_PATH: join(folder, 'missing.json') })).rejects.toThrow('No empty replacement');
  } finally {
    if (!folder.startsWith(join(tmpdir(), 'crm-storage-'))) throw new Error('Unexpected test directory');
    await rm(folder, { recursive: true, force: true });
  }
});
