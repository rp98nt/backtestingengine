"use client";

import Link from "next/link";
import { useState } from "react";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import {
  candidateMeta,
  contributionsMatrix,
  limitations,
  nonGoals,
  problemCards,
  speakerBullets,
  systemBullets,
  thesisSubtitle,
  thesisTitle,
} from "@/showcase/showcaseContent";

function ArchitectureStrip() {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-6">
      <p className="mb-4 text-sm font-medium text-slate-300">System context (simplified)</p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs sm:text-sm">
        <span className="rounded border border-slate-600 px-3 py-2">Browser</span>
        <span className="text-slate-500">→</span>
        <span className="rounded border border-blue-800/60 bg-blue-950/40 px-3 py-2 text-blue-200">
          Next.js
        </span>
        <span className="text-slate-500">→</span>
        <span className="rounded border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-emerald-200">
          FastAPI
        </span>
        <span className="text-slate-500">→</span>
        <span className="rounded border border-cyan-800/60 bg-cyan-950/40 px-3 py-2 text-cyan-200">
          Neon Postgres
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        REST for CSV, backtests, benchmark; <strong className="text-slate-400">WebSocket</strong>{" "}
        <code className="text-slate-500">/api/live/ws/{"{session}"}</code> for live equity replay after
        <code className="text-slate-500"> POST /api/live/start</code>.
      </p>
    </div>
  );
}

export default function ShowcasePage() {
  const [path, setPath] = useState<"5min" | "15min">("5min");
  const [archMode, setArchMode] = useState<"backtest" | "live">("backtest");

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12 text-[17px] leading-relaxed">
        <p className="text-sm text-slate-400">
          <Link href="/" className="text-blue-400 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/backtest" className="text-blue-400 hover:underline">
            Backtest hub
          </Link>
        </p>

        <header className="mt-6 border-b border-slate-800 pb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-400">
            Thesis showcase
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{thesisTitle}</h1>
          <p className="mt-3 text-slate-400">{thesisSubtitle.problem}</p>
          <p className="mt-2 text-slate-300">{thesisSubtitle.solution}</p>
          <p className="mt-4 text-sm text-slate-500">
            {candidateMeta.programme} · {candidateMeta.institution} · {candidateMeta.year}
          </p>
        </header>

        <section className="mt-10" id="path">
          <h2 className="text-xl font-semibold text-white">Demo path</h2>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPath("5min")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                path === "5min"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-600 text-slate-300 hover:bg-slate-900"
              }`}
            >
              5-minute path
            </button>
            <button
              type="button"
              onClick={() => setPath("15min")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                path === "15min"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-600 text-slate-300 hover:bg-slate-900"
              }`}
            >
              15-minute path
            </button>
          </div>
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-300">
            {speakerBullets[path].map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" id="problem">
          <h2 className="text-xl font-semibold text-white">Problem</h2>
          <div className="mt-4 space-y-4">
            {problemCards.map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <h3 className="font-medium text-blue-200">{c.title}</h3>
                <p className="mt-2 text-slate-400">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-slate-400">
            Practitioners rely on event-driven backtests for research velocity. When queue
            cost is ignored and fills are optimistic, capital allocation decisions drift from
            tradable reality.
          </p>
          <ul className="mt-4 list-inside list-disc text-sm text-slate-500">
            {nonGoals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" id="contributions">
          <h2 className="text-xl font-semibold text-white">Contributions</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Problem</th>
                  <th className="px-3 py-2 font-medium">Mechanism</th>
                  <th className="px-3 py-2 font-medium">In app</th>
                  <th className="px-3 py-2 font-medium">Metric</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {contributionsMatrix.map((row) => (
                  <tr key={row.id} className="bg-slate-950/40">
                    <td className="px-3 py-3 font-mono text-blue-300">{row.id}</td>
                    <td className="px-3 py-3 text-slate-300">{row.problem}</td>
                    <td className="px-3 py-3 text-slate-400">{row.mechanism}</td>
                    <td className="px-3 py-3">
                      <Link href={row.href} className="text-blue-400 hover:underline">
                        {row.linkLabel}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{row.metric}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12" id="system">
          <h2 className="text-xl font-semibold text-white">System context</h2>
          <ArchitectureStrip />
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-400">
            {systemBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" id="architecture">
          <h2 className="text-xl font-semibold text-white">Contribution 3 — diagram</h2>
          <p className="mt-2 text-sm text-slate-400">
            Toggle highlights which data and execution periphery is active (same strategy
            core). Open{" "}
            <Link href="/live" className="text-blue-400 hover:underline">
              /live
            </Link>{" "}
            for stub API + the same diagram.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setArchMode("backtest")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                archMode === "backtest"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-600 text-slate-300"
              }`}
            >
              Backtest mode
            </button>
            <button
              type="button"
              onClick={() => setArchMode("live")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                archMode === "live"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-600 text-slate-300"
              }`}
            >
              Live mode
            </button>
          </div>
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <ArchitectureDiagram mode={archMode} />
          </div>
        </section>

        <section className="mt-12" id="demos">
          <h2 className="text-xl font-semibold text-white">One-click demos</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/data"
              className="rounded-lg border border-slate-600 px-4 py-3 text-center hover:bg-slate-900"
            >
              Data Manager
            </Link>
            <Link
              href="/benchmark"
              className="rounded-lg border border-violet-700/60 bg-violet-950/30 px-4 py-3 text-center text-violet-200 hover:bg-violet-950/50"
            >
              Contribution 1 — Benchmark
            </Link>
            <Link
              href="/strategy/compare"
              className="rounded-lg border border-slate-600 px-4 py-3 text-center hover:bg-slate-900"
            >
              Contribution 2 — Compare fills
            </Link>
            <Link
              href="/strategy"
              className="rounded-lg border border-slate-600 px-4 py-3 text-center hover:bg-slate-900"
            >
              Run SMA backtest
            </Link>
            <Link
              href="/live"
              className="rounded-lg border border-slate-600 px-4 py-3 text-center hover:bg-slate-900"
            >
              Contribution 3 — Live (status)
            </Link>
          </div>
        </section>

        <section className="mt-12" id="limitations">
          <h2 className="text-xl font-semibold text-white">Limitations &amp; honesty</h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-400">
            {limitations.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <footer className="mt-14 border-t border-slate-800 pt-8 text-sm text-slate-500">
          Engineering SSOT:{" "}
          <code className="rounded bg-slate-900 px-1">doc/ALPHA_TEST_SPECIFICATION.md</code>
        </footer>
      </div>
    </div>
  );
}
