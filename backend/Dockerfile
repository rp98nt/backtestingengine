# Run API without installing Python on the host (Neon is the database).
# Build from repo root:  docker build -f backend/Dockerfile -t alphatest-api backend
# Run:  docker run --rm -p 8000:8000 -e DATABASE_URL="postgresql+asyncpg://..." alphatest-api
FROM python:3.12-slim-bookworm

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
