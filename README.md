# AlphaTest (backtestingengine)

Low-latency event-driven backtesting thesis stack: **Next.js** (UI) + **FastAPI** (API) + **Neon PostgreSQL** (data).  
Full product specification: [`doc/ALPHA_TEST_SPECIFICATION.md`](doc/ALPHA_TEST_SPECIFICATION.md).

**Chunk 1:** CSV import → Neon (`instruments`, `ohlcv_bars`) → Data Manager (`/data`) and paginated OHLCV table (`/data/[symbol]/table`).

**Chunk 2:** Event engine (ring buffer, naive / probabilistic fills, SMA crossover) → `POST /api/backtest/run` persists to Neon (`backtest_runs`) → Strategy runner (`/strategy`) and results (`/results/[id]`). The run endpoint completes the backtest in the same request (no background worker yet); the row is created first with `running`, then updated to `completed` or `failed`.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| **Node.js 18+** | Next.js (`npm run dev`, `npm run build`) |
| **Neon** | Postgres `DATABASE_URL` (no local Postgres in this repo) |
| **Python 3.12+** *or* **Docker Desktop** | Run the FastAPI backend |

---

## Environment variables

1. Copy [`.env.example`](.env.example) to **`backend/.env`** and set **`DATABASE_URL`** to your Neon URL using the **asyncpg** scheme:

   `postgresql+asyncpg://USER:PASSWORD@ep-....neon.tech/neondb?sslmode=require`

   (In the Neon console, copy the connection string and replace `postgresql://` with `postgresql+asyncpg://`.)

2. Copy `.env.example` to **`.env.local`** at the repo root (Next.js):

   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`

3. Optional — **`CORS_ORIGINS`** on the API (see `.env.example`): when the UI is on Vercel, list that origin so the browser can call your hosted API.

---

## Run the API (pick one)

### Option A — No Python on your PC (Docker only for the API)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another Docker engine). This image **does not** run a database; it connects to **Neon** using `DATABASE_URL`.

From the **repository root**:

```powershell
docker build -f backend/Dockerfile -t alphatest-api backend
docker run --rm -p 8000:8000 --env-file backend/.env alphatest-api
```

Then open `http://127.0.0.1:8000/docs` to confirm the API.

### Option B — Python on Windows (recommended for daily dev)

1. Install **Python 3.12** (64-bit) from [python.org](https://www.python.org/downloads/windows/) and tick **“Add python.exe to PATH”**, **or**:

   ```powershell
   winget install Python.Python.3.12
   ```

2. Open a **new** terminal and verify:

   ```powershell
   py -3.12 --version
   ```

3. Create a venv and install the backend:

   ```powershell
   cd backend
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

Health check (includes DB round-trip): `GET http://127.0.0.1:8000/api/health`

---

## Run the web app

From the **repository root**:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Data Manager** → import each file from `marketdata/` with the matching symbol key (HDFC, ICICI, …).

---

## CI

GitHub Actions runs `python -m compileall` on `backend/app` on each push/PR (`.github/workflows/backend-check.yml`).

---

## Repository

[https://github.com/rp98nt/backtestingengine](https://github.com/rp98nt/backtestingengine)
