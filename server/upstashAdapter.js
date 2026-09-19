// A lowdb-compatible storage adapter backed by Upstash Redis's REST API, so the
// database survives restarts and redeploys without needing a paid persistent disk.
export function createUpstashAdapter(url, token, key = 'crm:db') {
  async function command(args) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(`Upstash so'rovi bajarilmadi: ${data.error || response.status}`);
    return data.result;
  }

  return {
    async read() {
      const result = await command(['GET', key]);
      return result == null ? null : JSON.parse(result);
    },
    async write(value) {
      await command(['SET', key, JSON.stringify(value)]);
    },
  };
}
