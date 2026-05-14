const base =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export async function fetchInstruments(): Promise<
  {
    symbol: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    total_bars: number;
  }[]
> {
  const r = await fetch(`${base}/api/data/instruments`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function importInstrumentCsv(
  formData: FormData,
): Promise<{ status: string; symbol: string; bars_imported: number }> {
  const r = await fetch(`${base}/api/data/import-csv`, {
    method: "POST",
    body: formData,
  });
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
  const r = await fetch(
    `${base}/api/data/ohlcv/${encodeURIComponent(symbol)}/table?${q}`,
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
  const r = await fetch(`${base}/api/backtest/run`, {
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
  const r = await fetch(
    `${base}/api/backtest/result/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
