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
    const t = setTimeout(() => setList(compareStore.get()), 0);
    const onChange = () => setList(compareStore.get());
    window.addEventListener("proven:compare-changed", onChange);
    return () => {
      clearTimeout(t);
      window.removeEventListener("proven:compare-changed", onChange);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl glass-strong px-3 py-2.5 shadow-[0_20px_60px_-15px_rgba(240,185,11,0.4)] sm:w-auto sm:gap-3 sm:px-4 sm:py-3">
        <Scale size={15} className="shrink-0 text-violet" />
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {list.map((e) => (
            <span key={e.id} className="flex max-w-[8.5rem] items-center gap-1 rounded-full bg-violet/15 px-2.5 py-1 text-[12px] text-violet">
              <span className="truncate">{e.name}</span>
              <button onClick={() => compareStore.toggle(e)} aria-label={`Remove ${e.name}`} className="shrink-0">
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
