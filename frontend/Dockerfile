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

# Copy NGINX template to templates directory
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Environment variable consumed by NGINX template
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
