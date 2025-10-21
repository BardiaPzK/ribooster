#!/bin/sh
set -e

if [ -z "${BACKEND_URL}" ]; then
  echo "[entrypoint] ERROR: BACKEND_URL is not set"; exit 1
fi

echo "[entrypoint] Using BACKEND_URL=${BACKEND_URL}"

# Render our template (this path exists in your repo)
envsubst '${BACKEND_URL}' < /frontend/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Run nginx in foreground
exec nginx -g 'daemon off;'
