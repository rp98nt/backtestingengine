"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import {
  fetchInstruments,
  getLiveStatus,
  startLiveSession,
  stopLiveSession,
} from "@/lib/api";

export default function LivePage() {
  const [mode, setMode] = useState<"backtest" | "live">("live");
  const [instruments, setInstruments] = useState<{ symbol: string; name: string }[]>(
    [],
  );
  const [symbol, setSymbol] = useState("HDFC");
  const [capital, setCapital] = useState(1_000_000);
  const [speed, setSpeed] = useState(10);
  const [startReplay, setStartReplay] = useState("");
  const [endReplay, setEndReplay] = useState("");
  const [shortW, setShortW] = useState(20);
  const [longW, setLongW] = useState(50);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatusText(null);
    try {
      const res = await startLiveSession({
        strategy: "sma_crossover",
        symbols: [symbol],
        replay_start_date: startReplay.trim() || null,
        replay_end_date: endReplay.trim() || null,
        speed_multiplier: speed,
        initial_capital: capital,
        strategy_params: { short_window: shortW, long_window: longW },
      });
      setSessionId(res.session_id);
      const st = await getLiveStatus(res.session_id);
      setStatusText(st.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshStatus() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const st = await getLiveStatus(sessionId);
      setStatusText(st.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onStop() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const st = await stopLiveSession(sessionId);
      setStatusText(st.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-slate-100">
      <p className="text-sm text-slate-400">
        <Link href="/showcase" className="text-blue-400 hover:underline">
          Showcase
        </Link>
        {" · "}
        <Link href="/" className="text-blue-400 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Live simulation</h1>
      <p className="text-sm text-slate-400">
        <strong className="text-slate-300">Stub API:</strong>{" "}
        <code className="text-xs text-slate-500">POST /api/live/start</code> creates an
        in-memory session. No WebSocket bar stream yet — status explains the gap.
      </p>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-lg font-medium">Architecture (Contribution 3)</h2>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("backtest")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              mode === "backtest"
                ? "bg-blue-600 text-white"
                : "border border-slate-600 text-slate-300"
            }`}
          >
            Backtest
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              mode === "live"
                ? "bg-blue-600 text-white"
                : "border border-slate-600 text-slate-300"
            }`}
          >
            Live
          </button>
        </div>
        <ArchitectureDiagram mode={mode} />
      </section>

      <form
        onSubmit={onStart}
        className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-6"
      >
        <h2 className="text-lg font-medium">Start stub session</h2>
        <label className="flex flex-col gap-1 text-sm">
          Symbol
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={loading || instruments.length === 0}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          >
            {instruments.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Initial capital
          <input
            type="number"
            min={1000}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Speed multiplier
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Replay start
            <input
              type="date"
              value={startReplay}
              onChange={(e) => setStartReplay(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Replay end
            <input
              type="date"
              value={endReplay}
              onChange={(e) => setEndReplay(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>
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
        <button
          type="submit"
          disabled={busy || instruments.length === 0}
          className="w-full rounded bg-rose-700 py-2.5 font-medium text-white hover:bg-rose-600 disabled:opacity-50"
        >
          {busy ? "Working…" : "POST /api/live/start"}
        </button>
      </form>

      {sessionId && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-sm">
          <p className="font-mono text-xs text-slate-400">session_id</p>
          <p className="break-all font-mono text-blue-300">{sessionId}</p>
          {statusText && <p className="mt-3 text-slate-300">{statusText}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRefreshStatus()}
              className="rounded border border-slate-600 px-3 py-1.5 hover:bg-slate-800"
            >
              Refresh status
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStop()}
              className="rounded border border-slate-600 px-3 py-1.5 hover:bg-slate-800"
            >
              Stop session
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
