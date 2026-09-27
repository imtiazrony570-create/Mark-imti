# Fly.io Dockerfile for FastAPI backend
FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2, alembic, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Fly.io expects PORT env var
ENV PORT=8080

CMD ["python", "main.py"]