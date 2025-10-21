FROM nginx:1.27-alpine

WORKDIR /app
COPY frontend/nginx.conf.template /app/nginx.conf.template
COPY frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENV BACKEND_URL=""
ENTRYPOINT ["/entrypoint.sh"]
