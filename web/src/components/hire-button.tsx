"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, Check, KeyRound, AlertTriangle, ShieldCheck, ChevronDown } from "lucide-react";
import { describeTool } from "@/lib/mcp/describe";

// Hiring, done the way Altana actually works: the user's own wallet grants the
// agent a SCOPED SESSION KEY — a call allowlist, a spend cap, and an expiry —
// registered on-chain so anyone can see what the agent may do, revocable in one
// tx. We build that whole configuration for real (connect, switch chain, pick
// the exact calls, cap the spend, set expiry, preview the on-chain permission),
// and gate only the final Keystore signature, which needs the Altana contracts
// wired in. Everything the user decides here is real and honest.

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window { ethereum?: Eth }
}

const BSC_MAINNET = "0x38"; // 56
const EXPIRIES = [
  { label: "24 hours", ms: 24 * 3600_000 },
  { label: "7 days", ms: 7 * 24 * 3600_000 },
  { label: "30 days", ms: 30 * 24 * 3600_000 },
] as const;

export function HireButton({
  agentName,
  writeTools,
}: {
  agentName: string;
  writeTools: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cap, setCap] = useState(100);
  const [expiryIdx, setExpiryIdx] = useState(1);
  const [allowed, setAllowed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(writeTools.map((t) => [t, true])),
  );
  const [showJson, setShowJson] = useState(false);
  // "now" is captured on mount, not read during render — the strict Next.js
  // react-hooks/purity rule forbids Date.now() while rendering.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setHasWallet(Boolean(window.ethereum));
      setNow(Date.now());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const connect = async () => {
    if (!window.ethereum) return;
    setBusy(true); setError(null);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts?.[0] ?? null);
      setChainId((await window.ethereum.request({ method: "eth_chainId" })) as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection was rejected.");
    } finally {
      setBusy(false);
    }
  };

  const switchChain = async () => {
    if (!window.ethereum) return;
    setError(null);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_MAINNET }] });
      setChainId((await window.ethereum.request({ method: "eth_chainId" })) as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch network.");
    }
  };

  const wrongChain = account != null && chainId !== BSC_MAINNET;
  const chosen = writeTools.filter((t) => allowed[t]);
  const expiry = EXPIRIES[expiryIdx];
  const expiresMs = now == null ? null : now + expiry.ms;
  const expiryDate = useMemo(
    () => (expiresMs == null ? "…" : new Date(expiresMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
    [expiresMs],
  );

  const permission = {
    agent: agentName,
    owner: account ?? "0x…(connect wallet)",
    chainId: 56,
    allow: chosen,
    spendCapUSDT: cap,
    expiresAt: expiresMs == null ? null : new Date(expiresMs).toISOString(),
    revocable: true,
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:w-80">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl bg-linear-to-r from-violet to-magenta px-5 py-2.5 font-medium text-white glow-violet transition hover:brightness-110"
      >
        {open ? "Close" : "Hire this agent"}
      </button>

      {open && (
        <div className="rounded-xl glass p-4 text-sm">
          {/* Step 1 — connect */}
          <div className="flex gap-3 pb-3">
            <Step n={1} done={Boolean(account)} />
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 font-medium text-fg">Connect your wallet</p>
              {account ? (
                <p className="font-mono text-[12px] text-pos">{account.slice(0, 6)}…{account.slice(-4)}</p>
              ) : hasWallet ? (
                <button
                  onClick={connect} disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/10 px-3 py-1.5 text-[13px] text-violet transition hover:bg-violet/20 disabled:opacity-60"
                >
                  <Wallet size={14} /> {busy ? "Waiting…" : "Connect"}
                </button>
              ) : (
                <p className="text-[12px] text-muted">No browser wallet detected.</p>
              )}
              {wrongChain && (
                <button onClick={switchChain} className="mt-1.5 rounded-lg border border-amber/40 bg-amber/10 px-2.5 py-1 text-[12px] text-amber transition hover:bg-amber/20">
                  Switch to BNB Smart Chain
                </button>
              )}
            </div>
          </div>

          {/* Step 2 — allowlist */}
          <div className="flex gap-3 border-t border-white/8 pt-3">
            <Step n={2} done={chosen.length > 0} />
            <div className="min-w-0 flex-1">
              <p className="mb-1 font-medium text-fg">Choose what it may do</p>
              {writeTools.length > 0 ? (
                <div className="space-y-1">
                  {writeTools.map((t) => {
                    const d = describeTool(t);
                    return (
                      <label key={t} className="flex items-center gap-2 text-[12px]">
                        <input
                          type="checkbox" checked={allowed[t] ?? false}
                          onChange={(e) => setAllowed((a) => ({ ...a, [t]: e.target.checked }))}
                          className="accent-violet"
                        />
                        <span className="text-fg">{d.plain}</span>
                        <span className="font-mono text-[10px] text-muted">{t}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-muted">This agent exposes no fund-moving calls to allowlist.</p>
              )}
            </div>
          </div>

          {/* Step 3 — cap + expiry */}
          <div className="flex gap-3 border-t border-white/8 pt-3">
            <Step n={3} done last />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium text-fg">Set the limits</p>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-muted">Max it may ever spend</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number" min={1} value={cap}
                    onChange={(e) => setCap(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-md bg-white/5 px-2 py-1 text-right font-mono text-[13px] outline-none focus:ring-1 focus:ring-violet/50"
                  />
                  <span className="text-[12px] text-muted">USDT</span>
                </span>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-muted">Permission expires in</span>
                <select
                  value={expiryIdx}
                  onChange={(e) => setExpiryIdx(Number(e.target.value))}
                  className="rounded-md bg-white/5 px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-violet/50"
                >
                  {EXPIRIES.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Plain-English grant summary */}
          <div className="mt-3 rounded-lg border border-violet/25 bg-violet/[0.06] px-3 py-2.5 text-[12px] text-fg/90">
            <ShieldCheck size={13} className="mr-1 inline text-violet" />
            You&apos;re letting <span className="font-medium">{agentName}</span> spend up to{" "}
            <span className="font-mono text-violet">{cap} USDT</span>
            {chosen.length > 0 ? <> on {chosen.length} allowed action{chosen.length > 1 ? "s" : ""}</> : <> (no actions selected)</>}
            , expiring <span className="text-violet">{expiryDate}</span>. It can&apos;t touch anything else, and
            you can revoke it anytime.
          </div>

          <button onClick={() => setShowJson((v) => !v)} className="mt-2 flex items-center gap-1 text-[11px] text-muted hover:text-fg">
            <ChevronDown size={11} className={showJson ? "rotate-180 transition-transform" : "transition-transform"} />
            Preview the on-chain permission
          </button>
          {showJson && (
            <pre className="mt-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-muted">
              {JSON.stringify(permission, null, 2)}
            </pre>
          )}

          <button
            disabled
            className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-[13px] text-muted"
          >
            <KeyRound size={14} /> Grant session key — needs Altana Keystore
          </button>
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            Everything above is real — your wallet, the allowlist, the cap and expiry. The final
            on-chain grant registers this permission in the Altana Keystore, which isn&apos;t wired into
            this build yet.
          </p>

          {error && <p className="mt-2 text-[12px] text-neg">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Step({ n, done, last }: { n: number; done: boolean; last?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono ${done ? "border-pos/50 bg-pos/15 text-pos" : "border-white/15 text-muted"}`}>
        {done ? <Check size={12} /> : n}
      </span>
      {!last && <span className="mt-1 w-px flex-1 bg-white/10" />}
    </div>
  );
}
