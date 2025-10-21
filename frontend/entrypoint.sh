#!/usr/bin/env sh
set -eu

if [ -z "${BACKEND_URL:-}" ]; then
  echo "[entrypoint] ERROR: BACKEND_URL is not set" >&2
  exit 1
fi

# Render nginx from template
envsubst '$BACKEND_URL' < /app/nginx.conf.template > /etc/nginx/conf.d/default.conf

echo "[entrypoint] Using BACKEND_URL=$BACKEND_URL"
exec nginx -g 'daemon off;'
