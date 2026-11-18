import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const file = process.env.WISHLIST_FILE || '/data/wishlist.json';
if (!token || !/^[A-Za-z0-9_-]{1,256}$/.test(secret || '')) {
  throw new Error('Set TELEGRAM_BOT_TOKEN and a valid TELEGRAM_WEBHOOK_SECRET');
}
const welcome = 'Здравствуйте, мы ещё не запустили наше приложение, но Вы добавлены в wishlist! Мы будем держать Вас в курсе!';
let queue = Promise.resolve();

async function handle(update) {
  const message = update.message;
  if (!message?.from || !/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(message.text || '')) return;
  let users;
  try {
    users = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(users)) throw new Error('Invalid wishlist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    users = [];
  }
  const now = new Date().toISOString();
  const user = users.find(item => item.telegramId === message.from.id);
  const fields = {
    telegramId: message.from.id,
    username: message.from.username ?? null,
    firstName: message.from.first_name ?? null,
    lastName: message.from.last_name ?? null,
    lastStartAt: now
  };
  if (user) Object.assign(user, fields);
  else users.push({ ...fields, createdAt: now });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(users, null, 2) + '\n');
  await rename(file + '.tmp', file);
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: message.chat.id, text: welcome }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error('Telegram sendMessage failed');
}

const server = createServer(async (req, res) => {
  const reply = (status, text) => { res.writeHead(status); res.end(text); };
  if (req.method === 'GET' && req.url === '/health') return reply(200, 'ok');
  if (req.method !== 'POST' || req.url !== '/webhook') return reply(404, 'not found');
  const supplied = Buffer.from(req.headers['x-telegram-bot-api-secret-token'] || '');
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return reply(403, 'forbidden');
  }
  let body = '';
  try {
    for await (const chunk of req) {
      body += chunk.toString('utf8');
      if (Buffer.byteLength(body) > 65536) return reply(413, 'too large');
    }
    let update;
    try { update = JSON.parse(body); } catch { return reply(400, 'invalid JSON'); }
    if (!Number.isSafeInteger(update?.update_id)) return reply(400, 'invalid update');
    const task = queue.then(() => handle(update));
    queue = task.catch(() => {});
    await task;
    reply(200, 'ok');
  } catch {
    console.error('Webhook processing failed; Telegram may retry');
    reply(500, 'processing failed');
  }
});
server.requestTimeout = 30000;
server.listen(8080, '0.0.0.0', () => console.log('Webhook listening on :8080'));
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 20000).unref();
});
