#!/usr/bin/env bash
set -Eeuo pipefail

# Compatibility wrapper. Pass the public URL shown at http://localhost:4040.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -ne 1 ]]; then
  echo "Usage: bash tg-bot/set-webhook.sh https://YOUR-NGROK-DOMAIN" >&2
  exit 1
fi
php "${SCRIPT_DIR}/webhook-admin.php" set "$1"
php "${SCRIPT_DIR}/webhook-admin.php" info
