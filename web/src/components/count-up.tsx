"use client";

import { useEffect, useRef, useState } from "react";

// Count-up that runs once when the element scrolls into view. Uses a single
// rAF loop and stops on completion — no timers left running.
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 900,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Guard is per-effect, not a ref: React's dev double-mount would otherwise
    // mark it done on the first pass and leave the counter frozen at zero.
    let started = false;
    let raf = 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Jump straight to the value, but off the effect body so we don't
      // trigger a cascading synchronous render.
      raf = requestAnimationFrame(() => setN(value));
      return () => cancelAnimationFrame(raf);
    }

    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(value * (1 - Math.pow(1 - p, 3))); // easeOutCubic
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([e]) => e.isIntersecting && run(), { threshold: 0.2 });
    io.observe(el);
    // Already on screen at mount? Start immediately.
    if (el.getBoundingClientRect().top < window.innerHeight) run();

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}
