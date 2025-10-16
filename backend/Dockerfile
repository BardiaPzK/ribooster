# backend/Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# App user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY app ./app
COPY gunicorn_conf.py ./gunicorn_conf.py

# Ports & env
ENV WEBSITES_PORT=80 \
    PORT=80

EXPOSE 80

# Health probe (optional)
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -fsS http://127.0.0.1:80/health || exit 1

USER appuser

# Run with gunicorn+uvicorn workers (Prod)
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
