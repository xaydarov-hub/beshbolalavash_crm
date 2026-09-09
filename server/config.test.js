import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import { serverConfig } from './config.js';
const folders = [];
function environment(extra = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'crm-key-test-'));
  folders.push(folder);
  return { RENDER: 'true', NODE_ENV: 'production', DB_PATH: join(folder, 'db.json'), ...extra };
}
afterEach(() => {
  for (const folder of folders.splice(0)) {
    if (!folder.startsWith(join(tmpdir(), 'crm-key-test-'))) throw new Error('Unexpected test directory');
    rmSync(folder, { recursive: true, force: true });
  }
});
it('starts without a configured key and retains valid sessions across restarts', () => {
  const env = environment();
  const first = serverConfig(env);
  expect(first.secret).toMatch(/^[a-f0-9]{64}$/);
  const token = jwt.sign({ id: 'test-user' }, first.secret);
  const restarted = serverConfig(env);
  expect(restarted.secret).toBe(first.secret);
  expect(jwt.verify(token, restarted.secret).id).toBe('test-user');
  if (process.platform !== 'win32') expect(statSync(join(folders[0], '.jwt-secret')).mode & 0o777).toBe(0o600);
});
it('uses independent strong keys for missing or short configuration', () => {
  const values = ['', 'short', ' '.repeat(40)].map(JWT_SECRET => serverConfig(environment({ JWT_SECRET })).secret);
  expect(new Set(values).size).toBe(3);
  expect(values.every(value => /^[a-f0-9]{64}$/.test(value))).toBe(true);
});
it('preserves a configured strong key and binds to the supplied port', () => {
  const secret = 'test-only-key-'.repeat(4);
  expect(serverConfig(environment({ JWT_SECRET: secret, PORT: '10000' }))).toEqual({ secret, port: 10000, host: '0.0.0.0' });
});
it('never overwrites a corrupt saved key or accepts tokens from another key', () => {
  const env = environment();
  const filename = join(folders[0], '.jwt-secret');
  writeFileSync(filename, 'invalid');
  expect(() => serverConfig(env)).toThrow(/saved signing key/);
  expect(readFileSync(filename, 'utf8')).toBe('invalid');
  const first = serverConfig(environment()).secret;
  const second = serverConfig(environment()).secret;
  expect(() => jwt.verify(jwt.sign({ id: 'test' }, first), second)).toThrow();
});
it('rejects invalid ports and allows ephemeral test ports', () => {
  expect(() => serverConfig({ PORT: 'bad' })).toThrow(/PORT/);
  expect(serverConfig(environment({ PORT: '0' })).port).toBe(0);
});
