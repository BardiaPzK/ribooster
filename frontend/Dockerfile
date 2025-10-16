# frontend/Dockerfile
# Build stage
FROM node:20-alpine as build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine
# envsubst for template replacement
RUN apk add --no-cache bash gettext
ENV WEBSITES_PORT=80
EXPOSE 80

# Copy artifacts
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:80/health || exit 1

CMD ["/entrypoint.sh"]
