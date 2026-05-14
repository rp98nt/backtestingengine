# Run API without installing Python on the host (Neon is the database).
# Build from repo root:  docker build -f backend/Dockerfile -t alphatest-api backend
# Run:  docker run --rm -p 8000:8000 -e DATABASE_URL="postgresql+asyncpg://..." alphatest-api
FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
# Enable C++ Contribution-1 MVP microbench when engine_native is built (see native_ext/).
ENV USE_NATIVE_ENGINE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY native_ext ./native_ext
RUN pip install --no-cache-dir ./native_ext

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
