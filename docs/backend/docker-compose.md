# Сайт и Telegram-бот в Docker Compose

## Состав

- site: production-сборка Webpack, раздаваемая Nginx на http://localhost:3000.
- bot: Node.js 22, HTTP webhook на /webhook, проверка доступности на /health.
- ngrok: отдельный контейнер с HTTPS-туннелем к bot:8080.
- wishlist: именованный volume с /data/wishlist.json.

Compose использует tg-bot/webhook.mjs. PHP-бот и index.mjs — альтернативные реализации с long polling; одновременно с webhook их запускать нельзя. Отдельной БД нет. Один экземпляр webhook последовательно обрабатывает запросы и атомарно заменяет JSON-файл. Для нескольких экземпляров нужна БД.

## Подготовка

Нужен Docker Desktop с Linux containers и Docker Compose v2.

Все команды выполняются из корня проекта. Примеры рассчитаны на PowerShell:

```powershell
Copy-Item .env.example .env
```

Заполните .env локально:
- TELEGRAM_BOT_TOKEN — токен тестового бота из BotFather.
- TELEGRAM_WEBHOOK_SECRET — случайная строка, 1–256 символов A–Z, a–z, 0–9, _ или -.
- NGROK_AUTHTOKEN — токен аккаунта ngrok.
- NGROK_URL — HTTPS dev domain из панели ngrok, например https://your-domain.ngrok-free.app.
- SITE_PORT — локальный порт сайта, по умолчанию 3000.

Секрет можно сгенерировать командой, если установлен Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

.env исключён из Git и Docker build context. Не добавляйте реальные токены в документацию, исходники или команды. Переменные контейнера доступны пользователям с доступом к Docker.

Адрес Telegram-бота в src/data/index.js, поле wishlist.telegramUrl, сейчас пуст. Для проверки перехода с сайта задайте https://t.me/USERNAME_БОТА и обновите wishlist.description, затем пересоберите site. Токен бота в frontend не передаётся.

## Сборка и запуск

```powershell
docker compose --env-file .env config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail 50 bot ngrok
```

Откройте http://localhost:3000 (либо порт SITE_PORT).
Проверьте локальный и публичный HTTP-сервер бота:

```powershell
Invoke-WebRequest http://localhost:8080/health
Invoke-WebRequest https://your-domain.ngrok-free.app/health
```

Ожидается статус 200 и текст ok. Подставляйте свой NGROK_URL во все примеры.
Порт 8080 опубликован только на loopback для локальной диагностики; ngrok обращается к боту по внутренней сети Compose. Сайт через этот туннель не публикуется.

## Подключение Telegram webhook

Регистрация выполняется явно, после запуска туннеля:

```powershell
docker compose exec bot node webhook-admin.mjs set https://your-domain.ngrok-free.app
docker compose exec bot node webhook-admin.mjs info
```

Скрипт добавляет /webhook к URL и передаёт Telegram secret_token. Входящие запросы проверяются по X-Telegram-Bot-Api-Secret-Token. Регистрация webhook меняет способ получения обновлений для указанного бота: используйте тестового бота, если основной уже работает в другом окружении.

Webhook не регистрируется автоматически при старте. После смены домена или секрета повторите set. После изменения .env пересоздайте контейнеры через docker compose up -d.

## Проверка сценария

1. Откройте главную и about.html, проверьте стили и окно вишлиста.
2. После настройки telegramUrl перейдите с сайта в Telegram.
3. Отправьте /start: бот должен ответить приветствием.
4. Повторите /start: ответ придёт снова, запись пользователя останется одна.
5. Проверьте состояние webhook: команда info выше; очередь должна опустеть, новых ошибок быть не должно.
6. Проверьте сохранение данных:

```powershell
docker compose exec bot node -e "const fs=require('node:fs'); const u=JSON.parse(fs.readFileSync('/data/wishlist.json','utf8')); console.log({users:u.length,uniqueIds:new Set(u.map(x=>x.telegramId)).size})"
docker compose restart bot
```

Повторите команду подсчёта после перезапуска: данные должны сохраниться.
Для проверки защиты запрос без секретного заголовка должен получить 403:

```powershell
curl.exe -i -X POST http://localhost:8080/webhook -H "Content-Type: application/json" --data "{}"
```

/health проверяет только HTTP-процесс. Это не проверка токена, доступности Telegram или записи в volume. Полный сценарий подтверждается реальным /start.

Telegram может повторить доставку после ошибки или таймаута. Пользователь сохраняется без дубликата, но приветствие при повторной доставке может прийти повторно. История обработанных update_id не хранится. JSON предназначен для небольшого тестового вишлиста.

## Обновление, остановка и возврат к polling

```powershell
docker compose up -d --build
docker compose logs --tail 100 bot ngrok
docker compose down
```

down сохраняет volume. Команда down -v удаляет вишлист — не используйте её, если данные нужны.
Остановка контейнеров не удаляет webhook в Telegram.

Перед возвратом к PHP/Node polling удалите webhook, пока bot работает:

```powershell
docker compose exec bot node webhook-admin.mjs delete
docker compose down
```

После этого запускайте только одну polling-реализацию. Pending updates при set/delete намеренно не удаляются.

## Диагностика

- Compose сообщает о переменной: заполните соответствующее поле .env.
- ngrok не подключается: проверьте authtoken, dev domain и docker compose logs ngrok.
- Сайт не открывается: проверьте SITE_PORT и docker compose logs site.
- /health работает, бот молчит: проверьте info, публичный URL, токен и секрет; убедитесь, что другой процесс не использует этого бота.
- 403 от /webhook: секреты не совпадают; пересоздайте bot и повторите set.
- 500 от /webhook: проверьте логи bot, доступ к Telegram и volume. Ошибки возвращаются Telegram для повторной доставки.
- JSON повреждён: восстановите данные из резервной копии; обработчик не заменяет повреждённый файл пустым.
- Образы используют обновляемые теги; для фиксированного окружения закрепите проверенные digest.

## Источники

- Telegram Bot API, setWebhook: https://core.telegram.org/bots/api#setwebhook
- Telegram, polling и webhook: https://core.telegram.org/bots/faq
- ngrok в Docker: https://ngrok.com/download/docker

Эта инструкция описывает ручную проверку. Создание файлов само по себе не подтверждает сборку контейнеров и реальную доставку сообщений Telegram.
