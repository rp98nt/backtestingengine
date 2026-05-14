import Link from "next/link";

export default function LivePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-16 text-slate-100">
      <p className="text-sm text-slate-400">
        <Link href="/showcase" className="text-blue-400 hover:underline">
          ← Showcase
        </Link>
        {" · "}
        <Link href="/" className="text-blue-400 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Live simulation</h1>
      <p className="text-slate-400">
        Contribution 3 — unified architecture with WebSocket streaming — is{" "}
        <strong className="text-slate-300">not implemented</strong> in this MVP slice.
        The spec (SECTION 4 live routes and <code className="text-slate-500">/ws/live</code>)
        remains the target for a follow-on increment.
      </p>
      <p className="text-sm text-slate-500">
        Until then, use the same SMA configuration on{" "}
        <Link href="/strategy" className="text-blue-400 hover:underline">
          /strategy
        </Link>{" "}
        for historical backtests and review outcomes under{" "}
        <Link href="/results" className="text-blue-400 hover:underline">
          /results
        </Link>
        .
      </p>
    </div>
  );
}
