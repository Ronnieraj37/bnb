import { unstable_cache } from "next/cache";
import snapshotData from "./snapshot.json";
import type {
  Agent, AgentPage, Capability, Category, Health, ScoreBreakdown,
} from "./types";

// 8004scan client — BNB Smart Chain mainnet (chain 56).
//
// Endpoints verified against the live API:
//   GET /api/v1/agents?chain_id=56&limit=<=100&offset=N&sort_by=..&order=..&search=..
//       -> { items, total, limit, offset }
//   GET /api/v1/agents/56/{contract}/{tokenId}
//       -> full record incl. services (MCP tools), scores breakdown, health,
//          agent_wallet, created_tx_hash
//
// The list endpoint is shallow; the detail endpoint is where the genuinely
// useful data lives, so agent pages always fetch detail.

const BASE = process.env.SCAN_API_BASE ?? "https://api.8004scan.io/api/v1";
const KEY = process.env.SCAN_API_KEY;
export const CHAIN_ID = 56;
export const MAX_LIMIT = 100; // API rejects limit > 100

export const scanEnabled = () => Boolean(KEY);

export class ScanError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ScanError";
  }
}

// Kept short deliberately: this bounds how long a page render can wait on the
// registry. 9s was long enough for a handful of slow calls to stack into a
// multi-minute production load.
const TIMEOUT_MS = 6000;

/**
 * Upstream is not always healthy — some queries (search=swap, for one) never
 * return at all. Every request is raced against a wall clock rather than
 * relying on AbortSignal alone, because Next's cached fetch does not forward
 * the signal, and a hung upstream would otherwise hang the entire page render.
 */
async function get<T>(path: string, revalidate: number | "no-store" = 300): Promise<T> {
  if (!KEY) throw new ScanError(401, "SCAN_API_KEY is not set");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ScanError(504, `8004scan timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([
      fetch(`${BASE}${path}`, {
        headers: { "x-api-key": KEY },
        // Next's data cache dedupes in-flight requests, so one hung upstream
        // call poisons every later request for the same URL — no timeout of
        // ours can release it. Uncacheable paths (user searches) therefore opt
        // out entirely and rely on our own memo instead.
        ...(revalidate === "no-store"
          ? { cache: "no-store" as const }
          : { next: { revalidate } }),
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (!res.ok) throw new ScanError(res.status, `8004scan ${res.status} on ${path}`);
    return (await Promise.race([res.json() as Promise<T>, timeout])) as T;
  } catch (e) {
    if (e instanceof ScanError) throw e;
    throw new ScanError(502, `8004scan unreachable: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ── raw API shapes ────────────────────────────────────────────────────────
type RawList = { items?: RawAgent[]; total?: number; limit?: number; offset?: number };

type RawAgent = {
  agent_id: string;
  token_id: string;
  contract_address: string;
  owner_address: string;
  agent_wallet?: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  is_verified: boolean;
  is_active?: boolean;
  star_count: number;
  supported_protocols: string[] | null;
  x402_supported: boolean;
  total_score: number;
  rank: number | null;
  network_rank?: number | null;
  total_feedbacks: number;
  total_validations?: number;
  successful_validations?: number;
  average_score: number;
  created_at: string;
  updated_at: string;
  // detail-only
  services?: Record<string, { endpoint?: string; version?: string; tools?: string[] }>;
  scores?: Partial<Record<string, number>>;
  health_score?: number | null;
  health_checked_at?: string | null;
  is_endpoint_verified?: boolean;
  endpoint_verified_domain?: string | null;
  endpoint_verification_error?: string | null;
  created_tx_hash?: string | null;
  created_block_number?: number | null;
  supported_trust_models?: string[] | null;
  cross_chain_links?: unknown[] | null;
  mcp_server?: string | null;
  mcp_version?: string | null;
  a2a_endpoint?: string | null;
};

// ── categorisation ────────────────────────────────────────────────────────
// Ordered most-specific first: an agent that mentions liquidation AND lending
// is a health-factor agent, not a generic yield one. We keep the matched term
// so the UI can show WHY an agent is in a category.
const RULES: { category: Category; re: RegExp }[] = [
  // Plurals matter here: real descriptions say "collateral ratios" and
  // "borrow limits", which a \b-anchored singular silently misses.
  { category: "health-factor", re: /\b(health\s*factors?|liquidat\w*|collateral\s*ratios?|borrow\s*limits?|undercollateral\w*|repay\w*)\b/i },
  { category: "rebalancing", re: /\b(rebalanc\w*|concentrated\s*liquidity|out\s*of\s*range|reset\s*ranges?|v3\s*positions?|liquidity\s*positions?)\b/i },
  { category: "grid", re: /\b(grids?|limit\s*orders?|ladder\w*|dca|market\s*mak\w*|arbitrag\w*)\b/i },
  { category: "yield", re: /\b(yields?|apr|apy|farm\w*|stak\w*|vaults?|compound\w*|auto-?compound)\b/i },
  // Softer fallbacks — still evidence-based, just weaker signals.
  { category: "health-factor", re: /\b(lending|lend|borrow|repay|venus|aave|debt)\b/i },
  { category: "rebalancing", re: /\b(liquidity|pool|pancakeswap|uniswap)\b/i },
  { category: "grid", re: /\b(trade|trading|swap|order)\b/i },
  { category: "yield", re: /\b(earn|deposit|savings|interest)\b/i },
];

function classify(a: RawAgent): { category: Category; evidence: string } | null {
  const tools = Object.values(a.services ?? {}).flatMap((s) => s?.tools ?? []);
  const haystack = [
    a.name ?? "", a.description ?? "",
    ...(a.supported_protocols ?? []), ...tools,
  ].join(" ");

  for (const { category, re } of RULES) {
    const m = haystack.match(re);
    if (m) return { category, evidence: m[0] };
  }
  return null;
}

// ── mapping ───────────────────────────────────────────────────────────────
function toBreakdown(s: RawAgent["scores"]): ScoreBreakdown | undefined {
  if (!s) return undefined;
  const n = (k: string) => Math.round((s[k] ?? 0) as number);
  return {
    quality: n("quality"),
    popularity: n("popularity"),
    activity: n("activity"),
    wallet: n("wallet"),
    freshness: n("freshness"),
    metadataCompleteness: n("metadata_completeness"),
    health: n("health_score"),
  };
}

function toHealth(a: RawAgent): Health | undefined {
  if (a.health_score == null && a.is_endpoint_verified == null) return undefined;
  return {
    score: a.health_score ?? null,
    verified: Boolean(a.is_endpoint_verified),
    error: a.endpoint_verification_error ?? undefined,
    checkedAt: a.health_checked_at ?? undefined,
    domain: a.endpoint_verified_domain ?? undefined,
  };
}

function toCapabilities(a: RawAgent): Capability[] {
  const caps: Capability[] = [];
  const svc = a.services ?? {};

  const mcp = svc.mcp;
  if (mcp?.endpoint || a.mcp_server) {
    caps.push({
      kind: "mcp",
      endpoint: mcp?.endpoint ?? a.mcp_server ?? "",
      version: mcp?.version ?? a.mcp_version ?? undefined,
      tools: mcp?.tools ?? [],
    });
  }
  const a2a = svc.a2a;
  if (a2a?.endpoint || a.a2a_endpoint) {
    caps.push({
      kind: "a2a",
      endpoint: a2a?.endpoint ?? a.a2a_endpoint ?? "",
      version: a2a?.version ?? undefined,
      tools: a2a?.tools ?? [],
    });
  }
  return caps;
}

function mapAgent(
  a: RawAgent,
  cls: { category: Category; evidence: string },
  detailed: boolean,
): Agent {
  return {
    id: a.agent_id,
    tokenId: a.token_id,
    contract: a.contract_address,
    name: a.name?.trim() || `Agent #${a.token_id}`,
    description: a.description?.trim() || "",
    category: cls.category,
    categoryEvidence: cls.evidence,
    ownerAddress: a.owner_address,
    agentWallet: a.agent_wallet ?? undefined,
    imageUrl: a.image_url ?? undefined,
    protocols: a.supported_protocols ?? [],
    x402: Boolean(a.x402_supported),
    identityVerified: Boolean(a.is_verified),
    active: a.is_active !== false,
    score: Math.round((a.total_score ?? 0) * 10) / 10,
    rank: a.rank ?? a.network_rank ?? null,
    breakdown: toBreakdown(a.scores),
    feedbackCount: a.total_feedbacks ?? 0,
    averageScore: a.average_score ?? 0,
    validations: {
      total: a.total_validations ?? 0,
      successful: a.successful_validations ?? 0,
    },
    stars: a.star_count ?? 0,
    health: toHealth(a),
    capabilities: toCapabilities(a),
    provenance: {
      txHash: a.created_tx_hash ?? undefined,
      blockNumber: a.created_block_number ?? undefined,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    },
    trustModels: a.supported_trust_models ?? [],
    crossChainCount: (a.cross_chain_links ?? []).length,
    detailed,
  };
}

// ── queries ───────────────────────────────────────────────────────────────
export type ListOptions = {
  search?: string;
  limit?: number;
  offset?: number;
  sort?: "total_score" | "created_at" | "total_feedbacks";
  /**
   * Cache policy override. USER searches stay uncacheable (a hung upstream
   * would otherwise poison the shared entry), but OUR OWN catalogue queries are
   * a fixed, known set and must hit Next's persistent Data Cache — otherwise
   * every serverless cold start re-runs the whole fan-out against upstream,
   * which is what made production take minutes to load.
   */
  cache?: number | "no-store";
};

/** Raw page from the registry, classified. Unclassifiable agents are dropped. */
const searchMemo = new Map<string, { at: number; value: AgentPage }>();
const SEARCH_TTL = 2 * 60_000;

export async function listAgents(o: ListOptions = {}): Promise<AgentPage> {
  const limit = Math.min(o.limit ?? 60, MAX_LIMIT);
  const offset = o.offset ?? 0;
  const params = new URLSearchParams({
    chain_id: String(CHAIN_ID),
    limit: String(limit),
    offset: String(offset),
    sort_by: o.sort ?? "total_score",
    order: "desc",
  });
  if (o.search?.trim()) params.set("search", o.search.trim());

  const key = params.toString();
  const isSearch = Boolean(o.search?.trim());
  const policy = o.cache ?? (isSearch ? "no-store" : 300);

  if (isSearch && policy === "no-store") {
    const hit = searchMemo.get(key);
    if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.value;
  }

  const json = await get<RawList>(`/agents?${key}`, policy);
  const agents: Agent[] = [];
  for (const item of json.items ?? []) {
    const cls = classify(item);
    if (cls) agents.push(mapAgent(item, cls, false));
  }
  const page = { agents, total: json.total ?? agents.length, offset, limit };
  if (isSearch && policy === "no-store") searchMemo.set(key, { at: Date.now(), value: page });
  return page;
}

/**
 * Fill each category by asking the registry for that category's own terms.
 * Sorting the whole 291k by score buries everything under generic agents, so we
 * search instead. Every query runs in parallel — done sequentially this is tens
 * of seconds of latency, which is what made the page hang.
 */
// Two queries per category, not four. We only surface ~50 agents, so eight
// upstream calls is plenty — and halving the fan-out halves cold-start latency
// and the load we put on a registry that is frequently slow.
const CATEGORY_QUERIES: Record<Category, string[]> = {
  "health-factor": ["health factor", "liquidation"],
  rebalancing: ["liquidity", "rebalance"],
  grid: ["grid", "trading"],
  yield: ["yield", "staking"],
};

const CATS = Object.keys(CATEGORY_QUERIES) as Category[];

export type Catalogue = { byCategory: Record<Category, Agent[]>; indexed: number };

type CacheSlot = { at: number; value: Catalogue } | null;

/**
 * How long a built catalogue is served before we rebuild. This lives in Next's
 * Data Cache (persistent and shared across serverless invocations on Vercel),
 * which is the layer that actually matters in production — a `globalThis`
 * cache dies with every cold start, so without this every cold request re-ran
 * the whole upstream fan-out and the deployed site took minutes to load.
 */
const CATALOGUE_TTL_S = 600; // 10 minutes
/** Hard ceiling on a cold build. Partial results beat a hanging page. */
const BUILD_DEADLINE_MS = 7000;
/** After a total failure, wait this long before fanning out again. */
const NEGATIVE_TTL_MS = 30_000;

const store = globalThis as typeof globalThis & {
  __provenCatalogue?: CacheSlot;
  __provenFailedAt?: number;
};

const EMPTY = (): Catalogue => ({
  byCategory: { rebalancing: [], grid: [], yield: [], "health-factor": [] },
  indexed: 0,
});

/**
 * Last-resort seed: real agents baked into the build by `npm run snapshot`.
 * Covers the one gap our caches can't — a first-ever cold start while the
 * registry is unreachable, where we'd otherwise render an empty marketplace.
 *
 * Raw upstream items are stored, then classified here through the SAME
 * pipeline as live data, so the snapshot can never drift from our own
 * categorisation rules. Returns null when the snapshot hasn't been generated.
 */
let snapshotMemo: Catalogue | null | undefined;
function snapshotCatalogue(): Catalogue | null {
  if (snapshotMemo !== undefined) return snapshotMemo;
  const raw = snapshotData as { at: number; indexed: number; items: RawAgent[] };
  if (!raw.items?.length) return (snapshotMemo = null);

  const byCategory = { rebalancing: [], grid: [], yield: [], "health-factor": [] } as Record<Category, Agent[]>;
  for (const item of raw.items) {
    const cls = classify(item);
    if (cls) byCategory[cls.category].push(mapAgent(item, cls, false));
  }
  for (const c of CATS) byCategory[c].sort((x, y) => y.score - x.score);
  const any = CATS.some((c) => byCategory[c].length > 0);
  return (snapshotMemo = any ? { byCategory, indexed: raw.indexed } : null);
}

/** Resolve with `fallback` if `p` hasn't settled within `ms`. */
function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/**
 * The persistent layer. `unstable_cache` stores the *built result*, so the
 * expensive fan-out happens once per TTL for the whole deployment rather than
 * once per cold start. It only caches successful builds — a throw is never
 * cached, so an outage can't pin an empty marketplace for 10 minutes.
 */
const buildCached = unstable_cache(
  async () => build(),
  ["proven:catalogue:v2"],
  { revalidate: CATALOGUE_TTL_S, tags: ["catalogue"] },
);

/** The balanced, cached catalogue behind the marketplace. */
export async function catalogue(): Promise<Catalogue> {
  const cached = store.__provenCatalogue;

  // Upstream just failed: serve whatever we have and don't re-fan-out for a
  // while. Prevents every request paying the full timeout during an outage.
  if (store.__provenFailedAt && Date.now() - store.__provenFailedAt < NEGATIVE_TTL_MS) {
    return cached?.value ?? snapshotCatalogue() ?? EMPTY();
  }

  try {
    const value = await buildCached();
    if (CATS.some((c) => value.byCategory[c].length > 0)) {
      store.__provenCatalogue = { at: Date.now(), value };
      store.__provenFailedAt = undefined;
      return value;
    }
    // Empty but not thrown — treat as degraded.
    store.__provenFailedAt = Date.now();
    return cached?.value ?? snapshotCatalogue() ?? value;
  } catch {
    store.__provenFailedAt = Date.now();
    // Last known good, then the baked-in snapshot, then (only if we have
    // literally nothing) empty. An error screen is the worst option.
    return cached?.value ?? snapshotCatalogue() ?? EMPTY();
  }
}

async function build(): Promise<Catalogue> {
  const jobs = CATS.flatMap((category) =>
    CATEGORY_QUERIES[category].map((search) => ({ category, search })),
  );

  // Collect whatever arrives before the deadline instead of waiting on the
  // slowest query — a partial catalogue renders, a hung one does not.
  const collected: AgentPage[] = [];
  const inflight = jobs.map((j) =>
    listAgents({ search: j.search, limit: 50, cache: CATALOGUE_TTL_S })
      .then((page) => { collected.push(page); })
      .catch(() => {}),
  );

  const [, count] = await Promise.all([
    withDeadline(Promise.all(inflight), BUILD_DEADLINE_MS, undefined),
    withDeadline(countAll().catch(() => 0), BUILD_DEADLINE_MS, 0),
  ]);

  const byCategory = { rebalancing: [], grid: [], yield: [], "health-factor": [] } as Record<Category, Agent[]>;
  const seen = new Set<string>();

  for (const page of collected) {
    for (const a of page.agents) {
      if (seen.has(a.id)) continue;
      // Trust the agent's own classification, not the query that found it.
      seen.add(a.id);
      byCategory[a.category].push(a);
    }
  }

  if (collected.length === 0) {
    // Upstream search is down outright — degrade instead of failing: pull a
    // few unfiltered top-score pages and classify them ourselves. Not as
    // balanced as the targeted searches, but every agent shown is still
    // real, and going a few pages deep gives each category a real shot at
    // being represented rather than just whatever lands on page one.
    const fallback: AgentPage[] = [];
    const pages = [0, 1, 2].map((i) =>
      listAgents({ limit: MAX_LIMIT, offset: i * MAX_LIMIT, sort: "total_score", cache: CATALOGUE_TTL_S })
        .then((p) => { fallback.push(p); })
        .catch(() => {}),
    );
    await withDeadline(Promise.all(pages), BUILD_DEADLINE_MS, undefined);
    for (const p of fallback) {
      for (const a of p.agents) byCategory[a.category].push(a);
    }

    // Even the fallback found nothing real — 8004scan is genuinely
    // unreachable right now, not just its search parameter. Throw so this
    // never gets cached as a hollow "0 agents" success.
    if (CATS.every((c) => byCategory[c].length === 0)) {
      throw new ScanError(502, "8004scan unreachable");
    }
  }

  for (const c of CATS) byCategory[c].sort((x, y) => y.score - x.score);
  return { byCategory, indexed: count };
}

export async function getAgentDetail(
  contract: string,
  tokenId: string,
): Promise<Agent | null> {
  try {
    const raw = await get<RawAgent>(`/agents/${CHAIN_ID}/${contract}/${tokenId}`, 120);
    const cls = classify(raw) ?? { category: "yield" as Category, evidence: "unclassified" };
    return mapAgent(raw, cls, true);
  } catch (e) {
    if (e instanceof ScanError && e.status === 404) return null;
    throw e;
  }
}

/** Total agents indexed on BSC. Cached for an hour — it barely moves. */
async function countAll(): Promise<number> {
  const json = await get<RawList>(`/agents?chain_id=${CHAIN_ID}&limit=1`, 3600);
  return json.total ?? 0;
}
