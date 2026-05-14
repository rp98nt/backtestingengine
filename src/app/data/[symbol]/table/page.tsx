"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchInstrumentOhlcvTable } from "@/lib/api";

const PAGE_SIZE = 100;

export default function OhlcvTablePage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const [symbol, setSymbol] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<
    {
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const p = await params;
      setSymbol(decodeURIComponent(p.symbol));
    })();
  }, [params]);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInstrumentOhlcvTable(symbol, PAGE_SIZE, offset);
      setRows(data.rows);
      setTotal(data.total_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [symbol, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 text-slate-100">
      <p className="text-sm text-slate-400">
        <Link href="/data" className="text-blue-400 hover:underline">
          ← Data Manager
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">
        OHLCV table · <span className="text-blue-400">{symbol || "…"}</span>
      </h1>
      <p className="text-sm text-slate-400">
        Total rows: {total}. Page {page} / {maxPage}
      </p>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 shadow">
        {loading ? (
          <p className="p-6 text-slate-400">Loading…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Timestamp</th>
                <th className="px-3 py-2 font-medium">Open</th>
                <th className="px-3 py-2 font-medium">High</th>
                <th className="px-3 py-2 font-medium">Low</th>
                <th className="px-3 py-2 font-medium">Close</th>
                <th className="px-3 py-2 font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.timestamp} className="border-b border-slate-900 hover:bg-slate-900/50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.timestamp}</td>
                  <td className="px-3 py-2">{r.open.toFixed(2)}</td>
                  <td className="px-3 py-2">{r.high.toFixed(2)}</td>
                  <td className="px-3 py-2">{r.low.toFixed(2)}</td>
                  <td className="px-3 py-2">{r.close.toFixed(2)}</td>
                  <td className="px-3 py-2">{r.volume.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={offset + PAGE_SIZE >= total || loading}
          onClick={() => setOffset(offset + PAGE_SIZE)}
          className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
