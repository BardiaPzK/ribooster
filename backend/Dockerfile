# backend/Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Add curl for HEALTHCHECK (prevents "Application Error" due to failing healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY gunicorn_conf.py ./gunicorn_conf.py

ENV WEBSITES_PORT=80 \
    PORT=80
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -fsS http://127.0.0.1:80/health || exit 1

CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
