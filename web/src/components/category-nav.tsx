import Link from "next/link";
import type { Category } from "@/lib/agents/types";
import { CATEGORIES } from "@/lib/agents/types";

export function CategoryNav({
  counts,
  active,
  total,
  query,
  preserve,
}: {
  counts: Record<Category, number>;
  active?: Category;
  total: number;
  query?: string;
  /** Extra URL params (sort, filters) to keep when switching category. */
  preserve?: Record<string, string | undefined>;
}) {
  const href = (key?: Category) => {
    const p = new URLSearchParams();
    if (key) p.set("category", key);
    if (query) p.set("q", query);
    for (const [k, v] of Object.entries(preserve ?? {})) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const items: { key?: Category; label: string; emoji: string; count: number }[] = [
    { label: "All", emoji: "◆", count: total },
    ...(Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][]).map(
      ([key, v]) => ({ key, label: v.label, emoji: v.emoji, count: counts[key] }),
    ),
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((it) => {
        const isActive = it.key === active || (!it.key && !active);
        return (
          <Link
            key={it.label}
            href={href(it.key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              isActive
                ? "border-violet/50 bg-violet/10 text-fg glow-violet"
                : "glass text-muted hover:border-violet/30 hover:text-fg"
            }`}
          >
            <span className="opacity-80">{it.emoji}</span>
            <span>{it.label}</span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {it.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
