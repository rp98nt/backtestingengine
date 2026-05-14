import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/data", label: "Data" },
  { href: "/strategy", label: "Strategy" },
  { href: "/backtest", label: "Backtest" },
  { href: "/results", label: "Results" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/strategy/compare", label: "Compare fills" },
  { href: "/showcase", label: "Showcase" },
  { href: "/live", label: "Live" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm">
      <nav
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
        aria-label="Primary"
      >
        <span className="mr-1 font-semibold tracking-tight text-slate-300">α AlphaTest</span>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-slate-400 transition hover:text-white"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
