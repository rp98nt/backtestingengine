# FastAPI ↔ Next.js integration (this repo)

The **website** (Next.js) and the **API** (FastAPI in `backend/`) are two processes. They integrate **over HTTP**: the UI calls `/api/...` routes that are implemented in Python. There is no “import FastAPI into React”; instead you **run both** and point the UI at the API (see `src/lib/apiBase.ts` and `src/lib/api.ts`).

## Architecture

| Piece | Role |
|-------|------|
| **Next.js** (Vercel) | Serves pages; on Vercel, `/api/backend/*` proxies to FastAPI when `BACKEND_URL` is set. |
| **FastAPI** (`backend/`) | CSV import, OHLCV, backtests, benchmark, live stub — uses Neon via `DATABASE_URL`. |
| **Neon** | Postgres for instruments, bars, and `backtest_runs`. |

## Cloud-first workflow (no local FastAPI required)

You need **three** hosted pieces: **Neon** + **FastAPI** (container host) + **Vercel** (Next.js). You do **not** need Python or Uvicorn on your laptop for this path.

1. **Neon** — Create a project and a `DATABASE_URL` using scheme **`postgresql+asyncpg://`** (replace Neon’s `postgresql://`). **Strip** `?sslmode=…`, `channel_binding=…`, and other query params from the URI (`asyncpg` rejects them; TLS for `*.neon.tech` is set in `backend/app/database.py`).
2. **Deploy FastAPI** — Recommended: [Render](https://render.com) **New → Blueprint**, connect this GitHub repo; Render reads **`render.yaml`**. In the service **Environment**, set **`DATABASE_URL`** to the value from step 1 (Render marks it secret when `sync: false` — paste in the dashboard after first deploy if prompted). Optionally set **`CORS_ORIGINS`** to your Vercel site URL if you will call the API **directly** from the browser; omit if you use **`BACKEND_URL`** proxy only.
3. **Smoke test the API** — Open `https://<your-render-service>/api/health` in a browser. Expect `"status":"ok"` and `"database":"connected"`.
4. **Vercel** — Import the same repo (root = Next.js app per your Vercel settings). Under **Environment Variables** (Production): set **`BACKEND_URL`** = `https://<your-render-service>` (HTTPS origin only, no `/api` suffix). Leave **`NEXT_PUBLIC_API_BASE_URL` unset** if you want REST via the same-origin **`/api/backend/...`** proxy.
5. **WebSockets (`/live`)** — The Vercel proxy does **not** upgrade WebSockets. For hosted **`/live`**, set **`NEXT_PUBLIC_API_BASE_URL`** (or **`NEXT_PUBLIC_WS_BASE_URL`**) on Vercel to your **FastAPI HTTPS** origin so the browser opens **`wss://`** to the API. Set **`CORS_ORIGINS`** on FastAPI to include your Vercel origin when using browser-direct mode.
6. **Redeploy** the Vercel project after saving env vars.
7. **Verify** — Open your production site: `/data`, `/strategy`, `/results`, `/strategy/compare`, `/benchmark`, `/live` (WS needs `NEXT_PUBLIC_*` as in step 5).

**Alternative API hosts:** any platform that can run the **`backend/Dockerfile`** (Fly.io, Railway, Google Cloud Run, etc.) with **`DATABASE_URL`** and a public HTTPS URL — same Vercel wiring as above.

## Local development (optional)

Use this only when you want faster iteration on your machine.

1. **Neon** — Same as cloud-first step 1. Store the URL in **`backend/.env`** (gitignored) as **`DATABASE_URL`**.
2. **API** — From `backend/`: Python 3.12 venv, `pip install -r requirements.txt`, run  
   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`  
   Or from repo root: `docker compose up --build` (requires `backend/.env`).
3. **Web** — Repo root: copy `.env.example` → **`.env.local`** with  
   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`  
   Then `npm run dev`.
4. **Check** — `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/docs` (Swagger).

Render/Vercel env details are summarized in **Cloud-first workflow** above (steps 2–6 and **Alternative API hosts**).

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

### A. One-time setup (pick one path)

**Path 1 — Cloud-first (no local FastAPI)** — matches SECTION 0 **CLOUD-FIRST** clause:

1. **Neon** — Same as `doc/DEPLOY_INTEGRATION.md` § **Cloud-first workflow** step 1.
2. **Render (or other host)** — Deploy **`backend/Dockerfile`**; set **`DATABASE_URL`** on the host (not in `backend/.env` on your laptop unless you also use Docker locally). Confirm `https://<api>/api/health`.
3. **Vercel** — Set **`BACKEND_URL`**, **`NEXT_PUBLIC_API_BASE_URL`** / **`NEXT_PUBLIC_WS_BASE_URL`** for `/live` as in `doc/DEPLOY_INTEGRATION.md`. Redeploy.
4. **CSV imports** — Use the **hosted** site `/data` (no local `npm run dev` required if you edit only via Git push to Vercel).

**Path 2 — Local dev (optional)**

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

### D. Public deploy (when Path 2 was used locally first)

1. Run API container with **`DATABASE_URL`** on the host; note **`https://…`** API origin.
2. Vercel: **`BACKEND_URL`**, **`NEXT_PUBLIC_API_BASE_URL`** (same origin as API for WS), redeploy.

### E. Viva limits (honest)

- Backtest run is **synchronous HTTP** (no WS progress on `/strategy` yet).
- Live WS streams **precomputed subsampled equity** after one naive SMA run (MVP).
- Sessions are **in-memory** on one API worker.

