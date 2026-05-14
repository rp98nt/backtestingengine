"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchInstruments, runBacktest } from "@/lib/api";

export default function StrategyPage() {
  const router = useRouter();
  const [instruments, setInstruments] = useState<{ symbol: string; name: string }[]>(
    [],
  );
  const [symbol, setSymbol] = useState("HDFC");
  const [fillModel, setFillModel] = useState<"naive" | "probabilistic">("naive");
  const [capital, setCapital] = useState(1_000_000);
  const [shortW, setShortW] = useState(20);
  const [longW, setLongW] = useState(50);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchInstruments();
      setInstruments(list.map((i) => ({ symbol: i.symbol, name: i.name })));
      setSymbol((prev) => {
        if (!list.length) return prev;
        return list.some((i) => i.symbol === prev) ? prev : list[0].symbol;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const res = await runBacktest({
        strategy: "sma_crossover",
        symbols: [symbol],
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        initial_capital: capital,
        fill_model: fillModel,
        strategy_params: { short_window: shortW, long_window: longW },
      });
      router.push(`/results/${encodeURIComponent(res.backtest_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm text-slate-400">
          <Link href="/" className="text-blue-400 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/backtest" className="text-blue-400 hover:underline">
            Backtest hub
          </Link>
          {" · "}
          <Link href="/results" className="text-blue-400 hover:underline">
            All runs
          </Link>
          {" · "}
          <Link href="/data" className="text-blue-400 hover:underline">
            Data Manager
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">SMA crossover backtest</h1>
        <p className="text-sm text-slate-400">
          Runs the event engine against Neon OHLCV, then stores the outcome in{" "}
          <code className="rounded bg-slate-900 px-1 text-xs">backtest_runs</code>.
        </p>
        <p className="text-sm">
          <Link href="/strategy/compare" className="text-blue-400 hover:underline">
            Compare naive vs probabilistic fills
          </Link>
          {" · "}
          <Link href="/benchmark" className="text-violet-400 hover:underline">
            Ring buffer benchmark
          </Link>{" "}
          (Contribution 1 — two engine passes per request).
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-6 shadow"
      >
        <label className="flex flex-col gap-1 text-sm">
          Symbol
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={loading || instruments.length === 0}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          >
            {instruments.length === 0 ? (
              <option value="">No instruments — import CSV first</option>
            ) : (
              instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} — {i.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fill model
          <select
            value={fillModel}
            onChange={(e) =>
              setFillModel(e.target.value as "naive" | "probabilistic")
            }
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          >
            <option value="naive">Naive (open, fixed commission)</option>
            <option value="probabilistic">Probabilistic (bid/ask, participation)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Initial capital
          <input
            type="number"
            min={1000}
            step={1000}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Fast SMA
            <input
              type="number"
              min={2}
              value={shortW}
              onChange={(e) => setShortW(Number(e.target.value))}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Slow SMA
            <input
              type="number"
              min={3}
              value={longW}
              onChange={(e) => setLongW(Number(e.target.value))}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Start date (optional)
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End date (optional)
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={running || instruments.length === 0}
          className="w-full rounded bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {running ? "Running…" : "Run backtest"}
        </button>
      </form>
    </div>
  );
}
