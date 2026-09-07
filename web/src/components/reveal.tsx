import type { ReactNode } from "react";

// Entrance reveal via pure CSS (see .reveal in globals.css). No framer-motion,
// no hydration dependency — content is visible even if JS never runs, which
// fixes the whileInView bug where a hidden/slow container left sections stuck
// at opacity:0. `delay` staggers the fade; reduced-motion disables it.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`reveal ${className ?? ""}`} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}
