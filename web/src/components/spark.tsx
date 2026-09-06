// A dependency-free inline-SVG line chart for the equity curve. Matches the
// codebase's inline-SVG style (score-ring, cosmic-background) — no chart lib,
// no CSP surprises. Renders a filled area + line; colour reflects net direction.

export function Spark({
  points,
  width = 520,
  height = 96,
}: {
  points: { t: number; v: number }[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = 4;

  const nx = (t: number) => pad + ((t - minX) / spanX) * (width - pad * 2);
  const ny = (v: number) => height - pad - ((v - minY) / spanY) * (height - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${nx(p.t).toFixed(1)} ${ny(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L ${nx(maxX).toFixed(1)} ${ny(minY).toFixed(1)} L ${nx(minX).toFixed(1)} ${ny(minY).toFixed(1)} Z`;
  const up = ys[ys.length - 1] >= 0;
  const stroke = up ? "var(--color-pos, #2ee6a6)" : "var(--color-neg, #ff5c78)";
  const zeroY = ny(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative capital deployed over time">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* zero baseline */}
      <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
