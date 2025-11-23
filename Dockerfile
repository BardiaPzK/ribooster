# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Build backend
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system deps if needed later
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY backend/ ./backend

# Copy built frontend dist into container root
COPY --from=frontend-build /app/frontend/dist ./frontend_dist

# Install python requirements
RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
