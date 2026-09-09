import { afterEach, expect, it, vi } from 'vitest';
import { request } from './api.js';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('handles unchanged state without parsing an empty response', async () => {
  const json = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({ status: 304, json });
  expect(await request('/api/state')).toBeNull();
  expect(json).not.toHaveBeenCalled();
});
it('aborts stalled requests and reports a retryable message', async () => {
  vi.useFakeTimers();
  global.fetch = vi.fn((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
  const result = expect(request('/api/state', { timeout: 100 })).rejects.toThrow(/kechikdi/);
  await vi.advanceTimersByTimeAsync(101);
  await result;
});
it('preserves conflict status so the interface does not claim a successful save', async () => {
  global.fetch = vi.fn().mockResolvedValue({ status: 409, ok: false, json: async () => ({ message: 'Conflict' }) });
  await expect(request('/api/state', { method: 'PATCH', body: { changes: [] } })).rejects.toMatchObject({ status: 409 });
});
