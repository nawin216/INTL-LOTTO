// utils/telegram.js
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(text) {
  if (!TELEGRAM_TOKEN || !CHAT_ID) {
    console.warn('Telegram not configured');
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram sendMessage failed:', data);
    }
  } catch (err) {
    console.error('Telegram error:', err.message);
  }
}

module.exports = { sendTelegramAlert };
