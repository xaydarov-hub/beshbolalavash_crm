const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
const base = configured && !/^https?:\/\//i.test(configured) && !configured.startsWith('/') ? `https://${configured}` : configured;

export async function request(path, { method = 'GET', body, headers = {}, timeout = 25000, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const token = localStorage.getItem('bbl-crm-token');
    const response = await fetch(`${base}${path}`, {
      ...options, method, signal: controller.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 304) return null;
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || 'So‘rov bajarilmadi.'), { status: response.status });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Server javobi kechikdi. Qayta urinib ko‘ring.');
    if (error instanceof TypeError) throw new Error('Serverga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.');
    throw error;
  } finally { clearTimeout(timer); }
}
