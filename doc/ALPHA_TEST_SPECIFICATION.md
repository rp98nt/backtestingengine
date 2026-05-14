You are an expert full-stack developer and quantitative finance engineer. 
Your task is to build a complete, end-to-end, production-quality web 
application called "AlphaTest" — a Low-Latency Event-Driven Backtesting 
Engine with a full-stack interface. This application is the practical 
deliverable of an MTech thesis titled "Design of a Low-Latency 
Event-Driven Backtesting Engine."

Read every instruction in this prompt completely before writing a single 
line of code. Every architectural decision, every component name, every 
API endpoint, every UI screen is specified here. Follow it exactly.

═══════════════════════════════════════════════════════════════════
SECTION 0 — DOCUMENT AUTHORITY, AMENDED STACK, DEPLOYMENT, DATA POLICY
═══════════════════════════════════════════════════════════════════

SINGLE SOURCE OF TRUTH (SSOT)
  - **Normative scope:** `doc/ALPHA_TEST_SPECIFICATION.md` is the sole authority for
    AlphaTest **behaviour**, **thesis claims**, **API/UI contracts**, **engine
    semantics**, and **acceptance** (incl. SECTION 0.A defence). Planning and code
    review MUST trace back to clauses herein.
  - **Non-normative adjuncts** (hosting commands, env var cheat-sheets, Render/Vercel
    wiring) MAY exist as `README.md` and `doc/DEPLOY_INTEGRATION.md`. They MUST NOT
    contradict SECTION 0–0.A for defence delivery and MUST defer product truth to
    this document. Optional **native (C++) engine** phasing lives in **SECTION 0.B**
    (checklists suitable for GitHub Issues).

AMENDED TECHNOLOGY & PLATFORM (SUPERSEDES INLINE STALE REFERENCES ELSEWHERE)
  - FRONTEND: **Next.js** (recommended: App Router with TypeScript `.tsx`).
    Prefer `fetch` plus native WebSocket APIs in the browser; Axios is optional.
    Existing screen names and behavioural requirements from later sections stay
    the same — map JSX pages to Route Handlers (`src/app/.../page.tsx`) or the
    project’s routing convention chosen at implementation time.
  - DEPLOYMENT: **Vercel** for hosting the Next.js UI. Configure build from the
    Next.js app directory and supply `NEXT_PUBLIC_API_BASE_URL` (and optional
    `NEXT_PUBLIC_WS_BASE_URL`) so REST and WebSocket clients point at the backend.
    NOTE: FastAPI + long-running backtests + WebSockets are NOT a typical
    one-click Vercel Python deployment — the **Python backend** MUST run on a
    separate host/process (Railway, Fly.io, Render, Docker/VPS, or similar) behind
    a stable HTTPS/WSS URL. The implementation phase MUST document operational
    env vars (DB URL, CORS, WS origins) only inside this specification when
    planning is finalized; **operational env summaries** MAY duplicate short tables
    in `README.md` / `doc/DEPLOY_INTEGRATION.md` per SECTION 0 SSOT.
  - METADATA DATABASE: **Neon PostgreSQL** accessed via SQLAlchemy (and an
    asynchronous driver suited to FastAPI workloads, e.g. `asyncpg` + Neon’s
    connection string). Persist metadata, instruments registry, optional job/run
    bookkeeping here. **SQLite is not used** anywhere in production design.
    For the **defence-ready CSV path** (SECTION 0.A), Neon also stores **row-level
    OHLCV** in a dedicated table for UI tables and engine ingestion—see SECTION 0.A.
    Parquet-backed OHLCV files may remain local or object-storage-backed per
    `storage.py` evolution at implementation for **non-defence** or scale-out paths
    — long-form `HistoricalDataHandler` text in SECTION 3 still applies when
    `storage_backend` is Parquet; DB-backed reading is **required** for SECTION 0.A.
  - THIRD-PARTY / SIGNUP POLICY:
    Prefer **only** OSS dependencies installed via npm/pypi with **no** vendor
    account, API dashboard, OAuth app, or billing gate. Exclude hosted analytics,
    SaaS dashboards, proprietary data vendors, trading venue APIs requiring
    keys, unless explicitly added later to this SAME document via a deliberate
    amendment subsection in SECTION 0. When a capability would otherwise require
    such integration complexity, defer to deterministic **in-app sample data**
    (see SAMPLE DATA MODEL below).
  APPROVED INFRASTRUCTURE EXCEPTION — **Neon PostgreSQL**: storing metadata in Neon
    is explicitly required herein and supersedes the general “signup avoidance” cue
    for application-level vendors (charts, brokerage APIs, SaaS telemetry, etc.).
    Only standard SQL/drivers + env `DATABASE_URL` are permitted — no Neon-specific SDK.

SAMPLE DATA MODEL (ALWAYS AVAILABLE, ZERO EXTERNAL ACCOUNTS)
  - Implement a deterministic **Synthetic OHLCV generator** callable from the
    backend (e.g. `backend/data/sample_generator.py` at implementation): given
    symbol keys, seed, dates, approximate volatility/trend knobs, emits Parquet-
    compatible series plausible for testing strategies/benchmark UI.
    **Charts, backtests, benchmarks, and WebSocket demos** MUST behave identically
    against synthetic vs real series — differing only by input provenance.
  - DATA MANAGER (SECTION 5 § DataManager page): Provide a conspicuous **UI toggle**
    (e.g. “Use deterministic sample OHLCV” vs “Attempt live network fetch”).
    Sample mode invokes the synthetic generator endpoint; offline/no-hassle runs
    NEVER block on Yahoo Finance/network.
  - **Thesis showcase** (`/showcase`, SECTION 5.x) preset runs MUST default to
    **SAMPLE** OHLCV **when no user instruments are loaded**; when **SECTION 0.A**
    CSV-imported instruments exist, showcase and strategy defaults MUST prefer
    those loaded symbols (committee demo on real supplied data).
  - **Optional** `yfetch`/`yfinance` path remains allowed as a supplementary
    code path ONLY because it normally requires **no signup** — but MUST NOT be
    the only way to onboard; startup behaviour (SECTION 7) is amended accordingly.

MAPPING NOTES (IMPLEMENTATION PHASE — DO NOT APPLY UNTIL AUTHORIZED)
  - React+Vite file paths in later sections are **logical names**; implement as
    Next.js `src/components/...`, `src/app/.../page.tsx`, client components as needed.
  - `localhost:5173` references are **obsolete**; local Next.js default is
    `http://localhost:3000` unless configured otherwise.

═══════════════════════════════════════════════════════════════════
SECTION 0.A — DEFENCE-READY DEMO SCOPE & CSV-FIRST DATA (MANDATORY PRIORITY)
═══════════════════════════════════════════════════════════════════

STATUS
  This section **supersedes breadth** (not correctness of thesis claims) for
  the **first shippable milestone** aimed at a **thesis defence demo**. All
  other sections remain the **long-form vision**; implementation MUST satisfy
  this section **first** for defence delivery. Items marked **DEFER** may be
  stubbed, omitted, or simplified until after defence unless listed as **REQUIRED**.

DEFINITION — “DEFENCE-READY”
  In ≤15 minutes of guided operation, the demo shows **all three contributions**
  using **operator-supplied OHLCV CSV files** for five securities (HDFC, ICICI,
  Reliance, Nifty 50, Nifty Bank—or equivalent symbol keys chosen once). Data MUST
  be **imported through the UI** (simple click / file pick), **persisted in Neon**
  (see schema below), and be **viewable in a dedicated data table** when the user
  opens the panel. Outputs must be **credible and reproducible** (no fabricated
  benchmark numbers). Critical path MUST NOT depend on external market APIs or
  paid vendors for the defence run.

NON-GOALS (DEFENCE MILESTONE)
  - Implementing every endpoint, WebSocket variant, chart, export, and polish item
    in SECTION 4–5 literally.
  - Full strategy suite parity (pairs trading + mean reversion tabs) unless time
    remains after REQUIRED items pass the acceptance checklist.
  - Production hardening beyond what is needed for a stable local/preview demo.

───────────────────────────────────────────────────────────────────
CSV IMPORT — “SIMPLE CLICK AND USE” (UI + BEHAVIOUR)  [REQUIRED]
───────────────────────────────────────────────────────────────────

PRIMARY USER STORY
  The operator has **up to five CSV files** (one per security). In **Data Manager**
  (`/data`), they MUST be able to **select a file with one click** (native file
  input or drag-and-drop zone—either is acceptable; **one obvious control** labelled
  e.g. “Import CSV”) and confirm import **without** manual SQL or server filesystem
  steps. After success, that security **immediately appears** in the loaded
  instruments list and is selectable everywhere else (strategy, backtest, charts).

SYMBOL MAPPING (REQUIRED)
  - On import, the UI MUST require (or offer with sensible default) a **stable
    symbol key** for each file, chosen from the defence set:
    `HDFC` | `ICICI` | `RELIANCE` | `NIFTY50` | `NIFTYBANK` (exact strings fixed in
    `showcaseContent.ts` / shared constants—adjust display labels only).
  - Re-importing the **same symbol key** MUST **replace** all prior OHLCV rows and
    metadata for that instrument (idempotent “latest upload wins”), with a
    confirmation toast.

CSV FORMAT (REQUIRED DEFAULTS + FLEXIBILITY)
  - **Expected columns** (case-insensitive header matching): `date` (or
    `timestamp` / `datetime`), `open`, `high`, `low`, `close`, `volume`.
  - Parser MUST trim BOM, coerce types, reject files missing required columns with
    a clear error message listing expected headers.
  - **Optional:** minimal column-mapping UI if headers differ (MVP: strict match +
    error; DEFER fancy mapper if time-critical).

DATABASE STORAGE — NEON (REQUIRED)
  All imported OHLCV MUST be stored **in PostgreSQL (Neon)**, not only on local
  disk, so the app can query and tabulate rows without re-parsing the CSV.

  **Table A — `instruments` (metadata, one row per security)**
  - `id` (PK, UUID or bigserial)
  - `symbol_key` (unique, text) — e.g. `HDFC`
  - `display_name` (text, nullable)
  - `source` (enum or text: `csv_import` | `sample` | `fetch`)
  - `first_bar_at`, `last_bar_at` (timestamptz)
  - `bar_count` (integer)
  - `created_at`, `updated_at`

  **Table B — `ohlcv_bars` (row-level OHLCV, separate from `instruments`)**
  - `id` (PK)
  - `instrument_id` (FK → `instruments.id`, ON DELETE CASCADE)
  - `bar_at` (timestamptz, session-normalised to UTC or naive-consistent)
  - `open`, `high`, `low`, `close` (numeric)
  - `volume` (numeric)
  - **Unique constraint:** (`instrument_id`, `bar_at`)
  - **Index:** (`instrument_id`, `bar_at` DESC) for chart + pagination APIs

  Raw CSV bytes MAY be discarded after successful parse (do **not** require
  keeping the original file on disk for defence). Optional `import_jobs` table
  is DEFER.

ENGINE & CHART READ PATH (REQUIRED FOR DEFENCE)
  - `HistoricalDataHandler` (or equivalent adapter) MUST support reading OHLCV
    **from Neon** into pandas (full load or chunked by date range acceptable for
    defence dataset sizes).
  - Long-form spec Parquet pipeline remains valid for **non-defence** scale-out;
    defence milestone does **not** require dual-writing to Parquet unless
    convenient—**Neon is canonical** for imported series in SECTION 0.A scope.

DATA TABLE PANEL (REQUIRED — “SEPARATE TABLE”)
  - On each instrument card (or instrument detail action), a control **“View OHLCV
    table”** opens a **separate** UI surface: **modal dialog**, **slide-over panel**,
    or **dedicated sub-route** `/data/[symbol]/table`—implementation choice, but it
    MUST NOT be the same compact sparkline area; it is a **tabular** view.
  - Table columns: **Timestamp, Open, High, Low, Close, Volume**.
  - **Server-side pagination** (e.g. 100 rows per page) via `GET` query params
    (`limit`, `offset` or cursor) backed by SQL `LIMIT/OFFSET` or keyset pagination.
  - Optional CSV export of the **currently filtered page** is DEFER.

API (REQUIRED MINIMUM — extends SECTION 4 `data.py` intent)
  - `POST /api/data/import-csv`  
    - **Multipart**: field `file` + field `symbol_key` (+ optional `display_name`).  
    - Validates, parses, writes `instruments` + `ohlcv_bars` in a **transaction**.  
    - Response: `{ "status": "success", "symbol": "...", "bars_imported": N }`
  - `GET /api/data/instruments` — unchanged intent; rows reflect DB.
  - `GET /api/data/ohlcv/{symbol}` — unchanged for charts; reads from `ohlcv_bars`.
  - `GET /api/data/ohlcv/{symbol}/table?limit=&offset=` — **new** endpoint returning
    `{ "symbol", "rows": [ ... ], "total_count" }` for the separate table panel.

───────────────────────────────────────────────────────────────────
REQUIRED — THESIS CONTRIBUTIONS (MUST DEMONSTRATE)
───────────────────────────────────────────────────────────────────

C1 — RING BUFFER VS STANDARD QUEUE (REAL MEASUREMENT)
  REQUIRED: real ring buffer + baseline `queue.Queue` wrapper; timing via
  `perf_counter_ns` (accumulated per `get()` as in SECTION 3); **`POST /api/benchmark/run`**.
  **Canonical defence UI — small Benchmark page:** route **`/benchmark`**
  (`src/app/benchmark/page.tsx`). **Procedure:** (1) Operator selects symbol, optional
  date range, SMA windows, and `fill_model` — **same JSON body shape** as
  `POST /api/backtest/run`. (2) **Run benchmark** submits to **`POST /api/benchmark/run`**.
  (3) Page displays **`ring_buffer` vs `standard_queue`** objects from the response
  (minimum fields: average latency ns, total time ms, throughput events/sec, total events)
  plus **≥1** comparative bar chart (latency and/or throughput). Loading and error states
  required. **`/showcase`** (SECTION 5.x.5) may repeat or deep-link this flow but **must
  not** be the only surface where C1 is reachable — **`/benchmark`** MUST be linked from
  the primary navigation or home flow.
  DEFER: “latency distribution over time” chart; extra hero rows beyond what the small page needs.

C2 — NAIVE VS PROBABILISTIC FILLS (REAL)
  REQUIRED: both models per spec semantics (no random slippage). Defence default
  strategy: **SMA crossover on one imported symbol** (recommend `HDFC`) for a simple
  story. Comparison via **`POST /api/backtest/compare-fills`** (preferred) or two
  `POST /api/backtest/run` calls with different `fill_model`. UI: long-form **`/fillmodel`**
  (SECTION 5) **or** a compact route such as **`/strategy/compare`** — same API contract.
  DEFER: exhaustive fill analytics beyond a tight comparison panel.

C3 — UNIFIED ARCHITECTURE (REAL + VISUAL)
  REQUIRED: historical vs live replay handler swap with identical strategy path;
  `ArchitectureDiagram` mode toggle; short live session with WebSocket updates
  (subset of message types acceptable).
  DEFER: full Live page richness if `/showcase` + slim `/live` suffices.

───────────────────────────────────────────────────────────────────
REQUIRED — MINIMUM UI ROUTES (NEXT.JS)
───────────────────────────────────────────────────────────────────

  - `/data` — CSV import (click-to-use) + instrument list + chart preview + **View
    OHLCV table** per instrument (separate table surface per above).
  - `/strategy` — **SMA-only** simplified configuration for defence default.
  - `/backtest` — run + progress (prefer WebSocket + async; document if temporary
    synchronous fallback is used only under strict time limits).
  - `/results` — equity + core metrics + compact trade table.
  - `/benchmark` — **required** small Benchmark page for **C1** (procedure under C1 above).
  - `/showcase` — condensed narrative + three CTAs (SECTION 5.x); supplements defence but
    does not replace **`/benchmark`** for C1.

DEFER UI: full pairs/mean-reversion builders, heatmaps, full export suite, deep polish.

───────────────────────────────────────────────────────────────────
REQUIRED — MINIMUM API (FASTAPI)  [DEFENCE SUBSET]
───────────────────────────────────────────────────────────────────

  REQUIRED: import + instruments + ohlcv + table pagination endpoints above;
  `POST /api/backtest/run` + `GET /api/backtest/result/{id}` (or documented sync return);
  `POST /api/backtest/compare-fills` (or dual-run client); `POST /api/benchmark/run`;
  minimal live start/stop/status; at least one WebSocket channel used by the demo.

DEFER: optional `GET /api/showcase/presets`, `GET /api/showcase/last-results`, yfinance
  fetch for defence-critical path.

───────────────────────────────────────────────────────────────────
ENGINE NON-NEGOTIABLES (DEFENCE)
───────────────────────────────────────────────────────────────────

  - Ring buffer per spec (preallocated array + bitwise index).
  - Fill models deterministic and rule-based.
  - SMA crossover only on actual cross; portfolio updates from fills.

ACCEPTABLE SIMPLIFICATIONS (DISCLOSE IN DEFENCE TALK)
  - Single-threaded engine narrative if true; minimal risk manager if invariants hold.

───────────────────────────────────────────────────────────────────
POLISH — DEFENCE MINIMUM
───────────────────────────────────────────────────────────────────

  REQUIRED: loading states for slow calls; clear errors on failed import; empty chart
  / table states; ₹ formatting on primary monetary outputs.
  DEFER: advanced reconnect UX, full table sorting, full CSV export of entire history.

───────────────────────────────────────────────────────────────────
ACCEPTANCE CHECKLIST (BINARY, PRE-DEFENCE)
───────────────────────────────────────────────────────────────────

  [ ] Each of the five CSVs imports via one-click UI; rows visible in separate table
      with pagination; symbols appear in dropdowns.
  [ ] Chart preview works for ≥2 imported symbols.
  [ ] SMA backtest completes on default symbol with plausible trade activity.
  [ ] Fill comparison shows non-trivial divergence vs naive.
  [ ] Benchmark shows expected directional advantage for ring buffer (repeat or
      document variance).
  [ ] Short live replay + WS + architecture diagram mode toggle.
  [ ] `/showcase` tells start→demo→limitations story without broken critical links.

───────────────────────────────────────────────────────────────────
POST-DEFENCE EXPANSION
───────────────────────────────────────────────────────────────────

  Re-enable DEFER items incrementally; optionally add Parquet dual-write, full
  SECTION 4–5 coverage, advanced importers, and the **optional C++ engine hot path**
  (SECTION 0.B)—without breaking SECTION 0 SSOT.

───────────────────────────────────────────────────────────────────
AMBIGUITIES — RESOLVE WITH OPERATOR IF NEEDED
───────────────────────────────────────────────────────────────────

  1. **Timestamp timezone:** if CSV dates are date-only (no TZ), treat as exchange
     **calendar dates** consistently (document assumption in UI help text).
  2. **Adjusted vs unadjusted prices:** defence assumes **as-given** OHLCV; corporate
     actions are out of scope unless CSVs are pre-adjusted by the operator.
  3. **Very large files:** if a CSV exceeds practical Neon row limits for demo
     hardware, cap import with a clear error or subsample—**document chosen limit**
     in SECTION 9 onboarding prose when set.

═══════════════════════════════════════════════════════════════════
SECTION 0.B — OPTIONAL NATIVE (C++) ENGINE HOT PATH (POST–DEFENCE / EXTENSION)
═══════════════════════════════════════════════════════════════════

STATUS
  **DEFER / EXTENSION.** The **canonical shipped implementation** for defence and
  core features remains the **Python** engine (`backend/app/engine/`, including the
  real list-backed `RingBuffer` and `StandardQueueWrapper` per SECTION 3 and the
  FINAL INSTRUCTION). This section defines an **optional** phased migration of
  **Contribution 1’s hottest slice** into **C++** while keeping **Neon I/O and
  persistence in Python** (SQLAlchemy / FastAPI) for incremental risk.

MVP SCOPE — “C++ RING + EVENT LOOP ONLY; DB IN PYTHON”
  - **Inside C++ (MVP):** fixed-capacity ring buffer matching SECTION 3 semantics
    (power-of-two capacity, head/tail, bitmask indexing, full/empty rules); tight
    **event dispatch loop** (dequeue → dispatch by event kind). Latency counters
    remain comparable to `time.perf_counter_ns()`-style accounting (C++
    `std::chrono::nanoseconds` or equivalent) so benchmark narratives stay honest.
  - **Stays in Python:** OHLCV and instrument **reads from Neon**, CSV import,
    request validation, **writing** `backtest_runs` / result payloads, CORS, route
    wiring. Python **marshals** bar batches into the native layer and **maps**
    returned structures onto existing persistence and JSON response shapes.

RATIONALE
  - Isolates **language-boundary** cost vs **microstructure** wins without rewriting
    the entire backend. Parity tests (below) gate flipping a runtime flag.

GITHUB ISSUES
  Each `- [ ]` item MAY become a GitHub Issue; suggested label: `native-engine`.
  Epic titles suggested: `native-n0-guardrails`, `native-n1-core`, … `native-n6plus`.

PHASE N0 — RESEARCH & GUARDRAILS
  - [ ] Profile representative `POST /api/backtest/run` (`py-spy` / `cProfile`);
        record % time in `RingBuffer.get`/`put` vs portfolio/strategy/ORM/JSON.
  - [ ] Write **parity contract** doc (inline in Issue or ADR pointer): float ε,
        deterministic seeds for probabilistic fills **while those modules remain
        in Python** in MVP.
  - [ ] Select FFI: **pybind11** (preferred) vs C ABI + `ctypes`; list target
        matrices (Render Linux prod, Windows dev).

PHASE N1 — C++ CORE LIBRARY (NO NEON, NO FASTAPI)
  - [ ] CMake project under `native/engine_core/` (path locked at implementation).
  - [ ] Implement `RingBuffer` + unit tests (Catch2 or GoogleTest) mirroring Python
        edge cases (wrap, full, empty, metrics).
  - [ ] Standalone micro-benchmark executable; capture ns/op for `get`/`put`.

PHASE N2 — C++ EVENT LOOP SKELETON
  - [ ] Port control flow from `backtesting_engine.py` into C++ ( dequeue loop,
        empty-buffer termination, equity sampling hooks as no-ops initially).
  - [ ] Feed golden **MarketEvent** sequence from file fixture; assert deterministic
        dequeue order.

PHASE N3 — PYTHON ↔ C++ MVP WIRING (DB STILL PYTHON)
  - [ ] pybind11 module: e.g. `run_native_event_replay(config, bars) -> dict` with
        stable schema agreed with `schemas.py`.
  - [ ] Python service loads bars via existing async DB layer, builds numpy/polars
        or raw buffers, invokes native replay, persists results using current
        SQLAlchemy paths.
  - [ ] Env flag `USE_NATIVE_ENGINE` default **0**; log branch at start of run.

PHASE N4 — PARITY, REGRESSION, BENCHMARK STORY
  - [ ] CI test: fixed seed + SMA + subset of bars → Python engine vs native MVP
        outputs within ε (equity length, trade count, final PnL band—tighten over time).
  - [ ] Extend `POST /api/benchmark/run` **or** add `POST /api/benchmark/native-micro`
        so **Python ring vs Python queue** (existing thesis UI) is **not** silently
        replaced by a cross-language comparison; any new hero metric ships with
        methodology copy in the Benchmark UI.

PHASE N5 — PACKAGING & OPS
  - [ ] Manylinux wheel build OR API Docker multi-stage (compiler image → runtime).
  - [ ] GitHub Action builds extension on `ubuntu-latest`; optional Windows matrix.
  - [ ] Document install fallbacks in `doc/DEPLOY_INTEGRATION.md` (non-normative).

PHASE N6+ — POST-MVP (OPTIONAL; REQUIRES SPEC AMENDMENT PER SUB-ITEM)
  - [ ] Move `ExecutionHandler` + fill models into C++ with shared RNG policy vs Python.
  - [ ] Move strategy signal path for SMA into C++ or document alternative (Numba).
  - [ ] Standalone C++ HTTP microservice **only** if profiling proves FFI dominates
        (second deployable—avoid unless necessary).

RELATIONSHIP TO OTHER SECTIONS
  - **SECTION 10:** Authoritative **Python full-stack** delivery order; SECTION 0.B
    forks **after** engine + API contracts are stable and MUST NOT block SECTION 0.A.
  - **SECTION 3 `RingBuffer` prose:** Normative **observable behaviour**; native code
    MUST match unless this document is amended with an explicit migration clause.
  - **CONTRIBUTION 1 (SECTION 1):** Claims remain architectural; C++ is an optional
    **performance realisation**, not a substitute for the Python reference until
    parity sign-off.

═══════════════════════════════════════════════════════════════════
SECTION 1 — PROJECT OVERVIEW & THESIS CONTEXT
═══════════════════════════════════════════════════════════════════

This application demonstrates three novel research contributions:

CONTRIBUTION 1 — Lock-Free Ring Buffer Event Queue
  The backtesting engine's core event loop uses a ring buffer 
  (circular array) for passing events between components instead 
  of Python's standard Queue. This eliminates lock contention and 
  reduces per-event processing latency. The application must 
  benchmark this against a standard queue-based approach and display 
  the latency comparison visually. An **optional** high-performance
  **C++** realisation of the same hot path is defined in **SECTION 0.B**
  (post-defence; DB and routes remain Python until explicitly migrated).

CONTRIBUTION 2 — Probabilistic Order Fill Simulation Model
  Instead of the naive assumption of filling orders at the next 
  bar's open or close price, the engine implements a realistic fill 
  model that incorporates bid-ask spread estimation, volume-
  proportional slippage, and partial fill simulation. The application 
  must allow the user to toggle between naive fills and the 
  probabilistic fill model and show the P&L difference side by side.

CONTRIBUTION 3 — Unified Research-to-Production Component 
Architecture
  The engine is built with swappable components behind clean 
  interfaces. The strategy code never changes whether running in 
  backtest mode or live simulation mode. Only the DataHandler and 
  ExecutionHandler components are swapped. The application must 
  visually demonstrate this by showing an architecture diagram 
  where components highlight depending on the active mode.

═══════════════════════════════════════════════════════════════════
SECTION 2 — TECHNOLOGY STACK
═══════════════════════════════════════════════════════════════════

BACKEND:
  - Language: Python 3.11+
  - Web Framework: FastAPI
  - WebSocket: FastAPI built-in WebSocket support
  - Data Processing: pandas, numpy
  - Data Storage: **Neon PostgreSQL** (via SQLAlchemy + async driver, e.g.
    `asyncpg`; connection string from `DATABASE_URL`) for **metadata and
    relational state**; Parquet files (via pyarrow) for OHLCV time series
    on disk (large bars / vectorised workloads).
  - Backtesting Engine: Custom **Python** implementation (detailed in Section 4),
    with an **optional post-defence** native hot path for Contribution 1 per **SECTION 0.B**
    (C++ ring + event loop MVP; DB remains Python/SQLAlchemy until later phases).
  - Performance Benchmarking: Python `time` module with nanosecond precision
    (`time.perf_counter_ns`); native branch MUST document timing methodology separately
    if mixed-language comparisons are exposed in UI.
  - Dependencies (core; minimise optional tiers):
    fastapi, uvicorn, pandas, numpy, pyarrow, sqlalchemy, asyncpg,
    scipy, python-multipart, aiofiles,
    statsmodels.
    OPTIONAL (no signup; network-bound): **yfinance**.
    Omit duplicate low-level websocket client libs if FastAPI/starlette WS stack suffices.

FRONTEND:
  - Framework: **Next.js** with **React** (App Router compatible with Vercel;
    Node target per Vercel defaults at implementation lock-in)
  - Language: TypeScript `.tsx`/`.ts` (maps JSX component names listed in SECTION 5)
  - Styling: TailwindCSS
  - Charts: Recharts
  - HTTP: Native `fetch` **or** axios (single choice per repo minimalist goal)
  - WebSocket: Native browser WebSocket API
  - Icons: lucide-react
  - State Management: React useState + useContext only (no Redux)
  - Typical npm dependencies inside the Next app:
    next, react, react-dom, tailwindcss, recharts, lucide-react, plus TS tooling.

PROJECT STRUCTURE:
  alphatest/
  ├── backend/
  │   ├── main.py                    # FastAPI app entry point
  │   ├── engine/
  │   │   ├── __init__.py
  │   │   ├── ring_buffer.py         # Lock-free ring buffer
  │   │   ├── event_queue.py         # Standard queue (baseline)
  │   │   ├── events.py              # Event type definitions
  │   │   ├── data_handler.py        # Historical data handler
  │   │   ├── live_data_handler.py   # Live/simulated feed handler
  │   │   ├── strategy.py            # Abstract strategy base class
  │   │   ├── strategies/
  │   │   │   ├── __init__.py
  │   │   │   ├── sma_crossover.py   # SMA Crossover strategy
  │   │   │   ├── pairs_trading.py   # Pairs trading strategy
  │   │   │   └── mean_reversion.py  # Mean reversion strategy
  │   │   ├── portfolio.py           # Portfolio manager
  │   │   ├── execution_handler.py   # Fill simulation
  │   │   ├── fill_models.py         # Naive vs probabilistic fills
  │   │   ├── risk_manager.py        # Position sizing and limits
  │   │   └── backtesting_engine.py  # Main engine orchestrator
  │   ├── api/
  │   │   ├── __init__.py
  │   │   ├── routes/
  │   │   │   ├── data.py            # Data management routes
  │   │   │   ├── backtest.py        # Backtest routes
  │   │   │   ├── benchmark.py       # Benchmark routes
  │   │   │   ├── live.py            # Live simulation routes
  │   │   │   └── showcase.py        # Optional thesis demo presets / snapshots
  │   │   └── websocket_manager.py   # WebSocket connection manager
  │   ├── models/
  │   │   ├── __init__.py
  │   │   ├── database.py            # SQLAlchemy: Neon + SECTION 0.A instruments/ohlcv_bars
  │   │   └── schemas.py             # Pydantic schemas
  │   └── data/
  │       ├── storage.py             # Data read/write utilities
  │       ├── sample_generator.py    # Deterministic OHLCV for UI sample mode
  │       └── fetcher.py             # Optional network fetch helper (Section 7)
  └── web/                          # Next.js app deployed to **Vercel**
      ├── package.json
      ├── next.config.*              # per scaffold
      ├── src/
      │   ├── app/                   # App Router / route segments
      │   │   ├── layout.tsx        # replaces legacy root App.jsx
      │   │   ├── page.tsx          # landing / redirect as designed
      │   │   ├── data/page.tsx
      │   │   ├── data/[symbol]/table/page.tsx  # optional; modal may substitute (SECTION 0.A)
      │   │   ├── strategy/page.tsx
      │   │   ├── backtest/page.tsx
      │   │   ├── results/page.tsx
      │   │   ├── benchmark/page.tsx   # SECTION 0.A C1 small page; optional long-form BenchmarkComparison content here or as tab/modal
      │   │   ├── fillmodel/page.tsx
      │   │   ├── live/page.tsx
      │   │   └── showcase/page.tsx # Thesis / defence walkthrough (SECTION 5.x)
      │   ├── showcase/
      │   │   └── showcaseContent.ts # copy, speaker bullets, preset labels (no extra .md)
      │   ├── components/
      │   │   ├── Layout/
      │   │   │   ├── Sidebar.tsx    # Sidebar.jsx analogue
      │   │   │   └── TopBar.tsx
      │   │   ├── Charts/
      │   │   │   ├── CandlestickChart.tsx
      │   │   │   ├── EquityCurveChart.tsx
      │   │   │   ├── DrawdownChart.tsx
      │   │   │   └── BenchmarkBarChart.tsx
      │   │   └── UI/
      │   │       ├── MetricCard.tsx
      │   │       ├── StatusBadge.tsx
      │   │       └── ArchitectureDiagram.tsx
      │   ├── context/
      │   │   └── AppContext.tsx    # analogue of AppContext.jsx
      │   └── services/
      │       ├── api.ts
      │       └── websocket.ts
      └── *tailwind / postcss configs per Next template*

  Repository documentation is ONLY this specification file (`doc/` single MD).

═══════════════════════════════════════════════════════════════════
SECTION 3 — BACKEND: ENGINE IMPLEMENTATION
═══════════════════════════════════════════════════════════════════

--- FILE: backend/engine/events.py ---

Define the following event classes as Python dataclasses:

class EventType(Enum):
  MARKET = "MARKET"
  SIGNAL = "SIGNAL"
  ORDER = "ORDER"
  FILL = "FILL"

@dataclass
class MarketEvent:
  type: EventType = EventType.MARKET
  symbol: str
  timestamp: datetime
  open: float
  high: float
  low: float
  close: float
  volume: float
  bid: float      # estimated bid = close - half_spread
  ask: float      # estimated ask = close + half_spread

@dataclass
class SignalEvent:
  type: EventType = EventType.SIGNAL
  symbol: str
  timestamp: datetime
  signal_type: str    # "LONG", "SHORT", "EXIT"
  strength: float     # 0.0 to 1.0, used for position sizing

@dataclass
class OrderEvent:
  type: EventType = EventType.ORDER
  symbol: str
  timestamp: datetime
  order_type: str     # "MARKET", "LIMIT"
  direction: str      # "BUY", "SELL"
  quantity: float
  limit_price: float = None

@dataclass
class FillEvent:
  type: EventType = EventType.FILL
  symbol: str
  timestamp: datetime
  direction: str
  quantity: float
  fill_price: float
  commission: float
  slippage: float

--- FILE: backend/engine/ring_buffer.py ---

Implement a RingBuffer class with the following specification:

class RingBuffer:
  """
  A pre-allocated circular buffer for event passing between 
  engine components. This is the core data structure for 
  Contribution 1 of the thesis.

  Implementation requirements:
  - Pre-allocate a fixed-size array of None values at init time.
    Size must be a power of 2 (default 4096).
  - Use two integer pointers: head (write position) and 
    tail (read position).
  - Use bitwise AND for modulo operation: 
    index = position & (size - 1)
    This is faster than the % operator.
  - put(event): write event to head position, advance head.
    Raise BufferFullError if (head - tail) >= size.
  - get(): read event from tail position, advance tail, 
    return event. Return None if buffer is empty.
  - is_empty(): return True if head == tail.
  - is_full(): return True if (head - tail) >= size.
  - size property: return number of items currently in buffer.
  - capacity property: return total allocated size.
  - Track the following metrics for benchmarking:
    total_puts: int (total events written)
    total_gets: int (total events read)
    total_processing_time_ns: int (nanoseconds)
    Record time taken for each get() call using 
    time.perf_counter_ns() and accumulate in 
    total_processing_time_ns.
  - Property average_latency_ns: return 
    total_processing_time_ns / total_gets if total_gets > 0
  """

Also implement a StandardQueueWrapper class that wraps 
Python's queue.Queue with the same interface as RingBuffer 
(put, get, is_empty, size, capacity, average_latency_ns) 
and tracks the same metrics. This is used as the baseline 
for benchmarking.

NORMATIVE NOTE — NATIVE REALISATION
  Until SECTION 0.B parity sign-off, the **reference** implementation MUST remain the
  Python list-backed buffer above. A future **C++** implementation MAY replace the
  internal storage mechanism while preserving the same **observable semantics**
  (capacity, errors, metrics); see SECTION 0.B.

--- FILE: backend/engine/fill_models.py ---

Implement two fill model classes:

class NaiveFillModel:
  """
  Fills every order at the next bar's open price with zero 
  slippage and a fixed commission of 0.1% of trade value.
  This represents how most basic backtesting engines work.
  """
  def calculate_fill(self, order: OrderEvent, 
                     market_event: MarketEvent) -> FillEvent:
    fill_price = market_event.open
    commission = fill_price * order.quantity * 0.001
    return FillEvent(
      symbol=order.symbol,
      timestamp=market_event.timestamp,
      direction=order.direction,
      quantity=order.quantity,
      fill_price=fill_price,
      commission=commission,
      slippage=0.0
    )

class ProbabilisticFillModel:
  """
  Realistic fill simulation. This is Contribution 2 of the thesis.
  
  Implementation requirements:

  1. BID-ASK SPREAD:
     - Buy orders fill at ask price (market_event.ask)
     - Sell orders fill at bid price (market_event.bid)
     - The bid and ask are pre-computed in MarketEvent as:
       bid = close - (close * spread_pct / 2)
       ask = close + (close * spread_pct / 2)
     - Default spread_pct = 0.001 (10 basis points)
       but this should be configurable per instrument.
  
  2. VOLUME-PROPORTIONAL SLIPPAGE:
     - Compute participation_rate = order.quantity / 
       market_event.volume
     - slippage_pct = slippage_factor * participation_rate
     - Default slippage_factor = 0.1
     - For BUY orders: fill_price = ask * (1 + slippage_pct)
     - For SELL orders: fill_price = bid * (1 - slippage_pct)
  
  3. PARTIAL FILL SIMULATION:
     - max_fillable_quantity = market_event.volume * 
       max_participation_rate
     - Default max_participation_rate = 0.05 (5% of bar volume)
     - If order.quantity > max_fillable_quantity:
         filled_quantity = max_fillable_quantity
         (remaining quantity is left as unfilled 
          and returned separately)
     - Else: filled_quantity = order.quantity
  
  4. INTRA-BAR PRICE CHECK FOR LIMIT ORDERS:
     - If order.order_type == "LIMIT":
       - For BUY: only fill if market_event.low <= 
         order.limit_price
       - For SELL: only fill if market_event.high >= 
         order.limit_price
       - If not touched, return None (no fill)
  
  5. COMMISSION:
     - commission = fill_price * filled_quantity * 0.001
  
  The calculate_fill method must return a tuple:
  (FillEvent or None, unfilled_quantity: float)
  """

--- FILE: backend/engine/data_handler.py ---

class HistoricalDataHandler:
  """
  Reads OHLCV data from Parquet files and generates 
  MarketEvents for each bar.

  Constructor parameters:
  - data_dir: str (path to directory containing parquet files)
  - symbols: List[str]
  - start_date: datetime
  - end_date: datetime
  - spread_pct: float = 0.001

  Methods:
  - load_data(): Load parquet files for all symbols into 
    a dict of DataFrames sorted by timestamp.
  - get_latest_bars(symbol, n=1): Return last n bars for symbol.
  - update_bars(): Advance one bar forward for all symbols.
    For each symbol, generate a MarketEvent and put it into 
    the ring buffer. Return False when all data is exhausted.
  - has_more_data(): Return True if any symbol has remaining bars.
  
  The handler iterates through timestamps in chronological order 
  across all symbols. At each timestamp step, it generates 
  MarketEvents for all symbols that have data at that timestamp 
  and puts them into the ring buffer.
  """

--- FILE: backend/engine/live_data_handler.py ---

class LiveDataHandler:
  """
  Simulates a live data feed by replaying historical data 
  with configurable speed multipliers. This is used for the 
  Live Simulation mode (Contribution 3 demonstration).
  
  Constructor parameters:
  - data_dir: str
  - symbols: List[str]
  - start_date: datetime
  - end_date: datetime
  - speed_multiplier: float = 10.0
    (10x means 10 bars per second instead of real-time)
  - spread_pct: float = 0.001

  Has the exact same interface as HistoricalDataHandler 
  (update_bars, get_latest_bars, has_more_data) so that 
  it can be swapped in without changing any other component.
  
  Additionally emits a WebSocket message for each bar 
  generated so the frontend can display the live price feed.
  
  This identical interface is the demonstration of 
  Contribution 3 — the unified architecture.
  """

--- FILE: backend/engine/strategy.py ---

class BaseStrategy(ABC):
  """
  Abstract base class for all strategies.
  
  Constructor parameters:
  - symbols: List[str]
  - ring_buffer: RingBuffer
  
  Abstract method:
  - calculate_signals(market_event: MarketEvent): 
    Analyse the market event and put zero or more 
    SignalEvents into the ring buffer.
  
  Utility methods available to all strategies:
  - get_bar_history(symbol, n): return last n bars 
    as a list of MarketEvents
  - All strategies store their own bar history by 
    appending each received MarketEvent.
  """

--- FILE: backend/engine/strategies/sma_crossover.py ---

class SMACrossoverStrategy(BaseStrategy):
  """
  Simple Moving Average Crossover Strategy.
  
  Constructor parameters (in addition to BaseStrategy):
  - short_window: int = 20  (fast SMA period)
  - long_window: int = 50   (slow SMA period)
  
  Logic:
  - Maintain a rolling price history for each symbol.
  - Compute short_sma = mean of last short_window closes
  - Compute long_sma = mean of last long_window closes
  - If short_sma crosses ABOVE long_sma (was below previous bar):
    Generate SignalEvent with signal_type="LONG", strength=1.0
  - If short_sma crosses BELOW long_sma (was above previous bar):
    Generate SignalEvent with signal_type="EXIT", strength=1.0
  - Only generate a signal when a crossover actually occurs, 
    not on every bar.
  - Requires at least long_window bars of history before 
    generating any signals.
  """

--- FILE: backend/engine/strategies/pairs_trading.py ---

class PairsTradingStrategy(BaseStrategy):
  """
  Statistical Arbitrage / Pairs Trading Strategy.
  
  Constructor parameters:
  - symbol_a: str   (e.g. "HDFCBANK.NS")
  - symbol_b: str   (e.g. "ICICIBANK.NS")
  - lookback_window: int = 60  (bars for computing mean/std)
  - entry_threshold: float = 2.0  (Z-score to enter trade)
  - exit_threshold: float = 0.5   (Z-score to exit trade)
  - stop_loss_threshold: float = 3.5 (Z-score stop loss)
  
  Logic:
  1. Maintain price history for both symbols.
  2. Compute hedge_ratio using OLS regression of symbol_a 
     prices on symbol_b prices over the lookback window.
     Use statsmodels OLS for this.
  3. Compute spread = price_a - hedge_ratio * price_b
  4. Compute z_score = (spread - mean(spread)) / std(spread)
     over the lookback window.
  5. Trading rules:
     - If z_score > entry_threshold and not in a trade:
       SHORT signal for symbol_a (strength = z_score/3)
       LONG signal for symbol_b (strength = z_score/3)
       Record current_position = "SHORT_SPREAD"
     - If z_score < -entry_threshold and not in a trade:
       LONG signal for symbol_a (strength = abs(z_score)/3)
       SHORT signal for symbol_b (strength = abs(z_score)/3)
       Record current_position = "LONG_SPREAD"
     - If abs(z_score) < exit_threshold and in a trade:
       EXIT signal for both symbols
       Record current_position = None
     - If abs(z_score) > stop_loss_threshold and in a trade:
       EXIT signal for both symbols (stop loss)
       Record current_position = None
  6. Also emit metadata with each signal:
     z_score, spread, hedge_ratio, current_position
     These are used for display in the frontend.
  """

--- FILE: backend/engine/strategies/mean_reversion.py ---

class MeanReversionStrategy(BaseStrategy):
  """
  Bollinger Band Mean Reversion Strategy.
  
  Constructor parameters:
  - symbol: str
  - window: int = 20
  - num_std: float = 2.0
  
  Logic:
  1. Compute rolling mean and std over last window bars.
  2. upper_band = mean + num_std * std
  3. lower_band = mean - num_std * std
  4. If close < lower_band: LONG signal (strength proportional 
     to how far below lower band)
  5. If close > upper_band: SHORT signal (strength proportional 
     to how far above upper band)
  6. If position is LONG and close > mean: EXIT signal
  7. If position is SHORT and close < mean: EXIT signal
  """

--- FILE: backend/engine/portfolio.py ---

class PortfolioManager:
  """
  Tracks all positions, cash, and portfolio value.
  
  Constructor parameters:
  - initial_capital: float = 1_000_000.0
  - ring_buffer: RingBuffer
  
  Internal state:
  - cash: float
  - positions: Dict[str, float]  (symbol -> quantity, 
    negative means short)
  - position_costs: Dict[str, float] (symbol -> avg cost)
  - equity_curve: List[Dict]  (list of 
    {timestamp, portfolio_value, cash, positions_value})
  - trade_log: List[Dict]  (every completed trade)
  - current_prices: Dict[str, float]
  
  Methods:
  - update_market_price(symbol, price): 
    Update current price for symbol.
  - process_fill(fill_event: FillEvent):
    Update positions and cash based on fill.
    For BUY: deduct cash, add to position quantity.
    For SELL: add cash, reduce position quantity.
    Record trade in trade_log.
  - calculate_portfolio_value(): 
    Return cash + sum(quantity * current_price 
    for each position).
  - generate_order(signal_event: SignalEvent) -> OrderEvent:
    Convert a signal into an order with position sizing.
    Position size = (initial_capital * signal.strength * 
    0.1) / current_price
    (Risk 10% of capital per trade, scaled by signal strength)
  - get_equity_curve(): Return equity_curve list.
  - get_performance_metrics(): Return dict with:
    - total_return: (final_value - initial_capital) / 
      initial_capital
    - sharpe_ratio: annualised Sharpe ratio computed from 
      daily returns
    - max_drawdown: maximum peak-to-trough decline
    - win_rate: percentage of profitable trades
    - total_trades: total number of completed trades
    - profit_factor: gross profit / gross loss
    - avg_trade_duration: average bars held per trade
  """

--- FILE: backend/engine/backtesting_engine.py ---

class BacktestingEngine:
  """
  Main engine orchestrator. Wires all components together 
  and runs the main event loop.
  
  Constructor parameters:
  - data_handler: HistoricalDataHandler or LiveDataHandler
  - strategy: BaseStrategy
  - portfolio: PortfolioManager
  - execution_handler: ExecutionHandler
  - ring_buffer: RingBuffer
  - websocket_callback: Optional[Callable] = None
    (async function that sends progress updates via WebSocket)
  
  Main method: run()
  
  Event loop logic:
  
  Step 1: Call data_handler.update_bars()
          This puts MarketEvents into the ring buffer.
  
  Step 2: Process all events currently in the ring buffer:
    While not ring_buffer.is_empty():
      event = ring_buffer.get()
      
      If event.type == MARKET:
        portfolio.update_market_price(event.symbol, 
          event.close)
        strategy.calculate_signals(event)
      
      If event.type == SIGNAL:
        order = portfolio.generate_order(event)
        ring_buffer.put(order)
      
      If event.type == ORDER:
        fill = execution_handler.execute_order(event, 
          last_market_event[event.symbol])
        if fill is not None:
          ring_buffer.put(fill)
      
      If event.type == FILL:
        portfolio.process_fill(event)
  
  Step 3: Record equity curve point.
  
  Step 4: If websocket_callback is set, call it with 
          current progress (percentage complete, 
          current portfolio value, latest signal if any).
  
  Step 5: Repeat from Step 1 until 
          data_handler.has_more_data() is False.
  
  Step 6: Return BacktestResult object containing:
    - equity_curve
    - trade_log
    - performance_metrics
    - ring_buffer.average_latency_ns
    - ring_buffer.total_puts
    - total_bars_processed
    - total_execution_time_ms
  
  Also implement: run_benchmark_comparison()
  This method runs the same backtest twice:
  Once using RingBuffer, once using StandardQueueWrapper.
  Records and returns latency metrics for both.
  Returns a BenchmarkResult object with:
  - ring_buffer_avg_latency_ns
  - standard_queue_avg_latency_ns
  - ring_buffer_total_time_ms
  - standard_queue_total_time_ms
  - ring_buffer_throughput_events_per_sec
  - standard_queue_throughput_events_per_sec
  - speedup_factor (standard / ring_buffer latency)
  """

═══════════════════════════════════════════════════════════════════
SECTION 4 — BACKEND: API ROUTES
═══════════════════════════════════════════════════════════════════

--- FILE: backend/api/routes/data.py ---

Implement the following REST endpoints:

GET /api/data/instruments
  Returns list of all instruments that have data loaded.
  Response: [{"symbol": "HDFCBANK.NS", "name": "HDFC Bank", 
              "start_date": "2020-01-01", 
              "end_date": "2024-01-01",
              "total_bars": 1000}]

  NOTE — **SECTION 0.A (defence CSV)** canonical endpoints for click-import:
  - `POST /api/data/import-csv` (multipart `file` + `symbol_key`) persists rows to
    Neon tables `instruments` + `ohlcv_bars` (schema in SECTION 0.A). Symbols in
    defence demo SHOULD use keys `HDFC`, `ICICI`, `RELIANCE`, `NIFTY50`, `NIFTYBANK`.
  - `GET /api/data/ohlcv/{symbol}/table?limit=&offset=` returns paginated rows for
    the **separate OHLCV table UI** (`total_count` + `rows[]`).

POST /api/data/fetch
  **Optional pathway** — free public OHLCV download (often network-bound /
  scraping-adjacent; no signup but may fail). Persist as Parquet.
  Request body: {
    "symbol": "HDFCBANK.NS",
    "start_date": "2020-01-01",
    "end_date": "2024-01-01",
    "interval": "1d"   // "1d", "1h", "5m"
  }
  Response: {"status": "success", "bars_fetched": 1000,
             "symbol": "HDFCBANK.NS"}

POST /api/data/generate-sample  (PRIMARY PATH aligned with SAMPLE toggle UI)
  Invokes deterministic `sample_generator`; writes parquet + Neon metadata hooks.
  Request body mirrors fetch (symbol/date/interval semantics) PLUS optional `"seed"` int.

GET /api/data/ohlcv/{symbol}
  Returns OHLCV data for charting.
  Query params: start_date, end_date, limit (default 500)
  Response: {"symbol": "HDFCBANK.NS", 
             "data": [{"timestamp": "...", "open": 1600.0, 
                       "high": 1650.0, "low": 1580.0, 
                       "close": 1620.0, "volume": 1000000}]}

GET /api/data/stats/{symbol}
  Returns summary statistics for the instrument.
  Response: {"symbol": "...", "mean": ..., "std": ..., 
             "min": ..., "max": ..., "total_return": ...}

--- FILE: backend/api/routes/backtest.py ---

POST /api/backtest/run
  Runs a full backtest. This is a long-running operation.
  Returns a backtest_id immediately, then sends progress 
  via WebSocket.
  Request body: {
    "strategy": "sma_crossover" | "pairs_trading" | 
                 "mean_reversion",
    "symbols": ["HDFCBANK.NS"],
    "start_date": "2020-01-01",
    "end_date": "2024-01-01",
    "initial_capital": 1000000,
    "fill_model": "naive" | "probabilistic",
    "strategy_params": {
      // strategy-specific parameters
      // for sma_crossover: 
      //   {"short_window": 20, "long_window": 50}
      // for pairs_trading: 
      //   {"symbol_a": "HDFCBANK.NS", 
      //    "symbol_b": "ICICIBANK.NS",
      //    "lookback_window": 60,
      //    "entry_threshold": 2.0,
      //    "exit_threshold": 0.5}
      // for mean_reversion: 
      //   {"window": 20, "num_std": 2.0}
    }
  }
  Response: {"backtest_id": "uuid-string", 
             "status": "started"}

GET /api/backtest/result/{backtest_id}
  Returns full results of a completed backtest.
  Response: {
    "backtest_id": "...",
    "status": "completed" | "running" | "failed",
    "config": {...},
    "performance_metrics": {
      "total_return": 0.234,
      "sharpe_ratio": 1.45,
      "max_drawdown": -0.123,
      "win_rate": 0.58,
      "total_trades": 47,
      "profit_factor": 1.8,
      "avg_trade_duration": 12.3
    },
    "equity_curve": [
      {"timestamp": "2020-01-02", 
       "portfolio_value": 1000000,
       "cash": 800000,
       "positions_value": 200000}
    ],
    "trade_log": [
      {"entry_time": "...",
       "exit_time": "...",
       "symbol": "HDFCBANK.NS", "direction": "LONG",
       "entry_price": 1600.0, "exit_price": 1650.0,
       "quantity": 100, "pnl": 5000.0,
       "commission": 165.0, "slippage": 12.0}
    ],
    "engine_metrics": {
      "total_events_processed": 50000,
      "avg_latency_ns": 1250,
      "total_execution_time_ms": 3400,
      "throughput_events_per_sec": 14700
    }
  }

POST /api/backtest/compare-fills
  Runs the same backtest twice — once with naive fills and 
  once with probabilistic fills — and returns both results 
  for side-by-side comparison.
  Request body: same as /api/backtest/run but without 
  fill_model field (it runs both automatically).
  Response: {
    "naive_result": { same structure as backtest result },
    "probabilistic_result": { same structure },
    "comparison": {
      "return_difference": 0.045,
      "sharpe_difference": 0.23,
      "phantom_gains_pct": 0.045,
      "avg_slippage_per_trade": 125.0,
      "total_extra_cost_probabilistic": 5850.0
    }
  }

--- FILE: backend/api/routes/benchmark.py ---

POST /api/benchmark/run
  Runs the benchmark comparison between RingBuffer and 
  StandardQueue on the same backtest configuration.
  Request body: same as backtest run.
  Response: {
    "ring_buffer": {
      "avg_latency_ns": 850,
      "total_time_ms": 1200,
      "throughput_events_per_sec": 25000,
      "total_events": 50000
    },
    "standard_queue": {
      "avg_latency_ns": 8500,
      "total_time_ms": 12000,
      "throughput_events_per_sec": 2500,
      "total_events": 50000
    },
    "speedup_factor": 10.0,
    "latency_reduction_pct": 90.0
  }

--- FILE: backend/api/routes/live.py ---

POST /api/live/start
  Starts a live simulation session.
  Request body: {
    "strategy": "pairs_trading",
    "symbols": ["HDFCBANK.NS", "ICICIBANK.NS"],
    "replay_start_date": "2023-01-01",
    "replay_end_date": "2023-12-31",
    "speed_multiplier": 10,
    "initial_capital": 1000000,
    "strategy_params": {...}
  }
  Response: {"session_id": "uuid", "status": "started"}

POST /api/live/stop/{session_id}
  Stops a running live simulation.

GET /api/live/status/{session_id}
  Returns current status and live P&L.

WebSocket endpoint: /ws/live/{session_id}
  Streams live events to the frontend:
  Messages sent:
  {
    "type": "price_update",
    "symbol": "HDFCBANK.NS",
    "timestamp": "...",
    "price": 1645.0,
    "bar": {"open":...,
       "high":...,
       "low":...,
       "close":...,
       "volume":...}
  }
  {
    "type": "signal",
    "symbol": "HDFCBANK.NS",
    "signal_type": "LONG",
    "timestamp": "...",
    "metadata": {"z_score": 2.3, "spread": 45.2}
  }
  {
    "type": "fill",
    "symbol": "...",
    "direction": "BUY",
    "quantity": 100,
    "fill_price": 1645.0,
    "timestamp": "..."
  }
  {
    "type": "portfolio_update",
    "portfolio_value": 1023500,
    "cash": 800000,
    "positions_value": 223500,
    "timestamp": "..."
  }

WebSocket endpoint: /ws/backtest/{backtest_id}
  Streams backtest progress:
  {
    "type": "progress",
    "percentage": 45.2,
    "current_portfolio_value": 1045000,
    "events_processed": 22600,
    "current_timestamp": "2021-06-15"
  }
  {
    "type": "completed",
    "backtest_id": "..."
  }

--- FILE: backend/api/routes/showcase.py ---

Optional routes to keep demo copy and named presets **server-authoritative**
(MVP may hardcode presets in `showcaseContent.ts` instead — if so, omit file
and routes until needed).

GET /api/showcase/presets
  Response: {
    "presets": [
      {
        "id": "benchmark_small",
        "title": "Contribution 1 — quick benchmark",
        "description": "...",
        "request_body": { /* same shape as POST /api/benchmark/run */ }
      },
      {
        "id": "fill_compare_standard",
        "title": "Contribution 2 — fill comparison",
        "request_body": { /* same shape as POST /api/backtest/compare-fills */ }
      },
      {
        "id": "live_short",
        "title": "Contribution 3 — short live replay",
        "request_body": { /* same shape as POST /api/live/start */ }
      }
    ]
  }

GET /api/showcase/last-results
  Returns most recently completed **stored** summary handles for inline
  snapshot section (implementation may return nulls if nothing persisted):
  {
    "benchmark_job_id": null,
    "fill_comparison_job_id": null,
    "live_session_id": null
  }

--- FILE: backend/main.py ---

Set up FastAPI application:
- Include all routers with prefix /api (data, backtest, benchmark, live,
  and **showcase** when `showcase.py` is implemented)
- Add CORS middleware allowing all origins 
  (for local development)
- Mount WebSocket routes
- On startup, create data directory if not exists
- Run with uvicorn on port 8000

═══════════════════════════════════════════════════════════════════
SECTION 5 — FRONTEND: PAGES AND COMPONENTS
═══════════════════════════════════════════════════════════════════

The frontend is a single-page application with a persistent 
left sidebar for navigation and a top bar showing the 
application name and current mode.

OVERALL VISUAL DESIGN:
- Dark theme throughout
- Background: #0f172a (slate-900)
- Card background: #1e293b (slate-800)
- Border color: #334155 (slate-700)
- Primary accent: #3b82f6 (blue-500)
- Success color: #22c55e (green-500)
- Danger color: #ef4444 (red-500)
- Warning color: #f59e0b (amber-500)
- Text primary: #f1f5f9 (slate-100)
- Text secondary: #94a3b8 (slate-400)
- All cards have rounded-xl, subtle shadow, 
  and a 1px border

--- PAGE: DataManager.jsx ---

This page has the following sections:

SECTION A — Fetch New Data:
  - Global mode toggle: **Deterministic SAMPLE** generation vs network **FETCH**
    (SECTION 0 / SECTION 7). SAMPLE calls the backend generator endpoints; FETCH
    uses optional free-market pull when available.

  In FETCH mode — form fields:
  - Symbol input (text field with placeholder 
    "e.g. HDFCBANK.NS, ICICIBANK.NS")
  - Start Date (date picker)
  - End Date (date picker)
  - Interval (dropdown: "1d Daily", "1h Hourly", "5m 5-Minute")
  - Fetch Data button (calls POST /api/data/fetch)

  In SAMPLE mode — analogous generation action (explicit button) invokes the
    synthetic pipeline for the declared symbols/date span without third-party signup.

  - Shows a loading spinner during operations
  - Shows success/error toast notification on completion

SECTION B — Loaded Instruments:
  A grid of instrument cards showing all loaded data.
  Each card displays:
  - Symbol name (large, bold)
  - Date range loaded
  - Number of bars
  - A small sparkline of the close price 
    (last 50 bars, using Recharts LineChart)
  - **View OHLCV table** button — opens the **separate paginated table** (modal,
    slide-over, or `/data/[symbol]/table`) backed by `GET /api/data/ohlcv/{symbol}/table`
    per SECTION 0.A / SECTION 4 NOTE.
  - View Chart button

When View Chart is clicked:
  Show a full candlestick chart of the instrument below 
  the grid. The chart must show:
  - Candlestick bars (green for bullish, red for bearish)
  - Volume bars at the bottom
  - Date range selector (1M, 3M, 6M, 1Y, ALL buttons)
  - Instrument name and current price at the top

SECTION C — CSV import (defence-first; full behaviour in SECTION 0.A):
  - **Primary path for thesis data:** conspicuous **“Import CSV”** control (native
    file picker and/or drag-and-drop). Operator selects one of the five **fixed
    symbol keys** then attaches **one CSV** per import action (repeat five times
    for five files—acceptable MVP; DEFER multi-file single action unless time allows).
  - Single primary **Import** button per row: **click → validate → persist to Neon
    (`instruments` + `ohlcv_bars`) → toast → card appears in SECTION B**.
  - Link to short in-UI help: expected columns (`date`, `open`, `high`, `low`,
    `close`, `volume` case-insensitive) per SECTION 0.A.

--- PAGE: StrategyBuilder.jsx ---

This page has three tabs, one for each strategy.

TAB 1 — SMA Crossover:
  Left panel — Parameter configuration:
  - Symbol selector (dropdown of loaded instruments)
  - Short Window slider (5 to 50, default 20)
  - Long Window slider (20 to 200, default 50)
  - Initial Capital input (default 1,000,000)
  - Fill Model toggle (Naive / Probabilistic) — 
    this toggle is visually prominent with a label 
    explaining what each means
  
  Right panel — Strategy explanation:
  - Title: "Simple Moving Average Crossover"
  - Plain English description of the strategy
  - A static diagram showing two lines crossing
  - Current parameter summary

TAB 2 — Pairs Trading:
  Left panel — Parameter configuration:
  - Symbol A selector
  - Symbol B selector
  - Lookback Window slider (20 to 120, default 60)
  - Entry Z-Score threshold slider (1.0 to 3.0, default 2.0)
  - Exit Z-Score threshold slider (0.0 to 1.0, default 0.5)
  - Stop Loss Z-Score slider (2.5 to 5.0, default 3.5)
  - Initial Capital input
  - Fill Model toggle
  
  Right panel — Strategy explanation:
  - Title: "Statistical Arbitrage — Pairs Trading"
  - Plain English description with emphasis on HDFC/ICICI 
    example
  - Shows a live cointegration preview: when both symbols 
    are selected, call GET /api/data/ohlcv for both and 
    plot the spread and Z-score in a small chart

TAB 3 — Mean Reversion:
  Similar layout with Bollinger Band parameters.
  Right panel shows a preview chart with Bollinger Bands 
  plotted on the price chart of the selected symbol.

At the bottom of all tabs:
  A prominent "Run Backtest" button that saves the 
  configuration to AppContext and navigates to 
  BacktestRunner page.

--- PAGE: BacktestRunner.jsx ---

This page shows the live progress of a running backtest.

Layout:
  Top section — Configuration summary (read only):
  Shows the strategy name, symbols, date range, 
  fill model selected, and initial capital.

  Middle section — Live Progress:
  - Large progress bar (animated, shows percentage)
  - Current date being processed
  - Events processed counter (animates up in real time 
    via WebSocket)
  - Current portfolio value (updates in real time)
  - A small live equity curve chart that builds bar by bar 
    as the WebSocket sends updates (use Recharts 
    LineChart with streaming data)
  
  Bottom section — Engine Metrics (live):
  Four metric cards showing in real time:
  - Events Processed
  - Average Latency (ns)
  - Throughput (events/sec)
  - Elapsed Time (ms)

On WebSocket message type "completed":
  Show a "View Results" button that navigates to 
  ResultsDashboard.

On page load:
  Automatically start the backtest using the configuration 
  stored in AppContext by calling POST /api/backtest/run 
  and connecting to the WebSocket.

--- PAGE: ResultsDashboard.jsx ---

This is the main results page. It has four sections:

SECTION 1 — Performance Metrics Row:
  Seven metric cards in a horizontal row:
  - Total Return (percentage, green if positive, red if negative)
  - Sharpe Ratio (color coded: green > 1.0, amber 0-1, red < 0)
  - Max Drawdown (always red, shows percentage)
  - Win Rate (percentage)
  - Total Trades (count)
  - Profit Factor (ratio)
  - Avg Trade Duration (bars)

SECTION 2 — Charts Row (two columns):
  Left: Equity Curve Chart
    - LineChart showing portfolio value over time
    - A second line showing benchmark (buy and hold) 
      for comparison
    - Tooltip showing exact value and date on hover
    - Shaded area below the equity curve line
  
  Right: Drawdown Chart
    - Area chart showing drawdown percentage over time
    - Filled with red, shows the depth and duration 
      of each drawdown period

SECTION 3 — Trade Analysis:
  Left: Trade Distribution
    - Bar chart showing P&L distribution 
      (profit/loss per trade as a histogram)
  
  Right: Monthly Returns Heatmap
    - A grid showing month × year
    - Each cell colored green (profitable) or red (losing)
    - Cell value shows monthly return percentage

SECTION 4 — Trade Log Table:
  A full-width scrollable table showing every trade:
  Columns: Entry Time, Exit Time, Symbol, Direction, 
           Entry Price, Exit Price, Quantity, Gross P&L, 
           Commission, Slippage, Net P&L
  - Rows are colored light green for profitable trades 
    and light red for losing trades
  - Sortable columns
  - Export to CSV button

--- PAGE: BenchmarkComparison.jsx ---

**Defence minimum vs full page:** SECTION 0.A defines the **small `/benchmark`** page
(procedure + minimum metrics + one bar chart). This JSX page name is the **full**
Benchmark Comparison layout for thesis polish; implement **0.A first**, then extend
here. Row 3 “latency distribution” and extra charts are **DEFER** until the small page is stable.

This page demonstrates Contribution 1 — the ring buffer 
latency advantage. It is the most technically important 
page for the thesis.

Layout:

TOP SECTION — Run Benchmark:
  A button "Run Benchmark Comparison" that calls 
  POST /api/benchmark/run using the last backtest 
  configuration **or** explicit form fields — **same JSON body** as
  `POST /api/backtest/run` (SECTION 0.A). Shows a loading state while running.

RESULTS SECTION (shown after benchmark completes):

Row 1 — Hero Metrics (side by side, very large text):
  LEFT CARD — Ring Buffer (your engine):
  - Background: dark blue tint
  - Label: "Lock-Free Ring Buffer" 
  - Sub-label: "Your Engine (Thesis Contribution 1)"
  - Average Latency: e.g. "850 ns" (very large font)
  - Throughput: "25,000 events/sec"
  - Total Time: "1,200 ms"
  
  VS (centered between the two cards)
  
  RIGHT CARD — Standard Queue:
  - Background: dark gray tint
  - Label: "Standard Blocking Queue"
  - Sub-label: "Baseline (Python queue.Queue)"
  - Average Latency: e.g. "8,500 ns"
  - Throughput: "2,500 events/sec"
  - Total Time: "12,000 ms"

Row 2 — Speedup Banner:
  A prominent banner showing:
  "Your Ring Buffer is 10x FASTER"
  "90% reduction in average event processing latency"
  
Row 3 — Visual Charts (three charts):
  Chart 1: Latency Comparison Bar Chart
    Two bars — Ring Buffer vs Standard Queue — 
    showing average latency in nanoseconds.
    The Ring Buffer bar should be dramatically shorter.
  
  Chart 2: Throughput Comparison Bar Chart
    Two bars showing events per second.
    Ring Buffer bar should be dramatically taller.
  
  Chart 3: Latency Distribution Chart
    A line chart showing latency over time 
    (every 1000 events, record the batch latency)
    Two lines — one for each approach.
    Shows that Ring Buffer has lower jitter 
    (more consistent latency) in addition to lower average.

Row 4 — Explanation Panel:
  A collapsible panel with heading 
  "Why is the Ring Buffer Faster?"
  Contains a plain English explanation of:
  - Lock contention in standard queues
  - Cache-friendly memory layout in ring buffer
  - Pre-allocation eliminating GC pressure
  - Mechanical sympathy principle

--- PAGE: FillModelComparison.jsx ---

This page demonstrates Contribution 2 — the realistic 
fill simulation advantage.

TOP SECTION — Run Comparison:
  Button "Run Fill Model Comparison" that calls 
  POST /api/backtest/compare-fills.

RESULTS SECTION:

Row 1 — Side by Side Strategy Results:
  Two columns, identical layout:
  
  LEFT — "Naive Fill Model"
  Sub-label: "Fill at next bar open, zero slippage"
  Metrics: Total Return, Sharpe Ratio, Max Drawdown, 
           Win Rate, Total Trades
  
  RIGHT — "Probabilistic Fill Model"  
  Sub-label: "Your realistic fill simulation 
               (Thesis Contribution 2)"
  Same metrics.
  
  Differences highlighted between the two columns 
  with red arrows showing where naive fills 
  overestimate performance.

Row 2 — Phantom Gains Banner:
  "Naive fills overestimated returns by X%"
  "This represents ₹XX,XXX in phantom gains that 
   would not materialise in live trading"

Row 3 — Fill Price Comparison Chart:
  A scatter plot showing for each trade:
  - X axis: Naive fill price
  - Y axis: Probabilistic fill price
  - Most points should be below the diagonal 
    (probabilistic is worse for buyer, more realistic)

Row 4 — Slippage Analysis:
  - Distribution of slippage amounts per trade
  - Average slippage in rupees and basis points
  - Worst 10 trades by slippage (table)

Row 5 — Explanation Panel:
  "Why does fill simulation matter?"
  Plain English explanation of bid-ask spread, 
  slippage, partial fills, and adverse selection.

--- PAGE: LiveSimulation.jsx ---

This page demonstrates Contribution 3 — the unified 
architecture. It is the most visually impressive page.

LAYOUT: Three-column layout

LEFT COLUMN — Architecture Diagram:
  This is the ArchitectureDiagram component (see below).
  It shows the engine component diagram.
  When in Live mode, the LiveDataHandler and 
  LiveExecutionHandler components are highlighted 
  (glowing blue border).
  When in Backtest mode, the HistoricalDataHandler 
  component is highlighted.
  The Strategy, Portfolio Manager, and Risk Manager 
  components are ALWAYS highlighted the same way 
  in both modes — visually proving that zero strategy 
  code changes between modes.
  
  Below the diagram, a text label:
  "Components highlighted in blue are active. 
   Notice the Strategy, Portfolio, and Risk Manager 
   never change between modes."

MIDDLE COLUMN — Live Price Feed:
  For each symbol being traded:
  - Symbol name and current price (large)
  - Price change since session start (% and absolute)
  - A real-time mini line chart of price history 
    (last 50 bars, updates via WebSocket)
  - Current position: LONG / SHORT / FLAT badge
  
  Below prices — Signal Feed:
  A scrolling log of signals and fills as they happen:
  Each entry shows timestamp, symbol, signal type, 
  and key metadata (Z-score for pairs trading).
  New entries slide in from the top.
  Color coded: LONG = green, SHORT = red, EXIT = amber.

RIGHT COLUMN — Portfolio Panel:
  - Total Portfolio Value (large, updates live)
  - P&L since session start (absolute and %)
  - Cash remaining
  - Current open positions table:
    Symbol | Direction | Quantity | Entry Price | 
    Current Price | Unrealized P&L
  - A live equity curve for the session 
    (builds bar by bar)

BOTTOM BAR:
  Three toggle buttons:
  "BACKTEST MODE" | "LIVE SIMULATION" | "COMPARE"
  
  In COMPARE mode, show both the backtest equity curve 
  and the live equity curve on the same chart to 
  visually demonstrate that they track each other — 
  proving the unified architecture produces consistent 
  results.

═══════════════════════════════════════════════════════════════════
SECTION 5.x — PAGE: THESIS SHOWCASE (IN-APP DEFENCE & COMMITTEE DEMO)
═══════════════════════════════════════════════════════════════════

PURPOSE
  Single guided surface for **viva / committee / sponsor demonstration**:
  states the **problem**, maps **contributions** to **running artefacts**,
  provides **rehearsed one-click demos**, and ends with **evaluation,
  limitations, and reproducibility**. MUST operate fully in **SAMPLE**
  data mode (SECTION 0 / SECTION 7) with no third-party signup.

ROUTE & FILES (Next.js)
  - Route: **`/showcase`** → `web/src/app/showcase/page.tsx` (client
    component boundary as needed for WebSocket).
  - Static copy & speaker bullets: `web/src/showcase/showcaseContent.ts`
    (TypeScript object export for UI strings; engineering truth and acceptance
    remain in this specification per SECTION 0 SSOT; do not add parallel
    narrative Markdown files for showcase-only prose).
  - Optional layout wrapper: `web/src/components/showcase/ShowcaseShell.tsx`
    for presentation chrome (max-width, typography ramp).

ENTRY POINTS
  - **Sidebar** item (see Layout/Sidebar update below): “Thesis showcase”.
  - Optional home / landing CTA on `page.tsx`: “Start guided thesis
    walkthrough” → `/showcase`.

LAYOUT MODES
  1. **Default showcase layout**
     - Full-width content column (max-width ~1200px), **elevated base font**
       (e.g. 18px body), high contrast, generous vertical rhythm; cards use
       same dark palette as SECTION 5 global design tokens.
  2. **Presentation mode** (toggle in TopBar or within showcase page)
     - Collapses sidebar to icon rail **or** hides chrome via layout state;
       increases heading scale and default chart heights for 1080p projectors.
     - State: `showcasePresentationMode: boolean` in AppContext (SECTION 6).

ANCHOR NAVIGATION
  - **Horizontal stepper** sticky under TopBar **or** **vertical section
    anchors** (right rail on ≥lg breakpoints) linking to:
      1 Overview → 2 Problem → 3 Objectives & contributions matrix
      → 4 System context → 5 Contribution 1 demo → 6 Contribution 2 demo
      → 7 Contribution 3 demo → 8 Evaluation methodology
      → 9 Results snapshot → 10 Limitations & future work
      → 11 References & reproducibility
  - **“5-minute path”** vs **“15-minute path”** toggle: controls which
    sections default to **expanded** vs **collapsed** and which preset
    buttons are visible (stored in context `showcaseDemoPath: "5min" | "15min"`).

───────────────────────────────────────────────────────────────────
SECTION 5.x.1 — Block 1: Title & metadata
───────────────────────────────────────────────────────────────────
  - **Thesis title** string (from `showcaseContent.ts`; may mirror env
    `NEXT_PUBLIC_THESIS_TITLE` if set at build for Vercel).
  - **One-line problem** + **one-line solution** (paired subheadings).
  - **Candidate metadata row:** name, institution, programme, submission year
    (static fields in content module).
  - **Build provenance strip:** app version / git short SHA via
    `NEXT_PUBLIC_APP_GIT_SHA` or build-time injection when available.

───────────────────────────────────────────────────────────────────
SECTION 5.x.2 — Block 2: Problem statement (examiner-facing)
───────────────────────────────────────────────────────────────────
  - **Problem cards** (minimum 3), each: short **pain** title + 2–3 sentence
    body. Required themes:
      (a) Event-queue **lock contention / latency** in conventional Python
          queue-based event loops for research engines.
      (b) **Optimistic / naive fills** (e.g. next-bar open, zero slippage)
          inflating reported strategy performance vs tradable reality.
      (c) **Research vs production drift** when strategy logic is duplicated
          or forked instead of sharing identical code paths.
  - **Context** paragraph: who uses event-driven backtests and what breaks
    when assumptions are wrong.
  - **Explicit non-goals** bullet list (e.g. not a certified OMS, not claiming
    HFT colocation performance, not production brokerage integration).

───────────────────────────────────────────────────────────────────
SECTION 5.x.3 — Block 3: Objectives & contributions matrix
───────────────────────────────────────────────────────────────────
  - **Responsive table:** rows = Contribution 1 / 2 / 3; columns =
    **Problem addressed** | **Mechanism / artefact** | **Where in app**
    | **Primary success metric**.
  - **“Where in app”** cells contain internal **Link** navigation to:
      `/benchmark` (C1), **`/fillmodel` or `/strategy/compare`** (C2), `/live` (C3).
  - Optional **“Open in new tab”** icon per link.

───────────────────────────────────────────────────────────────────
SECTION 5.x.4 — Block 4: Integrated system context
───────────────────────────────────────────────────────────────────
  - **Simplified deployment diagram** (static SVG or reduced variant of
    `ArchitectureDiagram` props) labelling **Next.js (Vercel)**, **FastAPI**,
    **Neon PostgreSQL**, **Parquet OHLCV**, **WebSocket** paths.
  - Bulleted **request path** narrative: Browser → Next → REST/WS → Engine →
    storage → streaming updates.

───────────────────────────────────────────────────────────────────
SECTION 5.x.5 — Block 5: Contribution 1 scripted demo (ring buffer)
───────────────────────────────────────────────────────────────────
  - **Primary measurable path** is SECTION 0.A **`/benchmark`** (small page). This block
    is the **showcase** narrative: collapsible **“Why measure latency?”** explainer
    referencing `time.perf_counter_ns` semantics aligned with `ring_buffer.py`.
  - **Preset selector** (optional; maps to named payloads if `showcase.py` exists or
    hardcoded mirror): `benchmark_small` | `benchmark_standard` | `benchmark_stress`
    (stress must not crash; toast on guard-rail events).
  - **Primary CTA:** “Run benchmark (Contribution 1)” → **`POST /api/benchmark/run`**
    (same body shape as backtest run) — may open **`/benchmark`** in a new tab or embed
    compact results per SECTION 0.A C1 minimum (two metric cards + one bar chart).
  - **Secondary (optional):** expanded multi-chart layout from SECTION 5
    (BenchmarkComparison) **only** if kept as a modal, sub-route, or second tab on
    **`/benchmark`** — do not invent a parallel URL that duplicates the same API call.
  - Loading / error states per SECTION 8.

───────────────────────────────────────────────────────────────────
SECTION 5.x.6 — Block 6: Contribution 2 scripted demo (fill models)
───────────────────────────────────────────────────────────────────
  - Short explainer on **phantom gains** tying to Contribution 2 narrative.
  - **Primary CTA:** “Run fill comparison (Contribution 2)” →
    `POST /api/backtest/compare-fills` using preset aligned with C1 for
    apples-to-apples comparability (same symbols/dates/strategy).
  - **Compact side-by-side metric row** (Naive vs Probabilistic): total return,
    Sharpe, max drawdown, win rate, total trades (reuse formatting rules).
  - **Single focal chart** (choose one for brevity): e.g. grouped bar on
    total return **or** truncated scatter of fill prices with capped points
    for performance.
  - **Phantom gains banner** echoing Fill page semantics once metrics arrive.
  - **Secondary CTA:** **`/fillmodel`** (full page) **or** compact **`/strategy/compare`**.

───────────────────────────────────────────────────────────────────
SECTION 5.x.7 — Block 7: Contribution 3 scripted demo (unified architecture)
───────────────────────────────────────────────────────────────────
  - **Tabs** controlling `ArchitectureDiagram` `mode` prop cycling
    `backtest` | `live` | (optional third tab mirroring Live page compare if
    implemented).
  - Numbered **callout list** adjacent to diagram (1..n) explicitly stating:
    strategy + portfolio + risk unchanged; only data / execution periphery
    swaps per Contribution 3.
  - **Primary CTA:** “Start short live replay (Contribution 3)” →
    `POST /api/live/start` with **fixed short preset** (e.g. one month daily
    bars at high `speed_multiplier`) chosen so typical defence finishes in
    under ~120s; show **Stop** button bound to `POST /api/live/stop/{session_id}`.
  - **Embedded mini panels:**
      - Last **N** websocket signal lines (scroll-limited list).
      - Sparkline / small `LineChart` of session equity (last M points).
  - Reuse `createLiveWebSocket(sessionId)` service; auto-disconnect on unmount.
  - **Secondary CTA:** `/live`.

───────────────────────────────────────────────────────────────────
SECTION 5.x.8 — Block 8: Evaluation & methodology
───────────────────────────────────────────────────────────────────
  - Hardware / runtime disclosure placeholders (Python version, machine class
    filled during actual thesis measurement campaign).
  - **Metrics glossary** table: throughput, avg latency, phantom gains %,
    speedup factor definitions tied to engine outputs (no invented constants).
  - **Honesty subsection:** document threading model assumptions (e.g. if
    benchmark single-threaded) and any known measurement bias.

───────────────────────────────────────────────────────────────────
SECTION 5.x.9 — Block 9: Results snapshot (optional)
───────────────────────────────────────────────────────────────────
  - Button: **“Load last completed demo results”** calling
    `GET /api/showcase/last-results` when backend supports it; otherwise read
    last known IDs from **localStorage** keys written after successful runs
    (`alphatest_last_benchmark`, etc.) and fetch respective result endpoints.
  - If nothing stored: friendly empty state + suggestion to run presets above.

───────────────────────────────────────────────────────────────────
SECTION 5.x.10 — Block 10: Limitations & future work
───────────────────────────────────────────────────────────────────
  - Bulleted limitations: synthetic data realism boundaries, simplified fill
    physics, absence of L2 order book, network split deployment complexity
    (Vercel UI vs external API host per SECTION 0).
  - Future work bullets (multi-asset risk, richer microstructure, etc.).

───────────────────────────────────────────────────────────────────
SECTION 5.x.11 — Block 11: References & reproducibility
───────────────────────────────────────────────────────────────────
  - Numbered reference list mirroring thesis bibliography (LMAX Disruptor,
    Avellaneda–Stoikov, López de Prado, etc.) with stable URLs / DOIs.
  - **Reproducibility card:** SAMPLE seed value, preset IDs, engine version,
    pointer to SECTION 9 inline onboarding for local reproduction.

CROSS-CUTTING SHOWCASE UX REQUIREMENTS
  - **Speaker notes drawer** (right drawer or bottom sheet) toggled via button;
    each major block maps to **2–5** bullet prompts sourced from
    `showcaseContent.ts` (optional keyboard shortcut `N` to toggle).
  - **Per-section primary action** or deep link — no narrative dead ends.
  - **Offline / API failure:** structured error + retry + textual fallback
    instructions (SECTION 8).
  - **Accessibility:** landmark regions per block; stepper `aria-current`;
    charts include textual summary sentence for screen readers (MVP+ if time
    constrained, still document intent here).
  - **Analytics:** no third-party trackers requiring signup (SECTION 0).

IMPLEMENTATION NOTES
  - Reuse existing services (`api.ts`, `websocket.ts`) — do not fork parallel
    HTTP clients.
  - All charts must still obey FINAL INSTRUCTION: data originates from engine
    runs (including deterministic SAMPLE OHLCV), never unrelated hardcoded
    chart constants.

--- COMPONENT: ArchitectureDiagram.tsx ---

A custom SVG-based component (NOT an image) that 
programmatically renders the engine architecture diagram.

The diagram shows the following components as boxes 
connected by arrows indicating data flow:

Level 1 (top): DATA SOURCES
  [Historical Data Files] [Live Market Feed]

Level 2: DATA HANDLER (swappable)
  [HistoricalDataHandler] [LiveDataHandler]
  These two are shown with a SWAP icon between them.
  Only one is active at a time (highlighted).

Level 3: EVENT QUEUE (your contribution 1)
  [Lock-Free Ring Buffer]
  Show it as a circular/ring visual element.
  Label it "Contribution 1: Lock-Free Ring Buffer"

Level 4: CORE COMPONENTS (always the same)
  [Strategy Engine] → [Portfolio Manager] → [Risk Manager]
  These three are always highlighted with a 
  "SAME IN ALL MODES" badge.

Level 5: EXECUTION HANDLER (swappable)
  [Simulated Execution] [Live Broker API]
  Shows SWAP icon.
  Label: "Only this changes between backtest and live"

Level 6 (bottom): OUTPUT
  [Performance Analytics] [Real-time P&L]

Arrows connect all levels showing event flow direction.

Active components (depending on mode prop) glow with 
a blue animated border (CSS keyframe animation).
Inactive components are dimmed (opacity 0.4).

The diagram accepts a prop: mode = "backtest" | "live"
And highlights accordingly.

--- COMPONENT: Layout/Sidebar.tsx ---

A fixed left sidebar with navigation links to all pages (including `/showcase`):

Logo area at top:
  "α AlphaTest" in large font
  "Low-Latency Backtesting Engine" in smaller text below

Navigation items (with Lucide icons):
  📊 Data Manager         → /data
  ⚙️ Strategy Builder     → /strategy
  ▶️ Run Backtest         → /backtest
  📈 Results Dashboard    → /results
  ⚡ Benchmark Comparison  → /benchmark
     (Badge: "Contribution 1")
  🎯 Fill Model Comparison → /fillmodel
     (Badge: "Contribution 2")
  🔴 Live Simulation      → /live
     (Badge: "Contribution 3" + pulsing red dot 
      when a live session is active)
  🎓 Thesis showcase      → /showcase
     (Badge: "Defence" or "Walkthrough"; Lucide icon `Presentation` or
      `GraduationCap`)

At the bottom of the sidebar:
  A small panel showing last backtest summary 
  if one has been run:
  Strategy name, return %, Sharpe ratio.

═══════════════════════════════════════════════════════════════════
SECTION 6 — DATA FLOW AND STATE MANAGEMENT
═══════════════════════════════════════════════════════════════════

--- FILE: frontend/src/context/AppContext.tsx ---

Create a React context with the following state:

{
  // Data state
  loadedInstruments: [],        // list of available instruments
  
  // Strategy configuration (set by StrategyBuilder)
  strategyConfig: {
    strategyType: null,         // "sma_crossover" | "pairs_trading" | "mean_reversion"
    symbols: [],
    startDate: null,
    endDate: null,
    initialCapital: 1000000,
    fillModel: "probabilistic",
    strategyParams: {}
  },
  
  // Backtest state
  activeBacktestId: null,
  backtestStatus: null,         // "idle" | "running" | "completed" | "failed"
  backtestProgress: 0,
  backtestResult: null,
  
  // Live simulation state
  activeSessionId: null,
  liveSessionStatus: null,
  livePortfolioValue: null,
  
  // Benchmark results
  benchmarkResult: null,
  
  // Fill comparison results
  fillComparisonResult: null,

  // Thesis showcase (SECTION 5.x)
  showcasePresentationMode: false,   // presentation chrome toggle
  showcaseDemoPath: "5min"             // "5min" | "15min" — section expansion defaults
}

Provide actions:
  setStrategyConfig(config)
  setActiveBacktestId(id)
  updateBacktestProgress(progress)
  setBacktestResult(result)
  setBenchmarkResult(result)
  setFillComparisonResult(result)
  setActiveSession(sessionId)
  updateLivePortfolio(value)
  setShowcasePresentationMode(value: boolean)
  setShowcaseDemoPath(path: "5min" | "15min")

--- FILE: frontend/src/services/api.ts (Next.js analogue) ---

Configure REST base URL through `NEXT_PUBLIC_API_BASE_URL` (public env for browser),
default development fallback `http://127.0.0.1:8000`.

Export the following functions:

fetchInstruments()
fetchInstrumentData(symbol, startDate, endDate, limit)
fetchInstrumentStats(symbol)
downloadInstrumentData(symbol, startDate, endDate, interval)
importInstrumentCsv(formData)   // POST multipart /api/data/import-csv (SECTION 0.A)
fetchInstrumentOhlcvTable(symbol, limit, offset)  // GET .../ohlcv/{symbol}/table

runBacktest(config)
getBacktestResult(backtestId)
runFillComparison(config)

runBenchmark(config)

startLiveSession(config)
stopLiveSession(sessionId)
getLiveStatus(sessionId)

fetchShowcasePresets()        // GET /api/showcase/presets (optional; stub if omitted)
fetchShowcaseLastResults()    // GET /api/showcase/last-results (optional)

--- FILE: frontend/src/services/websocket.ts ---

Create a WebSocket service class:

class WebSocketService {
  constructor(url)
  connect()
  disconnect()
  onMessage(callback)   // registers a message handler
  onConnect(callback)
  onDisconnect(callback)
  send(data)
}

Export two factory functions deriving `PUBLIC_WS_ORIGIN` from
`NEXT_PUBLIC_WS_BASE_URL`, or logically from REST base (secure `wss:` in production):
  createBacktestWebSocket(backtestId)
    → new WebSocketService(
        `${PUBLIC_WS_ORIGIN}/ws/backtest/${backtestId}`)
  createLiveWebSocket(sessionId)
    → new WebSocketService(
        `${PUBLIC_WS_ORIGIN}/ws/live/${sessionId}`)

═══════════════════════════════════════════════════════════════════
SECTION 7 — SAMPLE DATA AND INITIALIZATION
═══════════════════════════════════════════════════════════════════

PRIMARY PATH — DETERMINISTIC SAMPLE OHLCV (NO NETWORK, NO VENDOR ACCOUNT)
  - On startup (FastAPI lifespan preferred over legacy `on_event("startup")`),
    if required Parquet artefacts or metadata rows are missing for demo
    instruments, **generate** them via `backend/data/sample_generator.py` so the
    thesis UI is operational immediately.
  - Symbols to support at minimum (logical names preserved for narrative /
    thesis examples): HDFCBANK.NS, ICICIBANK.NS, RELIANCE.NS, and a benchmark
    series akin to **^NSEI** semantics; generated calendars: 2020-01-01 →
    2024-01-01, interval 1d (or equivalent trading-day count).
  - Deterministic seeding ensures reproducible benchmarks and screenshots.

OPTIONAL SECONDARY PATH — FREE NETWORK FETCH (NO SIGNUP SERVICE)
  Where the Data Manager **FETCH** toggle is selected and outbound HTTP is
  available, MAY attempt to populate the same instruments using a free public
  OHLCV pathway (implementation may wrap yfinance semantics). This path MUST
  never be required for first-class operation; failures return actionable API
  errors and suggest switching to **SAMPLE**.

UI INTEGRATION REMINDER
  Data Manager (SECTION 5) exposes SAMPLE vs FETCH prominently; default to
  SAMPLE for zero-friction demonstrations.

═══════════════════════════════════════════════════════════════════
SECTION 8 — ERROR HANDLING AND EDGE CASES
═══════════════════════════════════════════════════════════════════

Backend:
- All routes must have try/except blocks returning 
  appropriate HTTP status codes and error messages.
- If optional network fetch fails (no internet, rate limit, parse error), return
  a clear message and recommend **SAMPLE** mode; never block core thesis flows.
- If a backtest is requested for a symbol with no data, 
  return 400 with message "No data available for symbol X. 
  Please fetch data first."
- If ring buffer overflows (very large dataset), 
  double the buffer size automatically and log a warning.
- All long-running operations (backtest, benchmark) must 
  run in a background thread using FastAPI's 
  BackgroundTasks so they do not block the API.

Frontend:
- All API calls must have loading states (spinner or 
  skeleton UI while loading).
- All API errors must show a toast notification with 
  the error message.
- If WebSocket disconnects during a backtest, 
  show a reconnection indicator and attempt to 
  reconnect every 3 seconds.
- Charts must handle empty data gracefully 
  (show "No data available" placeholder).
- All number displays must be formatted:
  - Currency: ₹1,23,456.78 (Indian number format)
  - Percentages: +12.34% (with sign)
  - Nanoseconds: 1,250 ns
  - Large numbers: 1.2M, 25K

═══════════════════════════════════════════════════════════════════
SECTION 9 — ONBOARDING & OPERATIONS (INLINE PRIMARY; README ADJUNCT)
═══════════════════════════════════════════════════════════════════

Maintain the following topical coverage as **prose inside this document**
(expand under this heading at implementation sign-off). **Short operational
duplicates** (install commands, Vercel/Render env tables) MAY appear in `README.md`
or `doc/DEPLOY_INTEGRATION.md` per SECTION 0 SSOT; they MUST stay consistent with
this section and MUST NOT redefine engine semantics.

Content checklist (when documentation is filled in here):

1. Project title and one-line description
2. Thesis context — what this application demonstrates
3. Three contributions clearly listed with one paragraph each
4. Prerequisites (Python 3.11+, Node.js 18+)
5. Installation steps (Neon `DATABASE_URL`, backend venv, Next.js `web/` app)
6. How to run locally (`uvicorn` for API; `npm run dev` for Next.js) + note that
     production fronts Vercel while API runs on Python-capable infrastructure
7. How to use — a step-by-step walkthrough of the demo 
   sequence:
   Step 1: Open Data Manager — for defence with supplied CSVs, use **SECTION C**
           **Import CSV** for each of the five securities (symbol keys per SECTION 0.A);
           confirm rows via **View OHLCV table**. Alternatively use SAMPLE/FETCH paths
           from SECTION A when CSVs are not used.
   Step 2: Open Strategy Builder, select Pairs Trading, 
           configure parameters
   Step 3: Run backtest with Naive fills, note Sharpe ratio
   Step 4: Run backtest with Probabilistic fills, 
           compare Sharpe ratio
   Step 5: Open Fill Model Comparison, see phantom gains
   Step 6: Open Benchmark Comparison, see ring buffer 
           speedup
   Step 7: Open Live Simulation, watch strategy run 
           in real time
   Step 8: In Live Simulation, observe architecture 
           diagram showing same strategy code in both modes
   Step 9: Open **Thesis showcase** (`/showcase`), run the 5- or 15-minute
           guided path: problem → contributions matrix → preset demos
           (benchmark, fill comparison, short live replay) → limitations
           and references
8. Project structure explanation
9. Key academic references (LMAX Disruptor paper, 
   Avellaneda-Stoikov, Bailey-Lopez de Prado)

═══════════════════════════════════════════════════════════════════
SECTION 10 — IMPLEMENTATION SEQUENCE
═══════════════════════════════════════════════════════════════════

Build the application in exactly this order for the **Python reference stack**
(defence + core product). Optional **C++ native engine** work is sequenced in
**SECTION 0.B** and MUST NOT block the phases below.

PHASE 1 — Engine Core (build and test independently):
  1. events.py
  2. ring_buffer.py (test with a simple benchmark script)
  3. fill_models.py
  4. data_handler.py
  5. strategy base class
  6. all three strategy implementations
  7. portfolio.py
  8. execution_handler.py
  9. backtesting_engine.py
  10. Write a standalone test: python test_engine.py
      that runs a full SMA crossover backtest on 
      HDFCBANK.NS (or equivalent synthetic parquet in SAMPLE mode)
      data and prints performance metrics 
      to console. This validates the engine works 
      before touching the API or frontend.

PHASE 2 — Backend API:
  11. database models and schemas (**prioritise SECTION 0.A** `instruments` +
      `ohlcv_bars` before optional tables)
  12. data routes (**include SECTION 0.A** `POST /api/data/import-csv` and
      `GET /api/data/ohlcv/{symbol}/table` early for defence path)
  13. backtest routes
  14. benchmark routes
  15. live routes and WebSocket
  16. main.py wiring everything together

PHASE 3 — Frontend:
  17. AppContext and services
  18. Layout components (Sidebar, TopBar)
  19. DataManager page
  20. StrategyBuilder page
  21. BacktestRunner page
  22. ResultsDashboard page
  23. BenchmarkComparison page
  24. FillModelComparison page
  25. ArchitectureDiagram component (`ArchitectureDiagram.tsx`)
  26. LiveSimulation page
  27. Thesis showcase page (`/showcase`), `showcaseContent.ts`,
      optional `ShowcaseShell.tsx`, presentation-mode wiring,
      optional `GET /api/showcase/*` integration

PHASE 4 — Integration and Polish:
  28. Connect all WebSocket streams (including showcase live mini-panel)
  29. Test full end-to-end flow (core pages + thesis showcase presets)
  30. Add loading states and error handling everywhere
  31. Embed operational/onboarding prose into SECTION 9 of this specification
       (README/DEPLOY_INTEGRATION may mirror short command blocks per SECTION 0 SSOT)

Optional **native C++ engine** work is **not** part of this sequence until defence
milestones pass; follow **SECTION 0.B** checklists and GitHub Issues separately.

═══════════════════════════════════════════════════════════════════
FINAL INSTRUCTION TO CURSOR AI
═══════════════════════════════════════════════════════════════════

Build this application completely and without shortcuts. 
Do not use placeholder comments like "# implement this later" 
or "// TODO". Every function must be fully implemented.

The ring_buffer.py must be a real implementation — not a 
wrapper around Python's deque or queue. It must use a 
pre-allocated list and integer head/tail pointers until a **C++**
realisation is accepted under **SECTION 0.B** parity rules; native code
must then match the same **observable** buffer contract (SECTION 3).

The fill models must actually compute slippage and partial 
fills — not simulate them with random noise.

The benchmark must run two real backtests and measure real 
timing using time.perf_counter_ns() — not simulated numbers.

The live simulation must use real WebSocket streaming — 
not polling.

Every chart must plot **meaningful numerical series originating from engine runs**
(feeding deterministic synthetic OHLCV when SAMPLE mode applies — not lazily coded
fixture constants unrelated to pipelines).

Local dev commands (illustrative; exact paths locked at implementation):
  Terminal 1: `cd backend && uvicorn main:app --reload` (bind port per env default 8000)
  Terminal 2: `cd web && npm run dev` (Next.js default http://localhost:3000 )

Production UX surface is the Next.js deployment on **Vercel**; REST/WebSocket
targets resolve through `NEXT_PUBLIC_*` URLs to the externally hosted FastAPI tier.
