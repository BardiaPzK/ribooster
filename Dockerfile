# ------------------------------
# 1) Frontend build
# ------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app

# Copy package.json (mandatory)
COPY frontend/package.json ./

# Copy package-lock.json ONLY IF IT EXISTS using a wildcard
# This does NOT fail if the file is missing
COPY frontend/*.json ./

RUN npm install

# Copy full frontend
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

# Copy backend
COPY backend/ ./backend

# Copy frontend build output
COPY --from=frontend-build /app/dist ./frontend-dist

# Install Python deps
RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
