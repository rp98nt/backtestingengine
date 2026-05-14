# AlphaTest (backtestingengine)

Low-latency event-driven backtesting thesis stack: **Next.js** (UI) + **FastAPI** (API) + **Neon PostgreSQL** (data).  
Full product specification: [`doc/ALPHA_TEST_SPECIFICATION.md`](doc/ALPHA_TEST_SPECIFICATION.md).

**Chunk 1:** CSV import → Neon (`instruments`, `ohlcv_bars`) → Data Manager (`/data`) with **close-price sparklines** (chart preview via `GET /api/data/ohlcv/{symbol}`) and paginated OHLCV table (`/data/[symbol]/table`). Global **`SiteNav`** in the root layout links all primary routes.

**Chunk 2:** Event engine (ring buffer, naive / probabilistic fills, SMA crossover) → `POST /api/backtest/run` persists to Neon (`backtest_runs`) → Strategy runner (`/strategy`), results detail (`/results/[id]` with **equity SVG chart** + **₹ formatting** via `en-IN`), run index (`/results` via `GET /api/backtest/runs`), and **Backtest hub** (`/backtest`). **₹ previews** on strategy / compare / benchmark / live capital fields; compare-fills **currency** metrics use `formatComparisonMetric`. The run endpoint completes the backtest in the same request (no background worker yet); the row is created first with `running`, then updated to `completed` or `failed`.

**Chunk 2 (continued):** `POST /api/backtest/compare-fills` runs naive and probabilistic fills on the same data (two persisted runs sharing `comparison_group_id` in `request_config`). `POST /api/benchmark/run` runs the same backtest twice to compare **RingBuffer** vs **queue.Queue** throughput and average `get()` latency. UI: **`/strategy/compare`** (fills), **`/benchmark`** (Contribution 1), **`/showcase`** (SECTION 5.x walkthrough), **`/live`** (architecture + **`POST /api/live/start`** stub — in-memory session until WS replay ships).

### Hosted API timeouts (configure on your host)

If you deploy the API behind **strict request time limits** (e.g. some serverless tiers), **`/api/backtest/compare-fills`** and **`/api/benchmark/run`** can exceed the limit because they run **two** full passes over the data. Prefer a container/VM-style host with a generous timeout, **or** narrow `start_date` / `end_date` in the request body. The **single** `POST /api/backtest/run` is lighter.
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

3. Optional — **`CORS_ORIGINS`** on the API (see `.env.example`): required only if the browser calls your API **directly** via `NEXT_PUBLIC_API_BASE_URL` from a different origin.

### Deploy UI on Vercel (fixes “Failed to fetch” on `/data`)

The production build must **not** call `http://127.0.0.1:8000` from visitors’ browsers. If **`NEXT_PUBLIC_API_BASE_URL` is unset**, Vercel sets `VERCEL=1` and the app uses a **same-origin proxy** at **`/api/backend/...`**.

In **Vercel → Project → Settings → Environment Variables** (Production):

| Variable | Where | Value |
|----------|--------|--------|
| **`BACKEND_URL`** | Next.js (server) | Public **HTTPS** origin of your FastAPI app only, e.g. `https://your-api.example.com` (no `/api` suffix) |

Redeploy after saving. The UI will call `https://<your-vercel-app>/api/backend/api/...` and Next forwards to `BACKEND_URL`.

Alternatively, set **`NEXT_PUBLIC_API_BASE_URL`** to that same API origin and configure **`CORS_ORIGINS`** on FastAPI to include your Vercel URL (browser-direct mode).

Full stack integration (local + Render + Vercel): [`doc/DEPLOY_INTEGRATION.md`](doc/DEPLOY_INTEGRATION.md). Optional **Render Blueprint**: [`render.yaml`](render.yaml) at repo root. Local API with Docker: `docker compose up --build` from repo root (requires `backend/.env`). Optional **native (C++) engine** roadmap (GitHub-issue checklists): [`doc/ALPHA_TEST_SPECIFICATION.md`](doc/ALPHA_TEST_SPECIFICATION.md) → **SECTION 0.B**.

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
