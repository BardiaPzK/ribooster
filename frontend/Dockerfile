# frontend/Dockerfile
# Build the React app
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime with NGINX
FROM nginx:1.27-alpine
WORKDIR /
# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
# Template + entrypoint
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV BACKEND_URL=""
ENV WEBSITES_PORT=80
EXPOSE 80

CMD ["/entrypoint.sh"]
