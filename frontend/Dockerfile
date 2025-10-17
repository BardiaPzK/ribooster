# ---- Build SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- NGINX runtime ----
FROM nginx:1.27-alpine

# add tools for debugging + sed
RUN apk add --no-cache bash dos2unix

# Copy built SPA
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx template and fix line endings
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
RUN dos2unix /etc/nginx/templates/default.conf.template && \
    cat -n /etc/nginx/templates/default.conf.template | head -15

# Optional default value for local run
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
