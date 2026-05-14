import Link from "next/link";

export default function BacktestHubPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <p className="text-sm text-slate-400">
          <Link href="/" className="text-blue-400 hover:underline">
            Home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Run backtest</h1>
        <p className="text-sm text-slate-400">
          Configure and run on the Strategy page (sync HTTP run → Neon). Compare fills
          and past runs are linked below. <strong className="text-slate-300">Live equity</strong>{" "}
          streams over WebSocket on <Link href="/live" className="text-blue-400 hover:underline">/live</Link> after
          preparing a session; backtest completion itself remains synchronous HTTP.
        </p>
      </header>

      <ul className="space-y-3">
        <li>
          <Link
            href="/showcase"
            className="block rounded-xl border border-amber-800/40 bg-amber-950/20 px-5 py-4 font-medium text-amber-100 hover:bg-amber-950/40"
          >
            Thesis showcase (guided demo) →
          </Link>
        </li>
        <li>
          <Link
            href="/strategy"
            className="block rounded-xl border border-blue-800/50 bg-blue-950/30 px-5 py-4 font-medium hover:bg-blue-950/50"
          >
            Configure &amp; run SMA backtest →
          </Link>
        </li>
        <li>
          <Link
            href="/strategy/compare"
            className="block rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 hover:bg-slate-800/80"
          >
            Compare naive vs probabilistic fills →
          </Link>
        </li>
        <li>
          <Link
            href="/results"
            className="block rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 hover:bg-slate-800/80"
          >
            View all saved runs →
          </Link>
        </li>
      </ul>
    </div>
  );
}
