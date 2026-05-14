/** SVG line chart of portfolio value over time (downsampled for large runs). */

type Pt = { portfolio_value: number };

function sampleValues(points: Pt[], maxPoints: number): number[] {
  const raw = points.map((p) => Number(p.portfolio_value));
  if (raw.length <= maxPoints) return raw;
  const out: number[] = [];
  const n = raw.length;
  const step = (n - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(n - 1, Math.round(i * step));
    out.push(raw[idx]);
  }
  return out;
}

export function EquityCurveChart({
  points,
  width = 640,
  height = 200,
  maxPoints = 500,
}: {
  points: Pt[];
  width?: number;
  height?: number;
  maxPoints?: number;
}) {
  const values = sampleValues(points, maxPoints);
  const n = values.length;
  if (n < 2) {
    return (
      <p className="text-sm text-slate-500">Not enough equity points to plot.</p>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padX = 8;
  const padY = 12;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const poly = values
    .map((v, i) => {
      const x = padX + (i / (n - 1)) * w;
      const y = padY + h - ((v - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={width}
        height={height}
        className="text-emerald-400"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Equity curve: portfolio value over time"
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgb(2 6 23 / 0.5)"
          rx={6}
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly}
        />
      </svg>
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500">
        <span>
          Min: <span className="font-mono text-slate-400">{min.toFixed(0)}</span>
        </span>
        <span>
          Max: <span className="font-mono text-slate-400">{max.toFixed(0)}</span>
        </span>
        <span>({points.length} bars in series)</span>
      </p>
    </div>
  );
}
