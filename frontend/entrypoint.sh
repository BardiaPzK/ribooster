#!/usr/bin/env sh
set -eu
TEMPLATE="/etc/nginx/conf.d/default.conf.template"
TARGET="/etc/nginx/conf.d/default.conf"

: "${BACKEND_URL:?BACKEND_URL is required}"

echo "[entrypoint] Using BACKEND_URL=${BACKEND_URL}"
envsubst '$BACKEND_URL' < "$TEMPLATE" > "$TARGET"
nginx -t
exec nginx -g 'daemon off;'
