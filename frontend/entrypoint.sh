#!/usr/bin/env sh
set -e
# Render template with BACKEND_URL into NGINX conf
envsubst '\' < /etc/nginx/templates/nginx.conf.tmpl > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'
