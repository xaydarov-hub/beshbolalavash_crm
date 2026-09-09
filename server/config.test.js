import { expect, it } from 'vitest';
import { serverConfig } from './config.js';

it('requires a configured secret on Render, including without NODE_ENV', () => {
  expect(() => serverConfig({ RENDER: 'true' })).toThrow(/JWT_SECRET/);
  expect(() => serverConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  expect(() => serverConfig({ NODE_ENV: 'production', JWT_SECRET: ' '.repeat(40) })).toThrow(/JWT_SECRET/);
});
it('keeps the configured key stable and binds to Render PORT on all IPv4 interfaces', () => {
  const secret = 'test-only-key-'.repeat(4);
  const env = { RENDER: 'true', JWT_SECRET: secret, PORT: '10000' };
  expect(serverConfig(env)).toEqual({ secret, port: 10000, host: '0.0.0.0' });
  expect(serverConfig(env).secret).toBe(serverConfig(env).secret);
});
it('rejects an invalid port and supports temporary ports for isolated tests', () => {
  expect(() => serverConfig({ PORT: 'bad' })).toThrow(/PORT/);
  expect(serverConfig({ PORT: '0' }).port).toBe(0);
});
