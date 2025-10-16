# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- NGINX runtime ----
FROM nginx:1.27-alpine
# optional tools (good for debugging)
RUN apk add --no-cache bash

# Copy built SPA
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy NGINX template to the *templates* directory (auto-rendered on start)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Env consumed by template
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
# Use default entrypoint; it will render /etc/nginx/templates/*.template -> /etc/nginx/conf.d/*.conf
# and then start nginx -g 'daemon off;'
