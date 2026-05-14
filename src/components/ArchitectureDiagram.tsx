"use client";

import type { ReactNode } from "react";

export type ArchitectureMode = "backtest" | "live";

const glow = "ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shadow-[0_0_20px_rgba(59,130,246,0.35)]";
const dim = "opacity-40";

function Box({
  children,
  active,
  className = "",
}: {
  children: ReactNode;
  active: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-center text-xs font-medium text-slate-200 transition-all sm:text-sm ${active ? glow : dim} ${className}`}
    >
      {children}
    </div>
  );
}

export function ArchitectureDiagram({ mode }: { mode: ArchitectureMode }) {
  const isBacktest = mode === "backtest";
  const isLive = mode === "live";

  return (
    <div className="space-y-4 text-slate-100">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-500">
        Engine architecture · mode ={" "}
        <span className="text-blue-400">{mode}</span>
      </p>

      {/* Level 1 */}
      <div>
        <p className="mb-2 text-center text-[10px] uppercase text-slate-500">Data sources</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Box active={isBacktest}>Historical files / Neon OHLCV</Box>
          <Box active={isLive}>Live market feed</Box>
        </div>
      </div>

      <div className="flex justify-center text-slate-600">↓</div>

      {/* Level 2 */}
      <div>
        <p className="mb-2 text-center text-[10px] uppercase text-slate-500">
          Data handler (swap)
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Box active={isBacktest}>HistoricalDataHandler</Box>
          <span className="text-xs text-slate-500">⇄</span>
          <Box active={isLive}>LiveDataHandler</Box>
        </div>
      </div>

      <div className="flex justify-center text-slate-600">↓</div>

      {/* Level 3 */}
      <div className="flex justify-center">
        <Box active className="max-w-xs border-violet-700/50 bg-violet-950/30 text-violet-100">
          Contribution 1 — event queue (RingBuffer)
        </Box>
      </div>

      <div className="flex justify-center text-slate-600">↓</div>

      {/* Level 4 */}
      <div>
        <p className="mb-2 text-center text-[10px] uppercase text-slate-500">
          Core path (same in all modes)
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Box active>Strategy</Box>
          <span className="text-slate-600">→</span>
          <Box active>Portfolio</Box>
          <span className="text-slate-600">→</span>
          <Box active>Risk</Box>
        </div>
      </div>

      <div className="flex justify-center text-slate-600">↓</div>

      {/* Level 5 */}
      <div>
        <p className="mb-2 text-center text-[10px] uppercase text-slate-500">
          Execution (swap) — only this changes backtest vs live
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Box active={isBacktest}>Simulated execution</Box>
          <span className="text-xs text-slate-500">⇄</span>
          <Box active={isLive}>Live broker API (future)</Box>
        </div>
      </div>

      <div className="flex justify-center text-slate-600">↓</div>

      {/* Level 6 */}
      <div>
        <p className="mb-2 text-center text-[10px] uppercase text-slate-500">Output</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Box active={isBacktest}>Performance analytics</Box>
          <Box active={isLive}>Real-time P&amp;L</Box>
        </div>
      </div>
    </div>
  );
}
