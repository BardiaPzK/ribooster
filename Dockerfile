# syntax=docker/dockerfile:1

########################################
# Stage 1: build frontend with Vite
########################################
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install deps first (better cache)
COPY frontend/package*.json ./
RUN npm install

# Copy the rest of the frontend and build
COPY frontend/ .
RUN npm run build


########################################
# Stage 2: backend (FastAPI + Uvicorn)
########################################
FROM python:3.11-slim AS backend

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# System deps for pyodbc (and compiling wheels)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        unixodbc \
        unixodbc-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend into the location expected by main.py
# main.py uses FRONTEND_DIR = /app/frontend-dist
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
