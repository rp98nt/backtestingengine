"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { compareBacktestFills, fetchInstruments } from "@/lib/api";

export default function CompareFillsPage() {
  const [instruments, setInstruments] = useState<{ symbol: string; name: string }[]>(
    [],
  );
  const [symbol, setSymbol] = useState("HDFC");
  const [capital, setCapital] = useState(1_000_000);
  const [shortW, setShortW] = useState(20);
  const [longW, setLongW] = useState(50);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Awaited<ReturnType<typeof compareBacktestFills>> | null>(
    null,
  );

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
    setOut(null);
    try {
      const res = await compareBacktestFills({
        strategy: "sma_crossover",
        symbols: [symbol],
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        initial_capital: capital,
        strategy_params: { short_window: shortW, long_window: longW },
      });
      setOut(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const naivePm = out?.naive_result?.performance_metrics as
    | Record<string, number>
    | undefined;
  const probPm = out?.probabilistic_result?.performance_metrics as
    | Record<string, number>
    | undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm text-slate-400">
          <Link href="/strategy" className="text-blue-400 hover:underline">
            ← Single run
          </Link>
          {" · "}
          <Link href="/benchmark" className="text-violet-400 hover:underline">
            Benchmark
          </Link>
          {" · "}
          <Link href="/" className="text-blue-400 hover:underline">
            Home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Compare fill models</h1>
        <p className="text-sm text-slate-400">
          Calls <code className="rounded bg-slate-900 px-1 text-xs">POST /api/backtest/compare-fills</code>{" "}
          — same SMA config, naive vs probabilistic. Both runs are written to Neon.
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
          {running ? "Running both models…" : "Compare fills"}
        </button>
      </form>

      {out && (
        <>
          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">Comparison metrics</h2>
            <p className="mb-2 text-xs text-slate-500">
              Group <span className="font-mono">{out.comparison_group_id}</span>
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {Object.entries(out.comparison).map(([k, v]) => (
                <div key={k} className="rounded bg-slate-950/80 px-3 py-2">
                  <dt className="text-xs uppercase text-slate-500">{k}</dt>
                  <dd className="font-mono text-slate-200">{v.toFixed(6)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
              <h2 className="mb-2 font-medium text-emerald-300">Naive</h2>
              <p className="mb-3 font-mono text-xs text-slate-500">{out.naive_backtest_id}</p>
              <Link
                href={`/results/${encodeURIComponent(out.naive_backtest_id)}`}
                className="text-sm text-blue-400 hover:underline"
              >
                Open full result
              </Link>
              {naivePm && (
                <dl className="mt-4 space-y-2 text-sm">
                  {Object.entries(naivePm).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-mono">{Number(v).toFixed(4)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
            <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
              <h2 className="mb-2 font-medium text-amber-300">Probabilistic</h2>
              <p className="mb-3 font-mono text-xs text-slate-500">
                {out.probabilistic_backtest_id}
              </p>
              <Link
                href={`/results/${encodeURIComponent(out.probabilistic_backtest_id)}`}
                className="text-sm text-blue-400 hover:underline"
              >
                Open full result
              </Link>
              {probPm && (
                <dl className="mt-4 space-y-2 text-sm">
                  {Object.entries(probPm).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-mono">{Number(v).toFixed(4)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
