"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SymbolSparkline } from "@/components/SymbolSparkline";
import {
  fetchInstruments,
  importInstrumentCsv,
} from "@/lib/api";

const SYMBOL_OPTIONS = [
  { key: "HDFC", label: "HDFC (HDFCBANK CSV)" },
  { key: "ICICI", label: "ICICI (ICICIBANK CSV)" },
  { key: "RELIANCE", label: "RELIANCE" },
  { key: "NIFTY50", label: "Nifty 50 index CSV" },
  { key: "NIFTYBANK", label: "Nifty Bank index CSV" },
];

export default function DataManagerPage() {
  const [instruments, setInstruments] = useState<
    {
      symbol: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      total_bars: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [symbolKey, setSymbolKey] = useState("HDFC");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInstruments(await fetchInstruments());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("symbol_key", symbolKey);
      await importInstrumentCsv(fd);
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm text-slate-400">
          <Link href="/" className="text-blue-400 hover:underline">
            Home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Data Manager</h1>
        <p className="text-slate-400">
          Import NSE-style OHLCV CSVs (equity bhav or index files). Data is stored in
          Postgres (Neon-compatible) per project spec.
        </p>
      </header>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 shadow">
        <h2 className="mb-4 text-lg font-medium">Import CSV</h2>
        <form onSubmit={onImport} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            Symbol key
            <select
              value={symbolKey}
              onChange={(e) => setSymbolKey(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            >
              {SYMBOL_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={importing}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Expected formats: equity columns include Date, Open Price, High Price, Low
          Price, Close Price, Total Traded Quantity; index files use Date, Open,
          High, Low, Close, Shares Traded.
        </p>
      </section>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 shadow">
        <h2 className="mb-4 text-lg font-medium">Loaded instruments</h2>
        <p className="mb-4 text-xs text-slate-500">
          Close-price preview (last ~200 bars) via <code className="text-slate-400">GET /api/data/ohlcv/{"{symbol}"}</code> — SECTION 0.A chart preview.
        </p>
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : instruments.length === 0 ? (
          <p className="text-slate-400">No instruments yet. Import a CSV above.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {instruments.map((i) => (
              <li
                key={i.symbol}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.symbol}</p>
                    <p className="text-sm text-slate-400">{i.name}</p>
                    <p className="text-xs text-slate-500">
                      {i.start_date} → {i.end_date} · {i.total_bars} bars
                    </p>
                  </div>
                  <div className="shrink-0 rounded border border-slate-800/80 bg-slate-950/50 px-2 py-1">
                    <SymbolSparkline symbol={i.symbol} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/data/${encodeURIComponent(i.symbol)}/table`}
                    className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
                  >
                    View OHLCV table
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
