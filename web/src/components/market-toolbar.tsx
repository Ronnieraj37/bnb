"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, Check } from "lucide-react";

// Real sort + filters, driven by URL params so results stay shareable and the
// server does the actual sorting/filtering. Preserves category/search.

const SORTS = [
  { key: "score", label: "Best score" },
  { key: "feedback", label: "Most reviewed" },
  { key: "newest", label: "Newest" },
] as const;

export function MarketToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const sort = params.get("sort") ?? "score";
  const x402 = params.get("x402") === "1";
  const reviews = params.get("reviews") === "1";

  const push = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mut(next);
    const s = next.toString();
    router.push(s ? `/?${s}` : "/");
  };

  const setSort = (key: string) => push((p) => (key === "score" ? p.delete("sort") : p.set("sort", key)));
  const toggle = (key: "x402" | "reviews", on: boolean) => push((p) => (on ? p.delete(key) : p.set(key, "1")));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChip active={x402} onClick={() => toggle("x402", x402)}>x402 payments</FilterChip>
      <FilterChip active={reviews} onClick={() => toggle("reviews", reviews)}>Has reviews</FilterChip>

      <label className="ml-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-muted">
        <ArrowDownWideNarrow size={14} className="text-violet" />
        <span className="hidden sm:inline">Sort</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="cursor-pointer bg-transparent text-fg outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key} className="bg-[#14110b]">{s.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${
        active ? "border-violet/50 bg-violet/12 text-violet" : "border-white/10 bg-white/[0.03] text-muted hover:text-fg"
      }`}
    >
      {active && <Check size={13} />}
      {children}
    </button>
  );
}
