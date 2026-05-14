/** Normalized close-price sparkline (SVG). Pure — pass chronological closes. */

export function CloseSparkline({
  closes,
  width = 120,
  height = 36,
}: {
  closes: number[];
  width?: number;
  height?: number;
}) {
  const n = closes.length;
  if (n < 2) {
    return (
      <span className="inline-block text-[10px] text-slate-600" style={{ width }}>
        —
      </span>
    );
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = closes
    .map((c, i) => {
      const x = pad + (i / (n - 1)) * w;
      const y = pad + h - ((c - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="inline-block align-middle text-blue-400"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}
