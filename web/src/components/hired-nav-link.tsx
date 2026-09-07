"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { sessionStore, CHANGED } from "@/lib/session/store";

// Header link to the user's hired agents, with a live active-count badge.
export function HiredNavLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(sessionStore.active().length);
    sync();
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  return (
    <Link
      href="/hired"
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-muted transition hover:border-violet/30 hover:text-fg"
    >
      <Bot size={15} className={count ? "text-violet" : ""} />
      <span className="hidden sm:inline">My agents</span>
      {count > 0 && (
        <span className="rounded-full bg-violet/20 px-1.5 text-[11px] font-medium text-violet">{count}</span>
      )}
    </Link>
  );
}
