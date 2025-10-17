# ---- Build SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- NGINX runtime ----
FROM nginx:1.27-alpine
RUN apk add --no-cache bash

# Copy built SPA
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx template (auto-rendered on start)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Normalize CRLF just in case
RUN sed -i 's/\r$//' /etc/nginx/templates/default.conf.template

# App Service will inject this at runtime, but set a sane default for local runs
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
