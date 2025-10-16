#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_URL:?BACKEND_URL env is required}"

# Render nginx config from template
envsubst '${BACKEND_URL}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

echo "----- Rendered /etc/nginx/nginx.conf -----"
cat /etc/nginx/nginx.conf
echo "------------------------------------------"

# Validate config and start
nginx -t
nginx -g "daemon off;"
