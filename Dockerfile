# ------------------------------
# 1) Frontend build
# ------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ------------------------------
# 2) Backend image
# ------------------------------
FROM python:3.11-slim AS backend
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y build-essential && apt-get clean

# Copy backend
COPY backend/ ./backend

# Copy frontend build output into backend/frontend-dist
COPY --from=frontend-build /app/dist ./frontend-dist

# Install Python deps
RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
