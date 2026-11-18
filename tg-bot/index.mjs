import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const token = process.env.TELEGRAM_BOT_TOKEN;
const dataFile = resolve(process.env.WISHLIST_FILE ?? './tg-bot/data/wishlist.json');
const apiUrl = `https://api.telegram.org/bot${token}`;
const welcomeMessage =
  'Здравствуйте, мы ещё не запустили наше приложение, но Вы добавлены в wishlist! Мы будем держать Вас в курсе!';

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

async function loadUsers() {
  try {
    return JSON.parse(await readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveUser(user) {
  const users = await loadUsers();
  const existing = users.find((item) => item.telegramId === user.id);
  const now = new Date().toISOString();

  if (existing) {
    existing.username = user.username ?? null;
    existing.firstName = user.first_name ?? null;
    existing.lastName = user.last_name ?? null;
    existing.lastStartAt = now;
  } else {
    users.push({
      telegramId: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      createdAt: now,
      lastStartAt: now
    });
  }

  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(users, null, 2)}\n`);
}

async function telegram(method, body) {
  const response = await fetch(`${apiUrl}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result;
}

let offset = 0;
console.log('Telegram wishlist bot started');

while (true) {
  const updates = await telegram('getUpdates', { offset, timeout: 30 });
  for (const update of updates) {
    offset = update.update_id + 1;
    const message = update.message;
    if (!message?.from || !message.text?.startsWith('/start')) continue;
    await saveUser(message.from);
    await telegram('sendMessage', { chat_id: message.chat.id, text: welcomeMessage });
  }
}
