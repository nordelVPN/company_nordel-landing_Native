#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN in .env or the environment}"
: "${TELEGRAM_WEBHOOK_SECRET:?Set TELEGRAM_WEBHOOK_SECRET in .env or the environment}"

WEBHOOK_URL="${TELEGRAM_WEBHOOK_URL:-${NGROK_URL:-https://railcar-leggings-amicably.ngrok-free.dev}/webhook}"
WEBHOOK_URL="${WEBHOOK_URL%/}"
[[ "${WEBHOOK_URL}" == */webhook ]] || WEBHOOK_URL="${WEBHOOK_URL}/webhook"

API_URL="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

echo "Registering webhook: ${WEBHOOK_URL}"

curl --fail-with-body --silent --show-error \
  --request POST "${API_URL}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode "drop_pending_updates=true"

echo
echo
echo "Current webhook info:"

curl --fail-with-body --silent --show-error \
  "${API_URL}/getWebhookInfo"

echo
