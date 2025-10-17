# ---- Build SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- NGINX runtime ----
FROM nginx:1.27-alpine

# Add tools for debugging + env substitution
RUN apk add --no-cache bash dos2unix

# Copy built SPA
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx template
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Set environment variable (will be replaced by Azure)
ENV BACKEND_URL="https://ribooster-backend-app.azurewebsites.net"

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
