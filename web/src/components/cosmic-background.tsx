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

    const paint = () => {
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
    };

    // Throttle the starfield to ~30fps and pause it when the tab is hidden or
    // the OS asks for reduced motion — the twinkle is subtle, so halving the
    // frame rate is invisible but frees a large chunk of the compositor budget
    // the glass panels need for smooth scrolling.
    const FRAME_MS = 1000 / 30;
    let last = 0;
    const loop = (t: number) => {
      if (document.hidden) { raf = requestAnimationFrame(loop); return; }
      if (t - last >= FRAME_MS) { last = t; paint(); }
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) paint();
    else raf = requestAnimationFrame(loop);
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
            "radial-gradient(1100px 760px at 74% 12%, rgba(240,185,11,0.10), transparent 60%)," +
            "radial-gradient(900px 700px at 12% 92%, rgba(120,72,10,0.09), transparent 55%)," +
            "linear-gradient(180deg, #0a0908 0%, #0c0a07 50%, #0a0908 100%)",
        }}
      />

      {/* starfield */}
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />

      {/* black-hole swirl — a corner accent, tucked into the top-right so it
          frames content rather than covering it. STATIC: animating these huge
          64px-blur layers forced a full re-raster every frame AND made every
          backdrop-blur glass panel re-sample a moving background, which is what
          made scrolling choppy. A static glow is visually near-identical and
          essentially free once composited. */}
      <div className="absolute -right-[12%] -top-[30%] h-[500px] w-[500px] opacity-60 sm:h-[560px] sm:w-[560px]">
        {/* accretion disk — two conic gradients, blurred */}
        <div
          className="absolute inset-0 rounded-full blur-[64px]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent, rgba(240,185,11,0.42), rgba(255,153,0,0.45), rgba(180,110,20,0.28), transparent 55%, rgba(240,185,11,0.35), transparent)",
          }}
        />
        <div
          className="absolute inset-6 rounded-full blur-[54px]"
          style={{
            background:
              "conic-gradient(from 120deg, transparent, rgba(255,224,102,0.28), transparent 35%, rgba(255,153,0,0.22), transparent 70%)",
          }}
        />
        {/* nebula cloud */}
        <div
          className="absolute inset-12 rounded-full blur-[60px]"
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
