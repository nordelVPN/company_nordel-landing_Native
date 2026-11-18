const action = process.argv[2];
const methods = { set: 'setWebhook', info: 'getWebhookInfo', delete: 'deleteWebhook' };
if (!methods[action]) throw new Error('Usage: node webhook-admin.mjs set <https-url> | info | delete');
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
let body = {};
if (action === 'set') {
  const url = new URL(process.argv[3]);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Use a plain HTTPS ngrok URL');
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret || '')) throw new Error('Invalid webhook secret');
  url.pathname = '/webhook';
  body = { url: url.href, secret_token: secret, allowed_updates: ['message'], max_connections: 1 };
}
try {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + methods[action], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error('API rejected request');
  if (action === 'info') {
    const info = result.result;
    console.log(JSON.stringify({
      url: info.url,
      pending_update_count: info.pending_update_count,
      last_error_date: info.last_error_date,
      last_error_message: info.last_error_message
    }, null, 2));
  } else console.log(methods[action] + ': ok');
} catch {
  console.error('Telegram request failed; check token, connectivity and webhook URL');
  process.exitCode = 1;
}
