/** Thesis showcase copy — SSOT for engineering is `doc/ALPHA_TEST_SPECIFICATION.md` (SECTION 5.x). */

export const thesisTitle =
  "Design of a Low-Latency Event-Driven Backtesting Engine";

export const thesisSubtitle = {
  problem: "Research engines hide queue latency and optimistic fills behind simple APIs.",
  solution:
    "AlphaTest measures real dequeue cost (ring vs queue), models fills, and keeps one strategy path for replay.",
};

export const candidateMeta = {
  programme: "MTech (example — replace at build)",
  institution: "Your institution",
  year: "2026",
};

export const problemCards = [
  {
    title: "Queue contention & latency",
    body: "Python `queue.Queue` event loops pay lock and scheduling overhead per event. For large bar counts, that cost compounds even when strategy work is light.",
  },
  {
    title: "Optimistic fills",
    body: "Naive next-bar-open fills with zero slippage inflate backtests versus what is tradable when bid/ask and participation matter.",
  },
  {
    title: "Research vs production drift",
    body: "Forking strategy code for live vs backtest guarantees subtle divergence. One handler swap with an identical strategy path reduces that risk.",
  },
];

export const nonGoals = [
  "Not a certified OMS or exchange-tested execution stack.",
  "Not claiming HFT colocation or sub-microsecond co-processor performance.",
  "Not production brokerage, margin, or regulatory reporting.",
];

export const contributionsMatrix = [
  {
    id: "C1",
    problem: "Event-loop dequeue cost & throughput",
    mechanism: "Preallocated ring buffer vs `queue.Queue` baseline; `perf_counter_ns` per get",
    href: "/benchmark",
    linkLabel: "/benchmark",
    metric: "Lower avg `get()` latency and higher events/sec on identical bar replay",
  },
  {
    id: "C2",
    problem: "Phantom P&L from unrealistic fills",
    mechanism: "Naive vs probabilistic fill models on the same SMA path",
    href: "/strategy/compare",
    linkLabel: "/strategy/compare",
    metric: "Divergence in return, slippage, and commission totals vs naive",
  },
  {
    id: "C3",
    problem: "Unified architecture (historical vs live)",
    mechanism: "Same strategy + portfolio; swap data handler (live replay deferred in MVP UI)",
    href: "/live",
    linkLabel: "/live",
    metric: "Identical signal path; WS session when live ships",
  },
];

export const systemBullets = [
  "Browser → Next.js (Vercel) → `fetch` / WebSocket to FastAPI host.",
  "FastAPI → SQLAlchemy/asyncpg → Neon (`instruments`, `ohlcv_bars`, `backtest_runs`).",
  "Engine: synchronous event loop (market → signal → order → fill) with pluggable queue.",
];

export const speakerBullets = {
  "5min": [
    "Import one CSV on /data, confirm /data/[symbol]/table pagination.",
    "Run /benchmark once; quote speedup vs queue on this machine.",
    "Run /strategy/compare; quote return_difference line from API.",
  ],
  "15min": [
    "Walk Neon persistence: re-open /results after refresh.",
    "Open /results/[id] equity tail and fill list for committee questions.",
    "State limitations: single-threaded engine, no L2 book, WS live deferred.",
  ],
};

export const limitations = [
  "Synthetic/sample paths and optional yfinance are out of defence-critical path per SECTION 0.A.",
  "Live: `POST /api/live/start` exists as an in-memory stub; WebSocket `/ws/live` and bar replay are not implemented yet.",
  "Benchmark speedup varies by CPU; apples-to-apples is same process, same bars.",
];
