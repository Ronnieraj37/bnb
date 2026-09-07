"use client";

import { useEffect, useState } from "react";

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
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Guaranteed completion: fires even when the tab is backgrounded (rAF is
    // paused while hidden), so the real number is ALWAYS shown — never stuck at
    // zero. The rAF animation below is a progressive enhancement on top.
    const settle = setTimeout(() => setN(value), reduce ? 0 : duration + 120);

    if (!reduce) {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setN(value * (1 - Math.pow(1 - p, 3))); // easeOutCubic
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => { clearTimeout(settle); cancelAnimationFrame(raf); };
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}
