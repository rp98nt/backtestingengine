"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { apiWsUrl } from "@/lib/apiBase";
import {
  fetchInstruments,
  getLiveStatus,
  startLiveSession,
  stopLiveSession,
} from "@/lib/api";
import { formatInr } from "@/lib/formatInr";

type WsMsg = Record<string, unknown>;

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
  const [wsLog, setWsLog] = useState<WsMsg[]>([]);
  const [wsState, setWsState] = useState<"idle" | "connecting" | "open" | "closed">("idle");
  const [lastTick, setLastTick] = useState<WsMsg | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatusText(null);
    setWsLog([]);
    setLastTick(null);
    wsRef.current?.close();
    wsRef.current = null;
    setWsState("idle");
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
      wsRef.current?.close();
      wsRef.current = null;
      setWsState("closed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function connectWebSocket() {
    if (!sessionId) return;
    const url = apiWsUrl(`/api/live/ws/${encodeURIComponent(sessionId)}`);
    if (!url) {
      setError(
        "WebSocket URL unavailable: set NEXT_PUBLIC_API_BASE_URL (or NEXT_PUBLIC_WS_BASE_URL) to your FastAPI origin so the browser can open wss://… Vercel same-origin /api/backend proxy does not support WS upgrades.",
      );
      return;
    }
    setError(null);
    setWsLog([]);
    setLastTick(null);
    wsRef.current?.close();
    setWsState("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsState("open");
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as WsMsg;
        setWsLog((prev) => [...prev.slice(-40), msg]);
        if (msg.type === "tick") setLastTick(msg);
      } catch {
        setWsLog((prev) => [...prev, { type: "parse_error", raw: ev.data }]);
      }
    };
    ws.onerror = () => {
      setError("WebSocket error (check API URL, TLS, and that the session is ready).");
      setWsState("closed");
    };
    ws.onclose = () => {
      setWsState("closed");
      wsRef.current = null;
    };
  }

  const wsUrlPreview = sessionId ? apiWsUrl(`/api/live/ws/${encodeURIComponent(sessionId)}`) : null;

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
        <strong className="text-slate-300">MVP:</strong>{" "}
        <code className="text-xs text-slate-500">POST /api/live/start</code> loads OHLCV from
        Neon, runs one <strong className="text-slate-300">naive SMA</strong> backtest, then streams
        subsampled equity points over{" "}
        <code className="text-xs text-slate-500">WebSocket /api/live/ws/{"{session_id}"}</code> for
        Contribution 3 (same strategy path as historical; live path replays precomputed equity).
      </p>

      {!wsUrlPreview && (
        <div className="rounded border border-amber-800/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          For WebSocket streaming on this host, configure{" "}
          <code className="text-xs">NEXT_PUBLIC_API_BASE_URL</code> (or{" "}
          <code className="text-xs">NEXT_PUBLIC_WS_BASE_URL</code>) in{" "}
          <code className="text-xs">.env.local</code> to your FastAPI <code className="text-xs">wss://</code>{" "}
          origin. Local default without proxy uses <code className="text-xs">ws://127.0.0.1:8000</code>.
        </div>
      )}

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
        <h2 className="text-lg font-medium">Prepare replay session</h2>
        <label className="flex flex-col gap-1 text-sm">
          Symbol
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={loading || instruments.length === 0}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          >
            {instruments.length === 0 ? (
              <option value="">No instruments — import CSV on /data first</option>
            ) : (
              instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol}
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
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
          />
          <span className="text-xs text-slate-500">{formatInr(capital, 0)}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Speed multiplier (higher = faster ticks)
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
          {busy ? "Working…" : "POST /api/live/start (prepare replay)"}
        </button>
      </form>

      {sessionId && (
        <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-sm">
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
              disabled={busy || !wsUrlPreview}
              onClick={() => connectWebSocket()}
              className="rounded border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
            >
              {wsState === "connecting"
                ? "Connecting…"
                : wsState === "open"
                  ? "Reconnect stream"
                  : "Open WebSocket stream"}
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

          {lastTick && lastTick.type === "tick" && (
            <div className="mt-4 rounded border border-slate-600 bg-slate-950/60 p-4">
              <p className="text-xs uppercase text-slate-500">Latest tick</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatInr(Number(lastTick.portfolio_value ?? 0), 0)}
              </p>
              <p className="text-xs text-slate-400">
                Progress {String(lastTick.pct ?? 0)}% · index {String(lastTick.index)}/
                {String(lastTick.total)}
              </p>
            </div>
          )}

          {wsLog.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto rounded border border-slate-800 bg-slate-950/40 p-3 font-mono text-xs text-slate-400">
              {wsLog.map((m, i) => (
                <div key={i} className="border-b border-slate-800/80 py-1 last:border-0">
                  {JSON.stringify(m)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
