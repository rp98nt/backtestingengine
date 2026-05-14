"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchInstruments, runBenchmark } from "@/lib/api";
import { formatInr } from "@/lib/formatInr";

function formatNs(ns: number): string {
  if (!Number.isFinite(ns) || ns <= 0) return "0 ns";
  if (ns < 1000) return `${ns.toFixed(0)} ns`;
  if (ns < 1e6) return `${(ns / 1000).toFixed(2)} µs`;
  return `${(ns / 1e6).toFixed(2)} ms`;
}

export default function BenchmarkPage() {
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
  const [result, setResult] = useState<Awaited<ReturnType<typeof runBenchmark>> | null>(
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
    setResult(null);
    try {
      const res = await runBenchmark({
        strategy: "sma_crossover",
        symbols: [symbol],
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        initial_capital: capital,
        fill_model: fillModel,
        strategy_params: { short_window: shortW, long_window: longW },
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const ring = result?.ring_buffer;
  const std = result?.standard_queue;
  const latMax = Math.max(
    ring?.avg_latency_ns ?? 0,
    std?.avg_latency_ns ?? 0,
    1,
  );
  const tpsMax = Math.max(
    ring?.throughput_events_per_sec ?? 0,
    std?.throughput_events_per_sec ?? 0,
    1,
  );

  const cpp = result?.cpp_native_mvp as
    | {
        extension_loaded?: boolean;
        workload?: Record<string, unknown>;
        results?: {
          ring?: Record<string, number>;
          queue?: Record<string, number>;
          speedup_factor?: number;
          latency_reduction_pct?: number;
          implementation?: string;
        };
        error?: string;
      }
    | null
    | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm text-slate-400">
          <Link href="/" className="text-blue-400 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/strategy" className="text-blue-400 hover:underline">
            Strategy
          </Link>
          {" · "}
          <Link href="/data" className="text-blue-400 hover:underline">
            Data
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Benchmark — ring buffer vs queue</h1>
        <p className="text-sm text-slate-400">
          Contribution 1: runs the same SMA backtest twice — once with a preallocated{" "}
          <strong className="text-slate-300">RingBuffer</strong>, once with Python&apos;s{" "}
          <strong className="text-slate-300">queue.Queue</strong> — and compares dequeue
          latency and throughput from{" "}
          <code className="rounded bg-slate-900 px-1 text-xs">POST /api/benchmark/run</code>.
          When the API is built with the optional <strong className="text-slate-300">engine_native</strong>{" "}
          extension and <code className="text-slate-500">USE_NATIVE_ENGINE</code> is on, the same
          response includes a <strong className="text-slate-300">C++ microbench</strong> (native ring
          vs native bounded deque) sized from the Python run&apos;s event volume — methodology note
          in the panel below.
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
        <p className="text-xs text-slate-500">
          Request body matches <code className="text-slate-400">POST /api/backtest/run</code>{" "}
          (symbol, dates, capital, fill model, SMA windows).
        </p>

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
          Fill model (same engine path; affects work per bar)
          <select
            value={fillModel}
            onChange={(e) =>
              setFillModel(e.target.value as "naive" | "probabilistic")
            }
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          >
            <option value="naive">Naive</option>
            <option value="probabilistic">Probabilistic</option>
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
          <span className="text-xs text-slate-500">{formatInr(capital, 0)}</span>
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
          className="w-full rounded bg-violet-600 py-2.5 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {running ? "Running benchmark (two passes)…" : "Run benchmark"}
        </button>
      </form>

      {result && ring && std && (
        <>
          <section className="rounded-xl border border-violet-900/50 bg-violet-950/20 px-6 py-4 text-center">
            <p className="text-sm text-violet-200">Speedup (avg dequeue latency)</p>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {result.speedup_factor.toFixed(2)}×
            </p>
            <p className="mt-1 text-sm text-slate-400">
              ~{result.latency_reduction_pct.toFixed(1)}% lower mean{" "}
              <code className="text-slate-500">get()</code> latency vs queue baseline
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-blue-800/60 bg-blue-950/30 p-5">
              <h2 className="text-sm font-medium uppercase tracking-wide text-blue-300">
                Ring buffer
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Avg latency</dt>
                  <dd className="font-mono text-slate-100">
                    {formatNs(ring.avg_latency_ns)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Wall time</dt>
                  <dd className="font-mono">{ring.total_time_ms.toFixed(2)} ms</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Throughput</dt>
                  <dd className="font-mono">
                    {ring.throughput_events_per_sec.toFixed(0)} evt/s
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Events</dt>
                  <dd className="font-mono">{ring.total_events.toFixed(0)}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-900/80 p-5">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
                Standard queue
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Avg latency</dt>
                  <dd className="font-mono text-slate-200">
                    {formatNs(std.avg_latency_ns)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Wall time</dt>
                  <dd className="font-mono">{std.total_time_ms.toFixed(2)} ms</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Throughput</dt>
                  <dd className="font-mono">
                    {std.throughput_events_per_sec.toFixed(0)} evt/s
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Events</dt>
                  <dd className="font-mono">{std.total_events.toFixed(0)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-lg font-medium">Average latency (lower is better)</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>Ring buffer</span>
                  <span className="font-mono">{formatNs(ring.avg_latency_ns)}</span>
                </div>
                <div className="h-8 overflow-hidden rounded bg-slate-950">
                  <div
                    className="h-full rounded bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                    style={{
                      width: `${Math.min(100, (100 * ring.avg_latency_ns) / latMax)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>queue.Queue</span>
                  <span className="font-mono">{formatNs(std.avg_latency_ns)}</span>
                </div>
                <div className="h-8 overflow-hidden rounded bg-slate-950">
                  <div
                    className="h-full rounded bg-gradient-to-r from-slate-600 to-slate-400 transition-all"
                    style={{
                      width: `${Math.min(100, (100 * std.avg_latency_ns) / latMax)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-lg font-medium">Throughput (higher is better)</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>Ring buffer</span>
                  <span className="font-mono">
                    {ring.throughput_events_per_sec.toFixed(0)} evt/s
                  </span>
                </div>
                <div className="h-8 overflow-hidden rounded bg-slate-950">
                  <div
                    className="h-full rounded bg-gradient-to-r from-emerald-700 to-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (100 * ring.throughput_events_per_sec) / tpsMax,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>queue.Queue</span>
                  <span className="font-mono">
                    {std.throughput_events_per_sec.toFixed(0)} evt/s
                  </span>
                </div>
                <div className="h-8 overflow-hidden rounded bg-slate-950">
                  <div
                    className="h-full rounded bg-gradient-to-r from-slate-600 to-slate-400 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (100 * std.throughput_events_per_sec) / tpsMax,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {cpp && (
            <section className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-6">
              <h2 className="mb-2 text-lg font-medium text-amber-100">
                C++ native MVP (Contribution 1 microbench)
              </h2>
              <p className="mb-4 text-xs text-amber-200/90">
                Synthetic burst workload in compiled code — <strong>not</strong> the same code path
                as the Python SMA run above. It is sized from this run&apos;s{" "}
                <code className="text-amber-100/80">total_puts</code> to keep scale comparable for
                committee narrative; see spec SECTION 0.B.
              </p>
              {!cpp.extension_loaded && (
                <p className="text-sm text-amber-300">
                  Extension not loaded. From <code className="text-xs">backend/</code>:{" "}
                  <code className="text-xs">pip install ./native_ext</code> (requires a C++17
                  toolchain). Set <code className="text-xs">USE_NATIVE_ENGINE=false</code> in{" "}
                  <code className="text-xs">backend/.env</code> to hide this panel&apos;s data.
                </p>
              )}
              {cpp.error && (
                <p className="text-sm text-red-300">Native bench error: {cpp.error}</p>
              )}
              {cpp.workload && (
                <pre className="mb-4 overflow-x-auto rounded border border-amber-900/40 bg-slate-950/80 p-3 text-xs text-slate-300">
                  {JSON.stringify(cpp.workload, null, 2)}
                </pre>
              )}
              {cpp.results?.ring && cpp.results?.queue && (
                <>
                  <p className="mb-2 text-center text-sm text-amber-100">
                    Native speedup (avg <code>get()</code>-style dequeue){" "}
                    <span className="font-mono text-lg font-semibold text-white">
                      {(cpp.results.speedup_factor ?? 1).toFixed(2)}×
                    </span>
                    <span className="text-slate-400">
                      {" "}
                      (~{(cpp.results.latency_reduction_pct ?? 0).toFixed(1)}% lower mean vs deque
                      baseline)
                    </span>
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-amber-700/40 bg-slate-950/50 p-4">
                      <h3 className="text-xs font-medium uppercase text-amber-300">C++ ring</h3>
                      <dl className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">Avg latency</dt>
                          <dd className="font-mono">
                            {formatNs(cpp.results.ring.avg_latency_ns ?? 0)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">Wall time</dt>
                          <dd className="font-mono">
                            {(cpp.results.ring.total_time_ms ?? 0).toFixed(2)} ms
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">Throughput</dt>
                          <dd className="font-mono">
                            {(cpp.results.ring.throughput_events_per_sec ?? 0).toFixed(0)} evt/s
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="rounded-lg border border-slate-600 bg-slate-900/60 p-4">
                      <h3 className="text-xs font-medium uppercase text-slate-400">
                        C++ bounded deque
                      </h3>
                      <dl className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">Avg latency</dt>
                          <dd className="font-mono">
                            {formatNs(cpp.results.queue.avg_latency_ns ?? 0)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">Wall time</dt>
                          <dd className="font-mono">
                            {(cpp.results.queue.total_time_ms ?? 0).toFixed(2)} ms
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">Throughput</dt>
                          <dd className="font-mono">
                            {(cpp.results.queue.throughput_events_per_sec ?? 0).toFixed(0)} evt/s
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  {cpp.results.implementation && (
                    <p className="mt-3 text-center text-xs text-slate-500">
                      {cpp.results.implementation}
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          <p className="text-xs text-slate-500">
            Single-threaded CPython: absolute nanoseconds vary by machine. The comparison
            is apples-to-apples on the same process for the same bar stream; speedup can
            be modest if deque overhead is small relative to strategy work.
          </p>
        </>
      )}
    </div>
  );
}
