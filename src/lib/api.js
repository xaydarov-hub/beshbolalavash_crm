const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
const base = configured && !/^https?:\/\//i.test(configured) && !configured.startsWith('/') ? `https://${configured}` : configured;

async function parseApiResponse(response) {
  if (response.status === 204 || response.status === 304) return null;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type') || '';
  const looksLikeHtml = /text\/html|application\/xhtml\+xml/i.test(contentType) || /<!doctype html|<html|<body/i.test(text);

  if (looksLikeHtml) {
    throw Object.assign(new Error(response.status === 404 ? 'Server hali yangilanmagan yoki API yo‘li topilmadi. Amal saqlanmadi.' : 'Server vaqtincha API o‘rniga sahifa qaytardi. Qayta urinib ko‘ring.'), {
      status: response.status,
      detail: text.slice(0, 200),
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Serverdan noto‘g‘ri formatdagi javob keldi.'), {
      status: response.status,
      detail: text.slice(0, 200),
    });
  }
}

export async function request(path, { method = 'GET', body, headers = {}, timeout = 25000, ...options } = {}) {
  if (navigator.onLine === false) throw Object.assign(new Error('Internet aloqasi uzilgan. Aloqa tiklangach qayta urinib ko‘ring.'), { offline: true });
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
    if (response.status === 401) {
      if (path !== '/api/login' && localStorage.getItem('bbl-crm-token') === token) {
        localStorage.removeItem('bbl-crm-token');
        window.dispatchEvent(new Event('crm:session-expired'));
      }
      throw Object.assign(new Error(path === '/api/login' ? 'Login yoki parol noto‘g‘ri.' : 'Sessiya tugadi. Qayta kiring.'), { status: 401 });
    }

    const data = await parseApiResponse(response);
    if (!response.ok) {
      const message = data?.message || (response.status === 401 ? 'Sessiya tugadi. Qayta kiring.' : 'So‘rov bajarilmadi.');
      throw Object.assign(new Error(message), { status: response.status });
    }
    if (path === '/api/state' || path === '/api/login' || path === '/api/sales') {
      if (!data?.state || !Array.isArray(data.state.users) || !Array.isArray(data.state.branches)) throw new Error('Server to‘liq ma’lumot qaytarmadi. Qayta urinib ko‘ring.');
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Server javobi kechikdi. Qayta urinib ko‘ring.');
    if (error instanceof TypeError) throw new Error('Serverga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.');
    throw error;
  } finally { clearTimeout(timer); }
}

// Fail closed during staggered frontend/backend deployments. Never send a
// record-level update to a legacy server or downgrade to unsafe whole-state writes.
export function requireCurrentApi(state) {
  if (!Number.isInteger(state?.revision) || !Array.isArray(state?.dailySales)) {
    throw Object.assign(new Error('Server yangilanishi yakunlanmagan. Ma’lumotlarni ko‘rish mumkin, saqlash uchun server yangilanishini kuting.'), { status: 426 });
  }
}
