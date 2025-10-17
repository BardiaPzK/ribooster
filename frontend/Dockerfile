# frontend/Dockerfile
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

# Copy static NGINX config (no templates/envsubst)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
