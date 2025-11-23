# ------------------------------
# 1) Frontend build
# ------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app

# Copy only package.json first
COPY frontend/package.json ./

# If package-lock.json exists, copy it. If not, ignore error.
# This avoids Docker failing when package-lock.json is missing.
COPY frontend/package-lock.json ./ || true

RUN npm install

# Copy full frontend source
COPY frontend/ .

RUN npm run build


# ------------------------------
# 2) Backend image
# ------------------------------
FROM python:3.11-slim AS backend
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source
COPY backend/ ./backend

# Copy frontend build output into backend/frontend-dist
COPY --from=frontend-build /app/dist ./frontend-dist

# Install Python deps
RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
