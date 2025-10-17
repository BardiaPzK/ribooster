# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime (nginx) ----
FROM nginx:1.27-alpine

# optional tools for debugging
RUN apk add --no-cache bash

# Replace default site with our built SPA
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy NGINX template (envsubst renders this at container start)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Default BACKEND_URL (overridden by App Service app setting)
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
# default entrypoint renders /etc/nginx/templates/*.template -> /etc/nginx/conf.d/*.conf and starts nginx
