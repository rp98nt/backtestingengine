# AlphaTest (backtestingengine)

Low-latency event-driven backtesting thesis stack: **Next.js** (UI) + **FastAPI** (API) + **Neon PostgreSQL** (data).  
Full product specification: [`doc/ALPHA_TEST_SPECIFICATION.md`](doc/ALPHA_TEST_SPECIFICATION.md).

**Chunk 1:** CSV import → Neon (`instruments`, `ohlcv_bars`) → Data Manager (`/data`) with **close-price sparklines** (chart preview via `GET /api/data/ohlcv/{symbol}`) and paginated OHLCV table (`/data/[symbol]/table`). Global **`SiteNav`** in the root layout links all primary routes.

**Chunk 2:** Event engine (ring buffer, naive / probabilistic fills, SMA crossover) → `POST /api/backtest/run` persists to Neon (`backtest_runs`) → Strategy runner (`/strategy`), results detail (`/results/[id]` with **equity SVG chart** + **₹ formatting** via `en-IN`), run index (`/results` via `GET /api/backtest/runs`), and **Backtest hub** (`/backtest`). **₹ previews** on strategy / compare / benchmark / live capital fields; compare-fills **currency** metrics use `formatComparisonMetric`. The run endpoint completes the backtest in the same request (no background worker yet); the row is created first with `running`, then updated to `completed` or `failed`.

**Chunk 2 (continued):** `POST /api/backtest/compare-fills` runs naive and probabilistic fills on the same data (two persisted runs sharing `comparison_group_id` in `request_config`). `POST /api/benchmark/run` runs the same backtest twice to compare **RingBuffer** vs **queue.Queue** throughput and average `get()` latency. UI: **`/strategy/compare`** (fills), **`/benchmark`** (Contribution 1), **`/showcase`** (SECTION 5.x walkthrough), **`/live`** (architecture + **`POST /api/live/start`** stub — in-memory session until WS replay ships).

### Hosted API timeouts (configure on your host)

If you deploy the API behind **strict request time limits** (e.g. some serverless tiers), **`/api/backtest/compare-fills`** and **`/api/benchmark/run`** can exceed the limit because they run **two** full passes over the data. Prefer a container/VM-style host with a generous timeout, **or** narrow `start_date` / `end_date` in the request body. The **single** `POST /api/backtest/run` is lighter.

---

## Hosted stack (recommended — no local FastAPI)

Normative wording: **`doc/ALPHA_TEST_SPECIFICATION.md`** SECTION 0 **CLOUD-FIRST / HOSTED-ONLY**. Full steps: **[`doc/DEPLOY_INTEGRATION.md`](doc/DEPLOY_INTEGRATION.md)** § **Cloud-first workflow**.

1. **Neon** — `DATABASE_URL` with scheme **`postgresql+asyncpg://`**. Strip `?sslmode=…` / `channel_binding=…` from the URI ([`.env.example`](.env.example)); TLS for Neon is applied in `backend/app/database.py`.
2. **FastAPI** — Deploy **`backend/Dockerfile`** on [Render](https://render.com) (Blueprint: [`render.yaml`](render.yaml)), Railway, Fly.io, etc. Set **`DATABASE_URL`** in the host environment (Render dashboard when the blueprint marks the var `sync: false`).
3. **Smoke test** — `https://<your-api>/api/health` → `"database":"connected"`.
4. **Vercel** — Connect this repo; set **`BACKEND_URL`** = `https://<your-api>` (HTTPS origin only, no `/api`). For **`/live`** WebSockets, set **`NEXT_PUBLIC_API_BASE_URL`** or **`NEXT_PUBLIC_WS_BASE_URL`** (the server proxy does not upgrade WS). Redeploy.

**Defence MVP runbook** (imports, demo path): [`doc/DEPLOY_INTEGRATION.md`](doc/DEPLOY_INTEGRATION.md) → **Defence MVP — operator runbook** (Path 1 = cloud-first).

Optional **native (C++) engine** roadmap: [`doc/ALPHA_TEST_SPECIFICATION.md`](doc/ALPHA_TEST_SPECIFICATION.md) → **SECTION 0.B**.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| **Neon** | Postgres `DATABASE_URL` on the API host (no local Postgres in this repo) |
| **Container host + Vercel** | **Default path:** hosted FastAPI + hosted Next.js (no Python on your PC) |
| **Node.js 18+** | Optional: local `npm run dev` / `npm run build`; Vercel builds from Git without a local install |
| **Python 3.12+** *or* **Docker Desktop** | **Optional:** local Uvicorn or local Docker for the API |

---

## Environment variables

### Hosted API (Render, etc.)

Set on the **API host** (never commit secrets):

- **`DATABASE_URL`** — `postgresql+asyncpg://USER:PASSWORD@ep-....neon.tech/neondb` (no `sslmode` query params).
- **`CORS_ORIGINS`** — Your Vercel origin(s), comma-separated, **if** the browser calls the API directly. Omit if you only use the Vercel **`BACKEND_URL`** server-side proxy for REST.

### Vercel (Next.js)

| Variable | Purpose |
|----------|---------|
| **`BACKEND_URL`** | `https://<api-origin>` — REST via `/api/backend/...` proxy |
| **`NEXT_PUBLIC_API_BASE_URL`** | Optional; same API origin for browser-direct REST **and** `wss://` for **`/live`** |
| **`NEXT_PUBLIC_WS_BASE_URL`** | Optional; only if the WebSocket origin differs |

Visitors must never load `http://127.0.0.1:8000`. On Vercel, **`VERCEL=1`** + **`BACKEND_URL`** enables the same-origin proxy when **`NEXT_PUBLIC_API_BASE_URL`** is unset.

### Optional: local API + local Next

1. [`.env.example`](.env.example) → **`backend/.env`** with **`DATABASE_URL`** (same Neon rules).
2. `.env.example` → **`.env.local`**: **`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`**
3. **`CORS_ORIGINS`** on the API if the browser uses a different origin than the API.

Local API via Docker: `docker compose up --build` from repo root (requires `backend/.env`).

---

## Run the API locally (optional)

### Option A — Docker on your PC (no Python venv)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another Docker engine). Uses **`DATABASE_URL`** in `backend/.env`.

From the **repository root**:

```powershell
docker build -f backend/Dockerfile -t alphatest-api backend
docker run --rm -p 8000:8000 --env-file backend/.env alphatest-api
```

Then open `http://127.0.0.1:8000/docs`.

### Option B — Python venv on Windows

1. Install **Python 3.12** from [python.org](https://www.python.org/downloads/windows/) (tick **Add python.exe to PATH**) or `winget install Python.Python.3.12`.
2. `py -3.12 --version`
3. From **`backend/`**:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   pip install ./native_ext
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   Skip `pip install ./native_ext` without a C++ toolchain; set `USE_NATIVE_ENGINE=false` in `backend/.env`.

Health check: `GET http://127.0.0.1:8000/api/health`

---

## Run the web app locally (optional)

From the **repository root**:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Data Manager** → import from `marketdata/`. For a **fully hosted** demo, use your **Vercel URL** after deploy.

---

## CI

GitHub Actions runs `python -m compileall` on `backend/app` on each push/PR (`.github/workflows/backend-check.yml`).

---

## Repository

[https://github.com/rp98nt/backtestingengine](https://github.com/rp98nt/backtestingengine)
