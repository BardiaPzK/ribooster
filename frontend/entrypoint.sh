# frontend/entrypoint.sh
#!/usr/bin/env bash
set -e

# Fail fast if BACKEND_URL missing
if [ -z "${BACKEND_URL}" ]; then
  echo "[entrypoint] ERROR: BACKEND_URL is not set"; exit 1
fi

echo "[entrypoint] Using BACKEND_URL=${BACKEND_URL}"

# Substitute env into nginx template -> real config
envsubst '${BACKEND_URL}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

# Static assets already placed in /usr/share/nginx/html by Dockerfile build stage
nginx -g 'daemon off;'
