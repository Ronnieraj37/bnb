// 8004scan's own composite score (0-100). We display it as-is and never
// re-weight it, so what you see here matches the registry.
export function ScoreRing({
  score,
  rank,
  size = 56,
}: {
  score: number;
  rank?: number | null;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const tone =
    pct >= 60 ? "var(--color-pos)" : pct >= 30 ? "var(--color-violet)" : "var(--color-muted)";
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`8004scan score ${score}${rank ? ` · rank #${rank}` : ""}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={tone} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-semibold leading-none" style={{ color: tone }}>
          {score.toFixed(0)}
        </span>
        {rank != null && <span className="mt-0.5 text-[9px] text-muted">#{rank}</span>}
      </div>
    </div>
  );
}
