// A clean, modern backdrop: a deep near-black base, one soft warm glow up top,
// and a very faint grid for depth. No animated canvas, no "black hole" — just a
// calm surface that lets the content lead. (Kept the export name so existing
// imports don't churn.)
export function CosmicBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0a0908]">
      {/* soft warm glow, top */}
      <div
        className="absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(760px 340px at 50% -60px, rgba(240,185,11,0.10), transparent 70%)",
        }}
      />
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 50% 12%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 12%, black, transparent 78%)",
        }}
      />
      {/* gentle bottom fade so long pages settle into black */}
      <div
        className="absolute inset-x-0 bottom-0 h-64"
        style={{ background: "linear-gradient(180deg, transparent, #0a0908)" }}
      />
    </div>
  );
}
