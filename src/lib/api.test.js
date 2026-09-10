import { afterEach, expect, it, vi } from 'vitest';
import { request, requireCurrentApi } from './api.js';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('does not send requests or discard the session while offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  global.fetch = vi.fn();
  localStorage.setItem('bbl-crm-token', 'valid-session');
  await expect(request('/api/state')).rejects.toMatchObject({ offline: true });
  expect(fetch).not.toHaveBeenCalled();
  expect(localStorage.getItem('bbl-crm-token')).toBe('valid-session');
});
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
  global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Conflict' }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
  await expect(request('/api/state', { method: 'PATCH', body: { changes: [] } })).rejects.toMatchObject({ status: 409 });
});
it('reports an HTML 404 as an unavailable API without a JSON syntax error', async () => {
  global.fetch = vi.fn().mockResolvedValue(new Response('<!DOCTYPE html><html>Cannot PATCH /api/state</html>', { status: 404, headers: { 'Content-Type': 'text/html' } }));
  await expect(request('/api/state', { method: 'PATCH', body: { changes: [] } })).rejects.toMatchObject({ status: 404, message: expect.stringContaining('saqlanmadi') });
});
it('clears an expired session even when the 401 response is HTML', async () => {
  localStorage.setItem('bbl-crm-token', 'expired');
  const listener = vi.fn();
  window.addEventListener('crm:session-expired', listener);
  global.fetch = vi.fn().mockResolvedValue(new Response('<html>Unauthorized</html>', { status: 401 }));
  await expect(request('/api/state')).rejects.toMatchObject({ status: 401 });
  expect(localStorage.getItem('bbl-crm-token')).toBeNull();
  expect(listener).toHaveBeenCalledOnce();
  window.removeEventListener('crm:session-expired', listener);
});
it('never sends new write formats to a legacy backend', () => {
  expect(() => requireCurrentApi({ users: [] })).toThrow(/yangilanishi/);
  expect(() => requireCurrentApi({ revision: 0, dailySales: [] })).not.toThrow();
});
