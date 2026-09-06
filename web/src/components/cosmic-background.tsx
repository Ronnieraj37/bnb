"use client";

import { useEffect, useRef } from "react";

// Layered cosmic scene: a drifting/twinkling starfield on <canvas> behind a
// CSS-driven black-hole swirl (counter-rotating conic gradients + a dark void
// with a glowing photon ring). Cheap, GPU-friendly, respects reduced-motion.
export function CosmicBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0;
    type Star = { x: number; y: number; z: number; r: number; tw: number };
    let stars: Star[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(420, Math.floor((w * h) / 5200));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.tw += 0.015 + s.z * 0.02;
        s.x += s.z * 0.04;
        if (s.x > w + 2) s.x = -2;
        const a = (0.35 + Math.sin(s.tw) * 0.4) * (0.25 + s.z * 0.75);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = s.z > 0.82 ? "#ffe9b0" : s.z > 0.6 ? "#fff3d6" : "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) draw();
    else raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* deep-space base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 800px at 72% 18%, rgba(240,185,11,0.16), transparent 60%)," +
            "radial-gradient(900px 700px at 15% 90%, rgba(120,72,10,0.14), transparent 55%)," +
            "linear-gradient(180deg, #0a0908 0%, #0d0a06 50%, #0a0908 100%)",
        }}
      />

      {/* starfield */}
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />

      {/* black-hole swirl — a corner accent, tucked into the top-right so it
          frames content rather than covering it */}
      <div className="absolute -right-[10%] -top-[26%] h-[540px] w-[540px] opacity-85 sm:h-[600px] sm:w-[600px]">
        {/* accretion disk — two counter-rotating conic gradients, blurred */}
        <div
          className="absolute inset-0 rounded-full blur-[64px] animate-[spin-slow_48s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent, rgba(240,185,11,0.42), rgba(255,153,0,0.45), rgba(180,110,20,0.28), transparent 55%, rgba(240,185,11,0.35), transparent)",
          }}
        />
        <div
          className="absolute inset-6 rounded-full blur-[54px] animate-[spin-rev_72s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 120deg, transparent, rgba(255,224,102,0.28), transparent 35%, rgba(255,153,0,0.22), transparent 70%)",
          }}
        />
        {/* nebula cloud drift */}
        <div
          className="absolute inset-12 rounded-full blur-[60px] animate-[drift_18s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,205,90,0.30), transparent 55%)",
          }}
        />
        {/* event horizon void + photon ring — softened, blends into bg */}
        <div
          className="absolute left-1/2 top-1/2 h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(10,9,8,0.96) 42%, rgba(10,9,8,0.5) 60%, transparent 74%)",
            boxShadow:
              "0 0 56px 2px rgba(240,185,11,0.45), inset 0 0 26px 2px rgba(255,153,0,0.30)",
          }}
        />
      </div>

      {/* vignette + readability veil */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, transparent 55%, rgba(10,9,8,0.55) 100%)",
        }}
      />
    </div>
  );
}
