"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X, Loader2 } from "lucide-react";

// Searches the whole BSC registry, not just the loaded page.
export function SearchBox({ initial }: { initial?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  const submit = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    setBusy(true);
    router.push(`/?${next.toString()}`);
    // The route change resolves on the server; clear once React commits it.
    setTimeout(() => setBusy(false), 600);
  };

  return (
    <div className="flex w-full items-center gap-2 rounded-xl glass px-3 py-2 transition focus-within:border-violet/40 sm:w-96">
      {busy ? (
        <Loader2 size={15} className="shrink-0 animate-spin text-violet" />
      ) : (
        <Search size={15} className="shrink-0 text-muted" />
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit(q)}
        placeholder="Search 289,000+ agents — try “venus”, “grid”, “staking”"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {q && (
        <button
          onClick={() => { setQ(""); submit(""); }}
          className="shrink-0 text-muted transition hover:text-fg"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
