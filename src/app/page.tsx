import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-20">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-400">
            AlphaTest
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Low-latency event-driven backtesting
          </h1>
          <p className="mt-3 text-slate-400">
            MTech thesis stack: Next.js UI + FastAPI + Postgres (Neon-compatible).
            Chunk 1 ships data import and OHLCV tables; engine and full dashboards
            follow the spec in <code className="rounded bg-slate-900 px-1 text-sm">doc/ALPHA_TEST_SPECIFICATION.md</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/data"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500"
          >
            Open Data Manager
          </Link>
          <a
            href="https://github.com/rp98nt/backtestingengine"
            className="rounded-lg border border-slate-600 px-5 py-2.5 font-medium hover:bg-slate-900"
            target="_blank"
            rel="noreferrer"
          >
            Repository
          </a>
        </div>
        <p className="text-xs text-slate-500">
          Set <code className="text-slate-400">DATABASE_URL</code> in{" "}
          <code className="text-slate-400">backend/.env</code> (Neon — see{" "}
          <code className="text-slate-400">.env.example</code>) · API:{" "}
          <code className="text-slate-400">cd backend && uvicorn app.main:app --reload</code>{" "}
          · Copy <code className="text-slate-400">.env.example</code> to{" "}
          <code className="text-slate-400">.env.local</code> for the web app.
        </p>
      </main>
    </div>
  );
}
