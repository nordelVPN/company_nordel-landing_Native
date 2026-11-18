# Сайт и Telegram-бот в Docker Compose

## Состав

- site: production-сборка Webpack, раздаваемая Nginx на http://localhost:3000.
- bot: PHP 8.4, HTTP webhook на /webhook, проверка доступности на /health.
- ngrok: отдельный контейнер с HTTPS-туннелем к bot:8080.
- wishlist: именованный volume с /data/wishlist.json.

Compose использует tg-bot/webhook.php и общий модуль common.php. bot.php — альтернативный PHP-режим long polling; одновременно с webhook его запускать нельзя. Отдельной БД нет. Один экземпляр webhook последовательно обрабатывает запросы и атомарно заменяет JSON-файл. Для нескольких экземпляров нужна БД. Встроенный PHP HTTP-сервер используется для локального тестирования через ngrok; для production нужен PHP-FPM с Nginx или другой production-сервер.

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
- SITE_PORT — локальный порт сайта, по умолчанию 3000.

Секрет можно сгенерировать в PowerShell:

```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
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
В http://localhost:4040 скопируйте назначенный ngrok публичный HTTPS-адрес и используйте его вместо https://your-domain.ngrok-free.app во всех командах ниже.
Проверьте локальный и публичный HTTP-сервер бота:

```powershell
Invoke-WebRequest http://localhost:8080/health
Invoke-WebRequest https://your-domain.ngrok-free.app/health
```

Ожидается статус 200 и текст ok. Подставляйте публичный адрес из панели ngrok во все примеры.
Порт 8080 опубликован только на loopback для локальной диагностики; ngrok обращается к боту по внутренней сети Compose. Сайт через этот туннель не публикуется.

## Панель ngrok на localhost:4040

Откройте http://localhost:4040 после успешного запуска ngrok. Панель показывает публичный HTTPS-адрес туннеля и журнал HTTP-запросов с ответами, включая POST /webhook от Telegram.

Конфигурация docker/ngrok.yml задаёт agent.web_addr: 0.0.0.0:4040 внутри контейнера. Compose публикует панель только локально: 127.0.0.1:4040:4040. Публичный туннель по-прежнему направлен на bot:8080.

Чтобы применить эти настройки к существующему контейнеру:

```powershell
docker compose up -d --force-recreate ngrok
docker compose logs --tail 50 ngrok
Invoke-WebRequest http://localhost:4040
```

Скопируйте публичный адрес из панели для команды регистрации webhook ниже. После регистрации отправьте /start боту: в панели должен появиться POST /webhook с ответом 200.

Compose запускает ngrok без --url: dev domain аккаунта выбирается автоматически. NGROK_URL больше не требуется; оставшееся значение в .env не используется. При ERR_NGROK_313 после обновления Compose пересоздайте контейнер ngrok командой выше: старый контейнер может продолжать запускаться с --url. Для проверки аргументов выполните docker compose config --no-interpolate (без раскрытия токенов); в command сервиса ngrok не должно быть --url или --subdomain.

Если панель не открывается, проверьте логи ngrok и занятость локального порта 4040. Панель может содержать сообщения и секретный заголовок webhook; не публикуйте её через туннель.

## Подключение Telegram webhook

Регистрация выполняется явно, после запуска туннеля:

```powershell
docker compose exec bot php webhook-admin.php set https://your-domain.ngrok-free.app
docker compose exec bot php webhook-admin.php info
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
docker compose exec bot cat /data/wishlist.json
docker compose restart bot
```

Проверьте, что telegramId не повторяются. Повторите чтение файла после перезапуска: данные должны сохраниться.
Для проверки защиты запрос без секретного заголовка должен получить 403:

```powershell
curl.exe -i -X POST http://localhost:8080/webhook -H "Content-Type: application/json" --data "{}"
```

/health проверяет только HTTP-процесс. Это не проверка токена, доступности Telegram или записи в volume. Полный сценарий подтверждается реальным /start.

Telegram может повторить доставку после ошибки или таймаута. Пользователь сохраняется без дубликата, но приветствие при повторной доставке может прийти повторно. История обработанных update_id не хранится. JSON предназначен для небольшого тестового вишлиста.

## Переход с Node.js на PHP

Пересоберите bot и пересоздайте ngrok после его запуска:

```powershell
docker compose up -d --build bot
docker compose up -d --force-recreate ngrok
docker compose exec bot php -v
```

Данные остаются в том же volume wishlist, формат JSON сохранён. Не используйте down -v. Скопируйте текущий публичный URL из localhost:4040 и выполните set и info командами PHP выше. Старые команды node webhook-admin.mjs больше не применяются.

## Обновление, остановка и возврат к polling

```powershell
docker compose up -d --build
docker compose logs --tail 100 bot ngrok
docker compose down
```

down сохраняет volume. Команда down -v удаляет вишлист — не используйте её, если данные нужны.
Остановка контейнеров не удаляет webhook в Telegram.

Перед возвратом к PHP polling удалите webhook, пока bot работает:

```powershell
docker compose exec bot php webhook-admin.php delete
docker compose down
```

После этого запускайте php tg-bot/bot.php с переменными окружения TELEGRAM_BOT_TOKEN и WISHLIST_FILE. Pending updates при set/delete намеренно не удаляются.

## Диагностика

- Compose сообщает о переменной: заполните соответствующее поле .env.
- ngrok не подключается: проверьте authtoken и docker compose logs ngrok.
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
- Автоматический dev domain: https://ngrok.com/docs/gateway/domains

Эта инструкция описывает ручную проверку. Создание файлов само по себе не подтверждает сборку контейнеров и реальную доставку сообщений Telegram.
