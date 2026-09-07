"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, Check, KeyRound, AlertTriangle, ShieldCheck, ChevronDown, Loader2, XCircle } from "lucide-react";
import { describeTool } from "@/lib/mcp/describe";
import { sessionStore, isActive, CHANGED, type HiredSession } from "@/lib/session/store";

// Hiring, the way Altana works: the user's own wallet grants the agent a SCOPED
// SESSION — a call allowlist, a spend cap, an expiry — and can revoke it. We
// complete that for real: the grant is a genuine EIP-712 signature from the
// user's wallet over the exact scoped permission, stored so the agent shows as
// hired and can be revoked. Submitting the same signed grant to the Altana
// Keystore for fully on-chain enforcement is the documented next step.

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window { ethereum?: Eth }
}

const nowMs = () => Date.now(); // module scope: keeps the clock read out of render
const BSC_MAINNET = "0x38"; // 56
const EXPIRIES = [
  { label: "24 hours", ms: 24 * 3600_000 },
  { label: "7 days", ms: 7 * 24 * 3600_000 },
  { label: "30 days", ms: 30 * 24 * 3600_000 },
] as const;

export function HireButton({
  agentId,
  agentName,
  category,
  writeTools,
}: {
  agentId: string;
  agentName: string;
  category: string;
  writeTools: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cap, setCap] = useState(100);
  const [expiryIdx, setExpiryIdx] = useState(1);
  const [allowed, setAllowed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(writeTools.map((t) => [t, true])),
  );
  const [showJson, setShowJson] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [hired, setHired] = useState<HiredSession | null>(null);

  useEffect(() => {
    const sync = () => {
      const s = sessionStore.for(agentId);
      setHired(s && isActive(s) ? s : null);
    };
    // setTimeout (not rAF) so this still runs when the tab is backgrounded —
    // rAF is paused while hidden, which would leave a hired session unshown.
    const t = setTimeout(() => {
      setHasWallet(Boolean(window.ethereum));
      setNow(nowMs());
      sync();
    }, 0);
    window.addEventListener(CHANGED, sync);
    return () => { clearTimeout(t); window.removeEventListener(CHANGED, sync); };
  }, [agentId]);

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
    agent: agentName, agentId, owner: account ?? "0x…(connect wallet)",
    chainId: 56, allow: chosen, spendCapUSDT: cap,
    expiresAt: expiresMs == null ? null : new Date(expiresMs).toISOString(), revocable: true,
  };

  const grant = async () => {
    if (!window.ethereum || !account || expiresMs == null) return;
    setSigning(true); setError(null);
    try {
      const domainChainId = chainId ? Number.parseInt(chainId, 16) : 56;
      const expiresSec = Math.floor(expiresMs / 1000);
      const typedData = {
        domain: { name: "Proven", version: "1", chainId: domainChainId },
        primaryType: "SessionGrant",
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
          ],
          SessionGrant: [
            { name: "agent", type: "string" },
            { name: "agentId", type: "string" },
            { name: "owner", type: "address" },
            { name: "allow", type: "string" },
            { name: "spendCapUSDT", type: "uint256" },
            { name: "expiresAt", type: "uint256" },
          ],
        },
        message: {
          agent: agentName, agentId, owner: account,
          allow: chosen.join(", ") || "(read-only)",
          spendCapUSDT: cap, expiresAt: expiresSec,
        },
      };
      const signature = (await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(typedData)],
      })) as string;

      sessionStore.add({
        id: agentId, agentId, agentName, category, owner: account,
        allow: chosen, capUsdt: cap, createdAt: nowMs(), expiresAt: expiresMs, signature,
      });
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Signature was rejected.";
      setError(/user rejected|denied/i.test(msg) ? "You declined the signature." : msg);
    } finally {
      setSigning(false);
    }
  };

  const revoke = () => sessionStore.remove(agentId);

  // ── Already hired: show the active session + revoke. ──
  if (hired) {
    const left = hired.expiresAt - (now ?? hired.createdAt);
    const hrs = Math.max(0, Math.round(left / 3600_000));
    return (
      <div className="flex w-full flex-col items-stretch gap-2 sm:w-80">
        <div className="rounded-xl border border-pos/30 bg-pos/[0.06] p-4">
          <div className="flex items-center gap-2 text-pos">
            <ShieldCheck size={16} /> <span className="font-semibold">Hired · active</span>
          </div>
          <div className="mt-2 space-y-1 text-[12px] text-muted">
            <div className="flex justify-between"><span>Spend cap</span><span className="font-mono text-fg">{hired.capUsdt} USDT</span></div>
            <div className="flex justify-between"><span>Allowed calls</span><span className="text-fg">{hired.allow.length || "read-only"}</span></div>
            <div className="flex justify-between"><span>Expires in</span><span className="text-fg">{hrs > 48 ? `${Math.round(hrs / 24)}d` : `${hrs}h`}</span></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/hired" className="flex-1 rounded-lg border border-white/12 py-1.5 text-center text-[13px] text-fg transition hover:bg-white/5">My agents</Link>
            <button onClick={revoke} className="flex items-center justify-center gap-1 rounded-lg border border-neg/30 bg-neg/10 px-3 py-1.5 text-[13px] text-neg transition hover:bg-neg/20">
              <XCircle size={13} /> Revoke
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:w-80">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl bg-linear-to-r from-violet to-magenta px-5 py-2.5 font-medium text-white glow-violet transition hover:brightness-110"
      >
        {open ? "Close" : "Hire this agent"}
      </button>

      {open && (
        <div className="card p-4 text-sm">
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
                <p className="text-[12px] text-muted">This agent exposes no fund-moving calls — it will be hired read-only.</p>
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
            {chosen.length > 0 ? <> on {chosen.length} allowed action{chosen.length > 1 ? "s" : ""}</> : <> (read-only)</>}
            , expiring <span className="text-violet">{expiryDate}</span>. It can&apos;t touch anything else, and
            you can revoke it anytime.
          </div>

          <button onClick={() => setShowJson((v) => !v)} className="mt-2 flex items-center gap-1 text-[11px] text-muted hover:text-fg">
            <ChevronDown size={11} className={showJson ? "rotate-180 transition-transform" : "transition-transform"} />
            Preview the permission you&apos;ll sign
          </button>
          {showJson && (
            <pre className="mt-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-muted">
              {JSON.stringify(permission, null, 2)}
            </pre>
          )}

          <button
            onClick={grant}
            disabled={!account || signing || (writeTools.length > 0 && chosen.length === 0)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-violet to-magenta py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signing ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {signing ? "Confirm in your wallet…" : account ? "Sign & grant session" : "Connect wallet first"}
          </button>
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            You sign this scoped grant with your own wallet — real, and revocable anytime. Submitting
            it to the Altana Keystore for fully on-chain enforcement is the next step.
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
