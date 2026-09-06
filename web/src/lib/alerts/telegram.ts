// Real Telegram delivery via the Bot API — no simulation. Gated on
// TELEGRAM_BOT_TOKEN (create one free via @BotFather: send `/newbot`, no
// phone/CAPTCHA needed). Without it, callers get an honest "not configured"
// result rather than a fake "sent" response — same pattern as SCAN_API_KEY.

export type TelegramResult = { sent: true } | { sent: false; reason: string };

export async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { sent: false, reason: "TELEGRAM_BOT_TOKEN is not configured on the server" };
  }
  if (!chatId.trim()) {
    return { sent: false, reason: "no chat ID given" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { sent: false, reason: json.description ?? `Telegram API ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "request failed" };
  }
}
