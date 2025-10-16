# frontend/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

# Require BACKEND_URL (e.g., https://ribooster-backend-app.azurewebsites.net)
: "${BACKEND_URL:?BACKEND_URL env is required}"

# Render nginx config
envsubst '${BACKEND_URL}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

nginx -g "daemon off;"
