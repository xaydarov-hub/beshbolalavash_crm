import { it, expect, vi, afterEach } from 'vitest';
import { createUpstashAdapter } from './upstashAdapter.js';

afterEach(() => { vi.unstubAllGlobals(); });

function mockFetch(handler) {
  const fn = vi.fn(handler);
  vi.stubGlobal('fetch', fn);
  return fn;
}

it('reads null when the key has never been set', async () => {
  mockFetch(async () => new Response(JSON.stringify({ result: null }), { status: 200 }));
  const adapter = createUpstashAdapter('https://example.upstash.io', 'token');
  expect(await adapter.read()).toBeNull();
});

it('round-trips a full state object through SET and GET', async () => {
  const state = { users: [{ id: 'boss-1', role: 'boss' }], branches: [], revision: 3 };
  let stored = null;
  const fetchMock = mockFetch(async (url, options) => {
    const [command, key, value] = JSON.parse(options.body);
    if (command === 'SET') { stored = value; return new Response(JSON.stringify({ result: 'OK' }), { status: 200 }); }
    if (command === 'GET') return new Response(JSON.stringify({ result: stored }), { status: 200 });
    throw new Error('unexpected command');
  });
  const adapter = createUpstashAdapter('https://example.upstash.io', 'my-token', 'crm:db');
  await adapter.write(state);
  expect(JSON.parse(stored)).toEqual(state);
  expect(await adapter.read()).toEqual(state);

  const [, options] = fetchMock.mock.calls[0];
  expect(options.headers.Authorization).toBe('Bearer my-token');
  const [command, key] = JSON.parse(options.body);
  expect(command).toBe('SET');
  expect(key).toBe('crm:db');
});

it('throws with the Upstash error message on a failed command', async () => {
  mockFetch(async () => new Response(JSON.stringify({ error: 'WRONGPASS invalid token' }), { status: 401 }));
  const adapter = createUpstashAdapter('https://example.upstash.io', 'bad-token');
  await expect(adapter.read()).rejects.toThrow(/WRONGPASS/);
});
