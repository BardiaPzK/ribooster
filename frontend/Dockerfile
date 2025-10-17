# ---- Build SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- NGINX runtime ----
FROM nginx:1.27-alpine

RUN apk add --no-cache bash dos2unix

# Copy built frontend
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy NGINX template
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Substitute environment variables into nginx config at startup
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

EXPOSE 80

# Optional default value (Azure will override)
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"
