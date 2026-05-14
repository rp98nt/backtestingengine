"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchBacktestRuns } from "@/lib/api";

const PAGE = 25;

export default function ResultsIndexPage() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBacktestRuns>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBacktestRuns(PAGE, offset));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.total_count ?? 0;
  const pageNum = Math.floor(offset / PAGE) + 1;
  const maxPage = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 text-slate-100">
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
          <Link href="/strategy" className="text-blue-400 hover:underline">
            Run new
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Backtest runs</h1>
        <p className="text-sm text-slate-400">
          Rows from Neon <code className="rounded bg-slate-900 px-1 text-xs">backtest_runs</code>
          (newest first). Open a run for full equity curve and fills.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : !data?.runs.length ? (
        <p className="text-slate-400">No runs yet. Start from Strategy or Compare fills.</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Showing {offset + 1}–{Math.min(offset + data.runs.length, total)} of {total}
          </p>
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-700 bg-slate-900/60">
            {data.runs.map((run) => (
              <li key={run.backtest_id}>
                <Link
                  href={`/results/${encodeURIComponent(run.backtest_id)}`}
                  className="flex flex-col gap-1 px-4 py-4 hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-sm text-blue-300">{run.backtest_id}</p>
                    <p className="text-sm text-slate-300">
                      <span className="font-semibold">{run.symbol_key}</span>
                      {" · "}
                      {run.strategy}
                      {run.fill_model ? ` · ${run.fill_model}` : ""}
                      {run.compare_role ? (
                        <span className="text-slate-500"> ({run.compare_role})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">{run.created_at}</p>
                  </div>
                  <div className="text-right text-sm">
                    <span
                      className={
                        run.status === "completed"
                          ? "text-emerald-400"
                          : run.status === "failed"
                            ? "text-red-400"
                            : "text-amber-400"
                      }
                    >
                      {run.status}
                    </span>
                    {run.total_return != null && (
                      <p className="font-mono text-slate-300">
                        return {(run.total_return * 100).toFixed(2)}%
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
              className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE >= total || loading}
              onClick={() => setOffset(offset + PAGE)}
              className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
            >
              Next
            </button>
            <span className="self-center text-xs text-slate-500">
              Page {pageNum} / {maxPage}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
