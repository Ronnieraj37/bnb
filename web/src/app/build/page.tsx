"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ReactFlow, Background, Controls, Handle, Position, addEdge,
  useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft, Play, Zap, GitBranch, Bell, Plus, Sparkles, Trash2,
  Loader2, AlertTriangle, Check, X, Radio, Wallet,
} from "lucide-react";
import {
  BLOCKS, KIND_META, findBlock, defaultConfig, missingRequirements,
  type BlockDef, type BlockKind, type ConfigValue,
} from "@/lib/builder/blocks";
import type { StepResult } from "@/lib/builder/run";
import { buildSwapTxs } from "@/lib/chain/swap";
import type { TokenSymbol } from "@/lib/chain/testnet-tokens";

type BData = { type: string; label: string; config: Record<string, ConfigValue> };

const ICON: Record<BlockKind, typeof Play> = { trigger: Play, skill: Zap, logic: GitBranch, io: Bell };
const EDGE = { animated: true, style: { stroke: "#f0b90b", strokeWidth: 2 } };

// bsc-testnet — the swap block is a real, wallet-signed transaction, and it
// must land on the same network the curated tokens and pool actually live on.
const BSC_TESTNET_CHAIN_ID = "0x61";
const BSC_TESTNET_PARAMS = {
  chainId: BSC_TESTNET_CHAIN_ID,
  chainName: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
  blockExplorerUrls: ["https://testnet.bscscan.com"],
};

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window { ethereum?: Eth }
}

async function ensureTestnet() {
  const eth = window.ethereum!;
  const chainId = (await eth.request({ method: "eth_chainId" })) as string;
  if (chainId === BSC_TESTNET_CHAIN_ID) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_TESTNET_CHAIN_ID }] });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: number }).code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [BSC_TESTNET_PARAMS] });
    } else {
      throw e;
    }
  }
}

async function waitForReceipt(txHash: string, timeoutMs = 60_000): Promise<void> {
  const eth = window.ethereum!;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [txHash] });
    if (receipt) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("timed out waiting for the transaction to be mined");
}

let seq = 0;
const nextId = (type: string) => `${type}-${++seq}`;

function FlowNode({ data, selected }: NodeProps) {
  const d = data as unknown as BData;
  const def = findBlock(d.type);
  const meta = KIND_META[def?.kind ?? "skill"];
  const Icon = ICON[def?.kind ?? "skill"];
  const missing = def ? missingRequirements(def, d.config) : [];
  const status = (d as unknown as { _status?: "idle" | "ok" | "error" | "running" })._status;

  return (
    <div
      className="glass-strong min-w-[168px] rounded-xl px-3 py-2 transition-shadow"
      style={{
        borderColor:
          status === "ok" ? "#2ee6a699" : status === "error" ? "#ff5c7899" : missing.length ? "#ffb45499" : `${meta.color}66`,
        boxShadow: selected ? `0 0 0 2px ${meta.color}` : status === "running" ? `0 0 0 2px #f0b90b` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: meta.color, border: "none" }} />
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${meta.color}22`, color: meta.color }}>
          {status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{def?.kind}</div>
          <div className="truncate text-sm font-medium text-fg">{d.label}</div>
        </div>
        {status === "ok" && <Check size={13} className="ml-auto shrink-0 text-pos" />}
        {status === "error" && <X size={13} className="ml-auto shrink-0 text-neg" />}
      </div>
      {missing.length > 0 && !status && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber">
          <AlertTriangle size={10} /> needs setup
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: meta.color, border: "none" }} />
    </div>
  );
}
const nodeTypes = { flow: FlowNode };

export default function BuildPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [explain, setExplain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [geminiHistory, setGeminiHistory] = useState<unknown[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StepResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((a) => {
      const accounts = a as string[];
      if (accounts?.[0]) setWallet(accounts[0]);
    });
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setRunError("No browser wallet detected — install MetaMask or a similar extension.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      setWallet(accounts?.[0] ?? null);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  };

  const load = useCallback(
    (specNodes: { type: string; config: Record<string, ConfigValue> }[], name?: string) => {
      const built: Node[] = [];
      const es: Edge[] = [];
      specNodes.forEach((sn) => {
        const def = findBlock(sn.type);
        if (!def) return;
        const id = nextId(sn.type);
        built.push({
          id, type: "flow",
          position: { x: built.length * 220, y: (built.length % 2) * 46 },
          data: { type: sn.type, label: def.label, config: { ...defaultConfig(def), ...sn.config } },
        });
        if (built.length > 1) es.push({ id: `e${built.length}`, source: built[built.length - 2].id, target: id, ...EDGE });
      });
      setNodes(built);
      setEdges(es);
      setResults(null);
      setRunError(null);
      if (name) void name;
      setSelected(null);
    },
    [setNodes, setEdges],
  );

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, ...EDGE }, es)), [setEdges]);

  const addBlock = (def: BlockDef) => {
    const id = nextId(def.type);
    const i = nodes.length;
    const node: Node = {
      id, type: "flow",
      position: { x: i * 220, y: (i % 2) * 46 },
      data: { type: def.type, label: def.label, config: defaultConfig(def) },
    };
    const last = nodes[nodes.length - 1];
    setNodes((ns) => [...ns, node]);
    if (last) setEdges((es) => addEdge({ id: `e-${last.id}-${id}`, source: last.id, target: id, ...EDGE }, es));
    setSelected(id);
    setResults(null);
  };

  const updateConfig = (key: string, value: ConfigValue) => {
    setResults(null);
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selected
          ? { ...n, data: { ...(n.data as BData), config: { ...(n.data as BData).config, [key]: value } } }
          : n,
      ),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    setNodes((ns) => ns.filter((n) => n.id !== selected));
    setEdges((es) => es.filter((e) => e.source !== selected && e.target !== selected));
    setSelected(null);
  };

  const sendToAgent = async () => {
    const message = prompt.trim();
    if (!message || loading) return;
    setChat((c) => [...c, { role: "user", text: message }]);
    setPrompt("");
    setLoading(true);
    setAgentError(null);
    try {
      const res = await fetch("/api/builder/converse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: geminiHistory, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAgentError(data.error ?? "the agent failed to respond");
        return;
      }
      setGeminiHistory(data.contents ?? []);
      if (data.type === "question") {
        setChat((c) => [...c, { role: "assistant", text: data.question }]);
      } else {
        load(data.nodes ?? [], data.name);
        setExplain(data.explain ?? null);
        setChat([]);
        setGeminiHistory([]);
      }
    } catch {
      setAgentError("Could not reach the AI agent.");
    } finally {
      setLoading(false);
    }
  };

  const runServerBlocks = async (blocks: { type: string; config: Record<string, ConfigValue> }[]): Promise<StepResult[]> => {
    const res = await fetch("/api/builder/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "run failed");
    return (data.steps ?? []) as StepResult[];
  };

  const applyStatuses = (steps: (StepResult | undefined)[]) => {
    setNodes((ns) => ns.map((n, i) => ({ ...n, data: { ...n.data, _status: steps[i] ? (steps[i]!.ok ? "ok" : "error") : undefined } })));
  };

  const run = async () => {
    if (!nodes.length) return;
    setRunning(true);
    setRunError(null);
    setResults(null);
    // mark all running, in order, so the canvas animates step by step
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, _status: "running" } })));
    try {
      const blockList = nodes.map((n) => ({ type: (n.data as BData).type, config: (n.data as BData).config }));
      const swapIdx = blockList.findIndex((b) => findBlock(b.type)?.writes);

      // No write block — every step is a real read, all executed server-side.
      if (swapIdx === -1) {
        const steps = await runServerBlocks(blockList);
        setResults(steps);
        applyStatuses(steps);
        return;
      }

      // A write block sits partway through: run the real reads before it on
      // the server, then hand the swap itself to the user's own wallet —
      // the server is never allowed to move funds.
      const before = blockList.slice(0, swapIdx);
      const after = blockList.slice(swapIdx + 1);
      const beforeSteps = before.length ? await runServerBlocks(before) : [];
      if (beforeSteps.length < before.length || beforeSteps.some((s) => !s.ok)) {
        setResults(beforeSteps);
        applyStatuses(beforeSteps);
        setRunError("Stopped before the swap — an earlier block didn't succeed.");
        return;
      }

      const swapDef = findBlock(blockList[swapIdx].type)!;
      if (!wallet) {
        setResults(beforeSteps);
        applyStatuses(beforeSteps);
        setRunError(`Connect your wallet to run "${swapDef.label}".`);
        return;
      }

      const cfg = blockList[swapIdx].config;
      let swapStep: StepResult;
      try {
        if (!window.ethereum) throw new Error("No browser wallet available.");
        await ensureTestnet();
        const { approve, swap } = buildSwapTxs(
          String(cfg.tokenIn) as TokenSymbol, String(cfg.tokenOut) as TokenSymbol, String(cfg.amount ?? "0.01"),
          wallet as `0x${string}`, Number(cfg.feeTier ?? 2500),
        );
        const approveHash = (await window.ethereum.request({ method: "eth_sendTransaction", params: [{ ...approve, from: wallet }] })) as string;
        await waitForReceipt(approveHash);
        const swapHash = (await window.ethereum.request({ method: "eth_sendTransaction", params: [{ ...swap, from: wallet }] })) as string;
        await waitForReceipt(swapHash);
        swapStep = { type: swapDef.type, label: swapDef.label, ok: true, output: { approveTxHash: approveHash, swapTxHash: swapHash } };
      } catch (e) {
        swapStep = { type: swapDef.type, label: swapDef.label, ok: false, error: e instanceof Error ? e.message : "swap failed" };
      }

      const afterSteps = swapStep.ok && after.length ? await runServerBlocks(after) : [];
      const allSteps = [...beforeSteps, swapStep, ...afterSteps];
      setResults(allSteps);
      applyStatuses(allSteps);
      if (!swapStep.ok) setRunError("The swap did not complete.");
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Could not reach the run API.");
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, _status: undefined } })));
    } finally {
      setRunning(false);
    }
  };

  const selNode = nodes.find((n) => n.id === selected);
  const selDef = selNode ? findBlock((selNode.data as BData).type) : undefined;
  const selConfig = (selNode?.data as BData)?.config ?? {};
  const selMissing = selDef
    ? [...missingRequirements(selDef, selConfig), ...(selDef.requires?.includes("a connected wallet") && !wallet ? (["a connected wallet"] as const) : [])]
    : [];

  const grouped = (Object.keys(KIND_META) as BlockKind[]).map((k) => ({
    kind: k, meta: KIND_META[k], defs: BLOCKS.filter((b) => b.kind === k),
  }));

  return (
    <>
      {/* Mobile gate — the drag-drop flow canvas needs a pointer and width, so on
          small screens we send people to the (fully mobile) marketplace instead
          of showing a broken editor. */}
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center md:hidden">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-cosmic">
          <span className="text-violet">◆</span> Proven
        </Link>
        <Sparkles size={26} className="text-violet" />
        <h1 className="text-xl font-semibold">The flow builder is a desktop experience</h1>
        <p className="max-w-xs text-sm text-muted">
          Building an agent flow needs a wide canvas and a mouse. Open Proven on a desktop browser to
          use it — meanwhile the marketplace works great here on mobile.
        </p>
        <Link href="/" className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-violet to-magenta px-4 py-2 text-sm font-medium text-white glow-violet transition hover:brightness-110">
          <ArrowLeft size={14} /> Back to marketplace
        </Link>
      </div>

    <div className="mx-auto hidden h-screen max-w-[1600px] flex-col px-4 py-3 md:flex">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl glass-strong px-4 py-2.5">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
          <ArrowLeft size={16} /> Marketplace
        </Link>
        <div className="flex min-w-[18rem] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 transition focus-within:ring-1 focus-within:ring-violet/40">
          <Sparkles size={15} className="shrink-0 text-violet" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendToAgent()}
            placeholder={
              chat.length > 0
                ? "Reply to the agent's question…"
                : "Describe it — e.g. 'find the best yield on BSC' or 'check my wallet's Venus health factor'"
            }
            className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted"
          />
          <button
            onClick={sendToAgent}
            disabled={loading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-linear-to-r from-violet to-magenta px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {chat.length > 0 ? "Reply" : "Describe it"}
          </button>
        </div>
        <button
          onClick={connectWallet}
          disabled={connecting}
          className="flex shrink-0 items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-sm transition hover:border-violet/40 disabled:opacity-60"
          title="Needed only for blocks that move funds (e.g. Swap), signed by your own wallet"
        >
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} className={wallet ? "text-pos" : "text-muted"} />}
          {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect wallet"}
        </button>
        <button
          onClick={run}
          disabled={running || !nodes.length}
          className="flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-sm transition hover:border-pos/40 disabled:opacity-50"
          title="Actually execute this flow's real reads, right now"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} className="text-pos" />} Run for real
        </button>
      </header>

      {chat.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5 rounded-xl glass px-4 py-2.5 text-[13px]">
          {chat.map((m, i) => (
            <p key={i} className={m.role === "assistant" ? "text-violet" : "text-muted"}>
              <span className="font-medium">{m.role === "assistant" ? "Agent: " : "You: "}</span>
              {m.text}
            </p>
          ))}
          {loading && <p className="flex items-center gap-1.5 text-muted"><Loader2 size={12} className="animate-spin" /> thinking…</p>}
        </div>
      ) : (
        explain && (
          <div className="mt-2 flex items-center gap-2 rounded-xl glass px-4 py-2 text-[13px] text-muted">
            <Sparkles size={14} className="shrink-0 text-violet" />
            {explain}
          </div>
        )
      )}
      {agentError && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-neg/30 bg-neg/5 px-4 py-2 text-[13px] text-neg">
          <AlertTriangle size={14} className="shrink-0" /> {agentError}
        </div>
      )}
      {runError && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-neg/30 bg-neg/5 px-4 py-2 text-[13px] text-neg">
          <AlertTriangle size={14} className="shrink-0" /> {runError}
        </div>
      )}

      <div className="mt-3 flex flex-1 gap-3 overflow-hidden">
        <aside className="w-56 shrink-0 overflow-y-auto rounded-2xl glass p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">Add a block</p>
          <div className="flex flex-col gap-3">
            {grouped.map((g) => (
              <div key={g.kind}>
                <div className="mb-1 text-[11px] font-medium" style={{ color: g.meta.color }}>{g.meta.label}</div>
                <div className="flex flex-col gap-1">
                  {g.defs.map((d) => (
                    <button
                      key={d.type}
                      onClick={() => addBlock(d)}
                      title={d.desc}
                      className="group flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-left text-[13px] transition hover:border-violet/40 hover:bg-white/5"
                    >
                      <span className="truncate">{d.label}</span>
                      <Plus size={13} className="shrink-0 text-muted transition group-hover:text-violet" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="relative flex-1 overflow-hidden rounded-2xl glass">
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center text-muted">
              <Sparkles size={26} className="mb-2 text-violet" />
              <p className="text-sm">Describe a flow above, or add a block from the left.</p>
              <p className="mt-1 text-[12px]">Every block runs a real check — Venus, PancakeSwap, DeFiLlama, Binance.</p>
            </div>
          )}
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)}
            nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
          >
            <Background color="#2a2013" gap={22} size={1} />
            <Controls className="!bottom-3 !left-3" showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto rounded-2xl glass p-4">
          {results ? (
            <ResultsPanel steps={results} onClose={() => setResults(null)} />
          ) : selDef ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{selDef.label}</h3>
                <button onClick={removeSelected} className="text-muted transition hover:text-neg" title="Delete block">
                  <Trash2 size={15} />
                </button>
              </div>
              <p className="mt-1 text-[12px] text-muted">{selDef.desc}</p>

              {selMissing.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-[12px] text-amber">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle size={12} /> Not runnable yet
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {selMissing.map((r) => <li key={r}>Needs {r}.</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                {selDef.fields.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1">
                    <span className="text-[12px] text-muted">{f.label}</span>
                    {f.type === "select" ? (
                      <select
                        value={String(selConfig[f.key] ?? f.def ?? "")}
                        onChange={(e) => updateConfig(f.key, e.target.value)}
                        className="rounded-lg bg-white/5 px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-violet/50"
                      >
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        value={String(selConfig[f.key] ?? "")}
                        onChange={(e) => updateConfig(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                        placeholder={f.placeholder}
                        className="rounded-lg bg-white/5 px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-violet/50"
                      />
                    )}
                    {f.help && <span className="text-[11px] text-muted">{f.help}</span>}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-muted">
              <p className="font-medium text-fg">Flow builder</p>
              <p className="mt-1">
                Select a block to configure it, or drag between the dots to rewire.
              </p>
              <p className="mt-3">
                <span className="text-pos">Run for real</span> executes every block server-side —
                real contract reads, real market data — right now, no wallet, no install. Nothing
                is simulated.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
    </>
  );
}

function ResultsPanel({ steps, onClose }: { steps: StepResult[]; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-semibold">
          <Radio size={15} className="text-pos" /> Real results
        </h3>
        <button onClick={onClose} className="text-muted transition hover:text-fg"><X size={16} /></button>
      </div>
      <div className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <div key={i} className={`rounded-xl border px-3 py-2.5 text-[12px] ${s.ok ? "border-pos/25 bg-pos/5" : "border-neg/25 bg-neg/5"}`}>
            <div className={`flex items-center gap-1.5 font-medium ${s.ok ? "text-pos" : "text-neg"}`}>
              {s.ok ? <Check size={12} /> : <X size={12} />} {s.label}
            </div>
            {s.error && <p className="mt-1 text-neg">{s.error}</p>}
            {s.output !== undefined && (
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-fg">
                {JSON.stringify(s.output, null, 1)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
