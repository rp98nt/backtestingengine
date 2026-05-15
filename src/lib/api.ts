import { apiUrl } from "./apiBase";

/** Browser fetch can otherwise hang while Render free tier wakes (~30–90s). */
const API_FETCH_TIMEOUT_MS = 120_000;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  let signal = init?.signal;
  if (
    !signal &&
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    signal = AbortSignal.timeout(API_FETCH_TIMEOUT_MS);
  }
  try {
    return await fetch(url, { ...init, signal });
  } catch (e) {
    if (
      e instanceof Error &&
      (e.name === "AbortError" || e.name === "TimeoutError")
    ) {
      throw new Error(
        `Request timed out after ${API_FETCH_TIMEOUT_MS / 1000}s (${url}). ` +
          `If the API is on Render’s free tier, open your FastAPI /api/health in a new tab to wake the instance, wait until it returns JSON, then refresh this page.`,
      );
    }
    const proxyHint =
      typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string" &&
      process.env.NEXT_PUBLIC_API_BASE_URL.length > 0
        ? ""
        : " On Vercel, set server env BACKEND_URL to your FastAPI HTTPS origin (same-origin proxy), or set NEXT_PUBLIC_API_BASE_URL.";
    if (e instanceof TypeError) {
      throw new Error(`${e.message} (${url}).${proxyHint}`);
    }
    throw e;
  }
}

export async function fetchInstruments(): Promise<
  {
    symbol: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    total_bars: number;
  }[]
> {
  const r = await apiFetch("/api/data/instruments", { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function importInstrumentCsv(
  formData: FormData,
): Promise<{ status: string; symbol: string; bars_imported: number }> {
  const r = await apiFetch("/api/data/import-csv", {
    method: "POST",
    body: formData,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchInstrumentOhlcv(
  symbol: string,
  limit = 500,
): Promise<{
  symbol: string;
  data: {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}> {
  const q = new URLSearchParams({ limit: String(Math.min(limit, 5000)) });
  const r = await apiFetch(
    `/api/data/ohlcv/${encodeURIComponent(symbol)}?${q}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchInstrumentOhlcvTable(
  symbol: string,
  limit = 100,
  offset = 0,
): Promise<{
  symbol: string;
  rows: {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  total_count: number;
}> {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const r = await apiFetch(
    `/api/data/ohlcv/${encodeURIComponent(symbol)}/table?${q}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type BacktestRunBody = {
  strategy: "sma_crossover";
  symbols: string[];
  start_date?: string | null;
  end_date?: string | null;
  initial_capital: number;
  fill_model: "naive" | "probabilistic";
  strategy_params: { short_window?: number; long_window?: number };
};

export async function runBacktest(
  body: BacktestRunBody,
): Promise<{ backtest_id: string; status: string }> {
  const r = await apiFetch("/api/backtest/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchBacktestResult(id: string): Promise<{
  backtest_id: string;
  status: string;
  config: Record<string, unknown>;
  performance_metrics: Record<string, number>;
  equity_curve: {
    timestamp: string | null;
    portfolio_value: number;
    cash: number;
    positions_value: number;
  }[];
  trade_log: Record<string, unknown>[];
  engine_metrics: Record<string, unknown>;
}> {
  const r = await apiFetch(
    `/api/backtest/result/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type BacktestCompareBody = {
  strategy: "sma_crossover";
  symbols: string[];
  start_date?: string | null;
  end_date?: string | null;
  initial_capital: number;
  strategy_params: { short_window?: number; long_window?: number };
};

export async function compareBacktestFills(body: BacktestCompareBody): Promise<{
  comparison_group_id: string;
  naive_backtest_id: string;
  probabilistic_backtest_id: string;
  naive_result: Record<string, unknown>;
  probabilistic_result: Record<string, unknown>;
  comparison: Record<string, number>;
}> {
  const r = await apiFetch("/api/backtest/compare-fills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function runBenchmark(body: BacktestRunBody): Promise<{
  ring_buffer: Record<string, number>;
  standard_queue: Record<string, number>;
  speedup_factor: number;
  latency_reduction_pct: number;
  cpp_native_mvp?: Record<string, unknown> | null;
}> {
  const r = await apiFetch("/api/benchmark/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchBacktestRuns(
  limit = 50,
  offset = 0,
): Promise<{
  runs: {
    backtest_id: string;
    status: string;
    strategy: string;
    symbol_key: string;
    created_at: string;
    fill_model: string | null;
    total_return: number | null;
    compare_role: string | null;
  }[];
  total_count: number;
}> {
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const r = await apiFetch(`/api/backtest/runs?${q}`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type LiveStartBody = {
  strategy: "sma_crossover";
  symbols: string[];
  replay_start_date?: string | null;
  replay_end_date?: string | null;
  speed_multiplier?: number;
  initial_capital: number;
  strategy_params?: { short_window?: number; long_window?: number };
};

export async function startLiveSession(
  body: LiveStartBody,
): Promise<{ session_id: string; status: string }> {
  const r = await apiFetch("/api/live/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getLiveStatus(sessionId: string): Promise<{
  session_id: string;
  status: string;
  detail: string;
}> {
  const r = await apiFetch(
    `/api/live/status/${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function stopLiveSession(sessionId: string): Promise<{
  session_id: string;
  status: string;
  detail: string;
}> {
  const r = await apiFetch(`/api/live/stop/${encodeURIComponent(sessionId)}`, {
    method: "POST",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
