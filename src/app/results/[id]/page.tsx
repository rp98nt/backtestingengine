"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchBacktestResult } from "@/lib/api";

export default function BacktestResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBacktestResult>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const p = await params;
      setId(p.id);
    })();
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBacktestResult(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tailEquity = data?.equity_curve?.slice(-80) ?? [];
  const tailTrades = data?.trade_log?.slice(-40) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-slate-100">
      <p className="text-sm text-slate-400">
        <Link href="/strategy" className="text-blue-400 hover:underline">
          ← Strategy
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Backtest result</h1>
      <p className="font-mono text-xs text-slate-500">{id || "…"}</p>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : data ? (
        <>
          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">Status</h2>
            <p className="text-slate-300">
              <span className="font-semibold text-white">{data.status}</span>
            </p>
            {data.status === "failed" && (
              <p className="mt-2 text-sm text-red-300">
                {String(data.engine_metrics?.error ?? "")}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">Config</h2>
            <pre className="overflow-x-auto text-xs text-slate-400">
              {JSON.stringify(data.config, null, 2)}
            </pre>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">Performance</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {Object.entries(data.performance_metrics).map(([k, v]) => (
                <div key={k} className="rounded bg-slate-950/80 px-3 py-2">
                  <dt className="text-xs uppercase text-slate-500">{k}</dt>
                  <dd className="font-mono text-slate-200">
                    {typeof v === "number" ? v.toFixed(4) : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">Engine</h2>
            <pre className="text-xs text-slate-400">
              {JSON.stringify(data.engine_metrics, null, 2)}
            </pre>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">
              Equity curve <span className="text-xs font-normal text-slate-500">(last 80 points)</span>
            </h2>
            <div className="max-h-80 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
              {tailEquity.map((pt, i) => (
                <div key={`${pt.timestamp}-${i}`} className="border-b border-slate-900 py-1">
                  {pt.timestamp} · PV {(pt.portfolio_value as number).toFixed(2)} · cash{" "}
                  {(pt.cash as number).toFixed(0)}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
            <h2 className="mb-3 text-lg font-medium">
              Fills <span className="text-xs font-normal text-slate-500">(last 40)</span>
            </h2>
            <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
              {tailTrades.map((t, i) => (
                <div key={i} className="border-b border-slate-900 py-1">
                  {JSON.stringify(t)}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
