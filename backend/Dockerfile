FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY gunicorn_conf.py ./gunicorn_conf.py

# PORT 80 for Azure App Service (WEBSITES_PORT=80)
EXPOSE 80
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
