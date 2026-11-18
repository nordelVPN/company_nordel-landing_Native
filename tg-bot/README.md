# Telegram-бот на PHP

Бэкенд работает на PHP 8.4. Node.js нужен только для сборки сайта.

## Docker и webhook

Инструкция запуска и ручного тестирования: [docs/backend/docker-compose.md](../docs/backend/docker-compose.md).

- common.php — Telegram API, обработка /start и JSON-хранилище.
- webhook.php — HTTP-маршруты POST /webhook и GET /health.
- webhook-admin.php — CLI-команды set, info, delete.
- bot.php — альтернативный режим long polling.

В Compose бот слушает порт 8080, ngrok публикует его в интернете. Панель ngrok: http://localhost:4040.

После запуска зарегистрируйте публичный адрес:

```powershell
docker compose exec bot php webhook-admin.php set https://ВАШ-ДОМЕН
docker compose exec bot php webhook-admin.php info
```

Скрипт добавит /webhook и зарегистрирует секрет. Токен и секрет берутся из окружения контейнера.

## Long polling

Перед запуском polling удалите webhook командой php webhook-admin.php delete и остановите HTTP-бота. Затем запустите php tg-bot/bot.php с TELEGRAM_BOT_TOKEN и WISHLIST_FILE в окружении. Одновременно два режима не запускают.

При /start бот сохраняет telegramId, username, имя, фамилию и даты первого/последнего обращения, затем отправляет приветствие. Повторный /start не создаёт дубликат пользователя. Хранилище совместимо с прежним JSON.

## Ограничения

Встроенный PHP HTTP-сервер предназначен для локального тестирования. Для production используйте PHP-FPM с Nginx и БД с резервным копированием. Telegram может повторить доставку: пользователь сохранится один раз, приветствие может повториться.
