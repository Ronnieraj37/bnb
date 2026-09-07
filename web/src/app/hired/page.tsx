"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, XCircle, Clock, Coins, ListChecks, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { sessionStore, isActive, CHANGED, type HiredSession } from "@/lib/session/store";
import { CATEGORIES } from "@/lib/agents/types";
import type { Category } from "@/lib/agents/types";

// The user's control panel: every agent they've hired, what it may spend, when
// the permission expires, and one-click revoke. This is the "user-facing
// control" the whole scoped-session model exists to give.
export default function HiredPage() {
  const [sessions, setSessions] = useState<HiredSession[] | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const sync = () => setSessions(sessionStore.get());
    // setTimeout (not rAF) so it runs even when the tab is backgrounded.
    const t0 = setTimeout(() => { sync(); setNow(Date.now()); }, 0);
    window.addEventListener(CHANGED, sync);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(t0); window.removeEventListener(CHANGED, sync); clearInterval(t); };
  }, []);

  const active = (sessions ?? []).filter(isActive);
  const expired = (sessions ?? []).filter((s) => !isActive(s));

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24">
      <SiteHeader variant="back" />

      <div className="reveal mt-8">
        <h1 className="text-3xl font-semibold tracking-tight">My agents</h1>
        <p className="mt-1.5 text-muted">
          Agents you&apos;ve hired, and exactly what each one may do with your money. Revoke any of them instantly.
        </p>
      </div>

      {sessions === null ? (
        <div className="mt-8 space-y-3">
          {[0, 1].map((i) => <div key={i} className="card h-28 shimmer" />)}
        </div>
      ) : active.length === 0 && expired.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-3 p-10 text-center">
          <ShieldCheck size={28} className="text-muted" />
          <p className="text-fg">You haven&apos;t hired any agents yet.</p>
          <p className="max-w-sm text-[13px] text-muted">
            Find one in the marketplace, see how it works and its on-chain track record, then hire it
            with a scoped, revocable session.
          </p>
          <Link href="/" className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-violet to-magenta px-4 py-2 text-sm font-medium text-white glow-violet transition hover:brightness-110">
            Browse the marketplace <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {active.length > 0 && (
            <section>
              <div className="eyebrow mb-2">Active — {active.length}</div>
              <div className="space-y-3">
                {active.map((s) => <SessionCard key={s.id} s={s} now={now} onRevoke={() => sessionStore.remove(s.agentId)} />)}
              </div>
            </section>
          )}
          {expired.length > 0 && (
            <section>
              <div className="eyebrow mb-2">Expired — {expired.length}</div>
              <div className="space-y-3 opacity-60">
                {expired.map((s) => <SessionCard key={s.id} s={s} now={now} expired onRevoke={() => sessionStore.remove(s.agentId)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({ s, now, expired, onRevoke }: { s: HiredSession; now: number; expired?: boolean; onRevoke: () => void }) {
  const cat = CATEGORIES[s.category as Category];
  const left = s.expiresAt - now;
  const hrs = Math.max(0, Math.round(left / 3600_000));
  const timeLeft = expired ? "expired" : hrs > 48 ? `${Math.round(hrs / 24)}d left` : `${hrs}h left`;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {cat && <span className="pill" style={{ background: `${cat.accent}1f`, color: cat.accent }}>{cat.emoji} {cat.label}</span>}
            {!expired && <span className="inline-flex items-center gap-1 text-[11px] text-pos"><ShieldCheck size={12} /> active</span>}
          </div>
          <Link href={`/agents/${encodeURIComponent(s.agentId)}`} className="mt-1.5 block text-lg font-semibold text-fg transition hover:text-violet">
            {s.agentName}
          </Link>
        </div>
        <button onClick={onRevoke} className="flex items-center gap-1.5 rounded-lg border border-neg/30 bg-neg/10 px-3 py-1.5 text-[13px] text-neg transition hover:bg-neg/20">
          <XCircle size={14} /> {expired ? "Remove" : "Revoke"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Field icon={<Coins size={13} />} label="Spend cap" value={`${s.capUsdt} USDT`} />
        <Field icon={<ListChecks size={13} />} label="Allowed calls" value={s.allow.length ? String(s.allow.length) : "read-only"} />
        <Field icon={<Clock size={13} />} label="Session" value={timeLeft} tone={expired ? "muted" : "fg"} />
      </div>

      {s.allow.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.allow.map((t) => (
            <span key={t} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-muted">{t}</span>
          ))}
        </div>
      )}

      <p className="mt-3 break-all border-t border-white/[0.06] pt-2 font-mono text-[10px] text-muted/70">
        signed {new Date(s.createdAt).toLocaleString()} · {s.signature.slice(0, 18)}…
      </p>
    </div>
  );
}

function Field({ icon, label, value, tone = "fg" }: { icon: React.ReactNode; label: string; value: string; tone?: "fg" | "muted" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="eyebrow flex items-center gap-1">{icon}{label}</div>
      <div className={`stat-value mt-1.5 text-base font-semibold ${tone === "muted" ? "text-muted" : "text-fg"}`}>{value}</div>
    </div>
  );
}
