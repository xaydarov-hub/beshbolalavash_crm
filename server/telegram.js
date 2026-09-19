// Server-only: these must never be VITE_-prefixed, or Vite would bundle the bot token into the client.
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '').trim();

export async function sendTelegramMessage(text) {
  const message = String(text || '').slice(0, 4000);
  if (!message || !BOT_TOKEN || !CHAT_ID) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
    const result = await response.json();
    if (!result?.ok) { console.warn('Telegram notification skipped:', result?.description || 'Unknown Telegram error'); return false; }
    return true;
  } catch (error) {
    console.error('Telegram send error:', error.message);
    return false;
  }
}
