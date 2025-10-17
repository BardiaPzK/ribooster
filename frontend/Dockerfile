# ---- Build SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- NGINX runtime ----
FROM nginx:1.27-alpine

# optional tools
RUN apk add --no-cache bash

# Copy built SPA
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx template (auto-rendered on start)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Normalize line endings just in case the file was saved as CRLF on Windows
RUN sed -i 's/\r$//' /etc/nginx/templates/default.conf.template

# Env consumed by template at container start
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
# default entrypoint will render templates and start nginx
