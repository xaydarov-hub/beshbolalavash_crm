const BOT_TOKEN = (import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "").trim();
const CHAT_ID = String(import.meta.env.VITE_TELEGRAM_CHAT_ID || "").trim();

export async function sendTelegramMessage(text) {
  const message = String(text || "").slice(0, 4000);
  if (!message) return false;
  if (!BOT_TOKEN || !CHAT_ID) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
    const result = await response.json();

    if (!result?.ok) {
      console.warn("Telegram notification skipped:", result?.description || "Unknown Telegram error");
      return false;
    }

    return Boolean(result?.ok);
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}
