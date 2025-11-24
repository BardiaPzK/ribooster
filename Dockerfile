# ------------------------------
# 1) Frontend build
# ------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app

# Install frontend deps
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source
COPY frontend/ .
RUN npm run build

# ------------------------------
# 2) Backend image
# ------------------------------
FROM python:3.11-slim AS backend
WORKDIR /app

# Install ODBC drivers for pyodbc
RUN apt-get update && apt-get install -y --no-install-recommends \
    unixodbc \
    unixodbc-dev \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Backend source
COPY backend/ ./backend

# Built frontend
COPY --from=frontend-build /app/dist ./frontend-dist

# Python deps
RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
