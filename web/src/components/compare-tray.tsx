"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Scale } from "lucide-react";
import { compareStore, type CompareEntry } from "@/lib/compare-store";

// Floating tray that appears once something is selected for comparison, on
// every page, so picking agents from different category views still works.
export function CompareTray() {
  const [list, setList] = useState<CompareEntry[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setList(compareStore.get()));
    const onChange = () => setList(compareStore.get());
    window.addEventListener("proven:compare-changed", onChange);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("proven:compare-changed", onChange);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl glass-strong px-4 py-3 shadow-[0_20px_60px_-15px_rgba(168,85,247,0.5)]">
        <Scale size={15} className="text-violet" />
        <div className="flex flex-wrap gap-1.5">
          {list.map((e) => (
            <span key={e.id} className="flex items-center gap-1 rounded-full bg-violet/15 px-2.5 py-1 text-[12px] text-violet">
              {e.name}
              <button onClick={() => compareStore.toggle(e)} aria-label={`Remove ${e.name}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <Link
          href={`/compare?ids=${list.map((e) => encodeURIComponent(e.id)).join(",")}`}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition ${
            list.length >= 2 ? "bg-linear-to-r from-violet to-magenta hover:brightness-110" : "cursor-not-allowed bg-white/10 text-muted"
          }`}
        >
          Compare {list.length >= 2 ? `(${list.length})` : "— pick one more"}
        </Link>
        <button onClick={compareStore.clear} className="text-[11px] text-muted hover:text-fg">
          Clear
        </button>
      </div>
    </div>
  );
}
