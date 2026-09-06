"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { compareStore, type CompareEntry } from "@/lib/compare-store";

export function CompareCheckbox({ entry }: { entry: CompareEntry }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Deferred off the effect body: setState synchronously here would
    // cascade a render on every mount.
    const raf = requestAnimationFrame(() => setChecked(compareStore.has(entry.id)));
    const onChange = () => setChecked(compareStore.has(entry.id));
    window.addEventListener("proven:compare-changed", onChange);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("proven:compare-changed", onChange);
    };
  }, [entry.id]);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        compareStore.toggle(entry);
      }}
      title={checked ? "Remove from compare" : "Add to compare"}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition ${
        checked
          ? "border-violet/50 bg-violet/15 text-violet"
          : "border-white/10 text-muted hover:border-violet/30 hover:text-fg"
      }`}
    >
      <Scale size={11} />
      {checked ? "Comparing" : "Compare"}
    </button>
  );
}
