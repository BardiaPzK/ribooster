# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime (nginx) ----
FROM nginx:1.27-alpine
RUN apk add --no-cache bash

# remove default site to avoid conflicts
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy built SPA
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy template (envsubst renders this on start)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Will be overridden by App Settings in Azure
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
