# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:1.27-alpine

# envsubst for template rendering
RUN apk add --no-cache gettext

# static assets
COPY --from=build /app/dist/ /usr/share/nginx/html/

# our scripts/templates (exact paths you asked for)
COPY frontend/entrypoint.sh /frontend/entrypoint.sh
COPY frontend/nginx.conf.template /frontend/nginx.conf.template
RUN chmod +x /frontend/entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/frontend/entrypoint.sh"]
