FROM node:22-alpine
WORKDIR /app
COPY tg-bot/webhook.mjs tg-bot/webhook-admin.mjs ./
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "webhook.mjs"]
