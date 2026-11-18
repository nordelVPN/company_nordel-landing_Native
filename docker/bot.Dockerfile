FROM php:8.4-cli-alpine
WORKDIR /app
COPY tg-bot/common.php tg-bot/bot.php tg-bot/webhook.php tg-bot/webhook-admin.php ./
RUN addgroup -g 1000 bot && adduser -D -u 1000 -G bot bot \
    && mkdir /data && chown bot:bot /data
USER bot
EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "webhook.php"]
