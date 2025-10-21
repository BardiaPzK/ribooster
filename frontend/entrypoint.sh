#!/usr/bin/env bash
set -euo pipefail
: "${BACKEND_URL:?BACKEND_URL is required}"
envsubst '${BACKEND_URL}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf
nginx -g "daemon off;"
