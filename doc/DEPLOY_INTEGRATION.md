# FastAPI ↔ Next.js integration (this repo)

The **website** (Next.js) and the **API** (FastAPI in `backend/`) are two processes. They integrate **over HTTP**: the UI calls `/api/...` routes that are implemented in Python. There is no “import FastAPI into React”; instead you **run both** and point the UI at the API (see `src/lib/apiBase.ts` and `src/lib/api.ts`).

## Architecture

| Piece | Role |
|-------|------|
| **Next.js** (Vercel) | Serves pages; on Vercel, `/api/backend/*` proxies to FastAPI when `BACKEND_URL` is set. |
| **FastAPI** (`backend/`) | CSV import, OHLCV, backtests, benchmark, live stub — uses Neon via `DATABASE_URL`. |
| **Neon** | Postgres for instruments, bars, and `backtest_runs`. |

## Local development

1. **Neon** — Create `backend/.env` from `.env.example` and set `DATABASE_URL` (`postgresql+asyncpg://…`).
2. **API** — From `backend/`: create venv, `pip install -r requirements.txt`, run  
   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`  
   Or from repo root: `docker compose up --build` (requires `backend/.env`).
3. **Web** — Repo root: copy `.env.example` → `.env.local` with  
   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`  
   Then `npm run dev`.
4. **Check** — `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/docs` (Swagger).

## Cloud: one public website URL

You need **three** cloud pieces: Vercel (UI) + hosted FastAPI + Neon.

### Step A — Deploy FastAPI (example: Render)

1. Push this repo to GitHub.
2. In [Render](https://render.com): **New → Blueprint** (or **Web Service**).
3. If using **Blueprint**, connect the repo; Render reads `render.yaml` at the root.
4. In the Render service **Environment**, set:
   - **`DATABASE_URL`** — full Neon URL with `postgresql+asyncpg://…`
   - Optionally **`CORS_ORIGINS`** — your Vercel site URL (comma-separated if several). Optional when using Vercel’s server-side proxy only.
5. Deploy. Note the service URL, e.g. `https://alphatest-api.onrender.com`.

**Smoke test:** open `https://<api-host>/api/health` — expect `status` ok and database connected.

### Step B — Point Vercel at the API

1. Vercel project → **Settings → Environment Variables**.
2. Set **`BACKEND_URL`** = `https://<api-host>` (no trailing slash, no `/api`).
3. Leave **`NEXT_PUBLIC_API_BASE_URL` unset** on Vercel so the app uses the same-origin proxy (`/api/backend/...`).
4. **Redeploy** the Next.js project.

### Step C — Verify from the browser (Vercel URL only)

- `/data` — instruments list, CSV import, table, sparklines  
- `/strategy`, `/results`, `/strategy/compare`, `/benchmark`, `/live`

## Alternative: browser → API directly

Set **`NEXT_PUBLIC_API_BASE_URL`** on Vercel to `https://<api-host>` and set FastAPI **`CORS_ORIGINS`** to include your Vercel origin. You can omit **`BACKEND_URL`** if you use this mode (not recommended unless you prefer explicit CORS over the proxy).

## Timeouts

Heavy routes (`/api/backtest/compare-fills`, `/api/benchmark/run`) can exceed **Vercel** or **free-tier** HTTP limits when proxied. Narrow date ranges or use plans with higher timeouts. See root `README.md`.

## Files reference

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | API image (installs `native_ext`, sets `USE_NATIVE_ENGINE=1`) |
| `backend/native_ext/` | C++17 `engine_native` (pybind11); `pip install ./native_ext` from `backend/` |
| `render.yaml` | Optional Render Blueprint for the API |
| `docker-compose.yml` | Optional local API via Docker |
| `src/app/api/backend/[[...path]]/route.ts` | Vercel → FastAPI proxy |
| `src/lib/apiBase.ts` | Chooses direct URL vs proxy vs localhost |
| `src/lib/api.ts` | All UI API calls |

## See also

- **Full native roadmap / remaining checklists:** `doc/ALPHA_TEST_SPECIFICATION.md` → **SECTION 0.B**.

**Shipped C++ MVP:** `backend/native_ext` builds the **`engine_native`** pybind11 module (ring buffer + bounded-deque burst microbench). The API **Dockerfile** compiles it and sets **`USE_NATIVE_ENGINE=1`**. Locally, from `backend/`: `pip install ./native_ext` (requires a **C++17** toolchain, e.g. MSVC Build Tools on Windows or `build-essential` on Linux). Set **`USE_NATIVE_ENGINE=false`** in `backend/.env` to omit the `cpp_native_mvp` block from `POST /api/benchmark/run` responses.

Use remaining `- [ ]` items in SECTION 0.B as GitHub Issues (label e.g. `native-engine`).

---

## Defence MVP — operator runbook (SECTION 0.A)

Follow in order. You supply Neon, CSVs, and (for public demo) cloud env vars.

### A. One-time setup

1. **Neon** — Create project; copy URI; use `postgresql+asyncpg://…` in **`backend/.env`** as **`DATABASE_URL`**.
2. **Local** — Copy `.env.example` → **`backend/.env`** (with `DATABASE_URL`). Copy → **`.env.local`** at repo root: **`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`** (or your public API URL for hosted UI + WebSocket).
3. **Python 3.12** — From `backend/`: venv, `pip install -r requirements.txt`, optional `pip install ./native_ext` (C++ toolchain). Run **`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`**.
4. **Next** — Repo root: `npm install`, `npm run dev`.

### B. Import five symbols

1. Open **`/data`**. Import CSVs for **HDFC**, **ICICI**, **RELIANCE**, **NIFTY50**, **NIFTYBANK** (symbol keys in the dropdown).
2. Confirm green confirmation after each import; open **View OHLCV table** for at least one symbol.

### C. Demo path (contributions)

1. **`/benchmark`** — Ring vs queue (optional C++ microbench block).
2. **`/strategy/compare`** — Naive vs probabilistic.
3. **`/strategy`** → **`/results/[id]`** — SMA backtest outcome.
4. **`/live`** — **Prepare replay session**, then **Open WebSocket stream**.  
   **Hosted UI:** set **`NEXT_PUBLIC_API_BASE_URL`** (or **`NEXT_PUBLIC_WS_BASE_URL`**) on Vercel to your **FastAPI wss://** origin; REST-only **`BACKEND_URL`** proxy does **not** upgrade WebSockets.

### D. Public deploy (optional)

1. Run API container with **`DATABASE_URL`**; note **`https://…`** API origin.
2. Vercel: **`BACKEND_URL`**, **`NEXT_PUBLIC_API_BASE_URL`** (same origin as API for WS), redeploy.

### E. Viva limits (honest)

- Backtest run is **synchronous HTTP** (no WS progress on `/strategy` yet).
- Live WS streams **precomputed subsampled equity** after one naive SMA run (MVP).
- Sessions are **in-memory** on one API worker.

