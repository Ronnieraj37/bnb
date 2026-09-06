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

const TIMEOUT_MS = 9000;

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

  if (isSearch) {
    const hit = searchMemo.get(key);
    if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.value;
  }

  const json = await get<RawList>(`/agents?${key}`, isSearch ? "no-store" : 300);
  const agents: Agent[] = [];
  for (const item of json.items ?? []) {
    const cls = classify(item);
    if (cls) agents.push(mapAgent(item, cls, false));
  }
  const page = { agents, total: json.total ?? agents.length, offset, limit };
  if (isSearch) searchMemo.set(key, { at: Date.now(), value: page });
  return page;
}

/**
 * Fill each category by asking the registry for that category's own terms.
 * Sorting the whole 291k by score buries everything under generic agents, so we
 * search instead. Every query runs in parallel — done sequentially this is tens
 * of seconds of latency, which is what made the page hang.
 */
const CATEGORY_QUERIES: Record<Category, string[]> = {
  "health-factor": ["health factor", "lending", "liquidation", "collateral"],
  rebalancing: ["liquidity", "rebalance", "concentrated liquidity", "v3 position"],
  grid: ["trading", "grid", "dca", "market making"],
  yield: ["yield", "staking", "farming", "vault"],
};

const CATS = Object.keys(CATEGORY_QUERIES) as Category[];

export type Catalogue = { byCategory: Record<Category, Agent[]>; indexed: number };

type CacheSlot = { at: number; value: Catalogue } | null;
// 8004scan's search parameter is observed to fail outright for stretches at a
// time (verified directly: every `search=` query 500s for ~10s while the
// plain list endpoint stays healthy). SOFT_TTL is how fresh we'd like the
// catalogue; HARD_TTL is how long we'll keep serving it — genuinely real,
// just a few minutes old — rather than blanking the whole marketplace while
// upstream search recovers.
const SOFT_TTL_MS = 5 * 60_000;
const HARD_TTL_MS = 60 * 60_000;

// Held on globalThis: in dev, module scope is discarded between requests, so a
// plain module-level variable means rebuilding the catalogue on every render.
const store = globalThis as typeof globalThis & {
  __provenCatalogue?: CacheSlot;
  __provenInflight?: Promise<Catalogue> | null;
};

/** The balanced, cached catalogue behind the marketplace. */
export async function catalogue(): Promise<Catalogue> {
  const cached = store.__provenCatalogue;
  const age = cached ? Date.now() - cached.at : Infinity;
  if (cached && age < SOFT_TTL_MS) return cached.value;

  if (cached && age < HARD_TTL_MS) {
    // Stale but usable: serve it now, refresh quietly in the background.
    if (!store.__provenInflight) {
      store.__provenInflight = build()
        .then((value) => {
          store.__provenCatalogue = { at: Date.now(), value };
          return value;
        })
        .catch(() => cached.value)
        .finally(() => {
          store.__provenInflight = null;
        });
    }
    return cached.value;
  }

  if (store.__provenInflight) return store.__provenInflight;
  store.__provenInflight = build()
    .then((value) => {
      store.__provenCatalogue = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      store.__provenInflight = null;
    });
  return store.__provenInflight;
}

async function build(): Promise<Catalogue> {
  const jobs = CATS.flatMap((category) =>
    CATEGORY_QUERIES[category].map((search) => ({ category, search })),
  );

  const [results, count] = await Promise.all([
    Promise.allSettled(jobs.map((j) => listAgents({ search: j.search, limit: 50 }))),
    countAll().catch(() => 0),
  ]);

  const byCategory = { rebalancing: [], grid: [], yield: [], "health-factor": [] } as Record<Category, Agent[]>;
  const seen = new Set<string>();

  results.forEach((r) => {
    if (r.status !== "fulfilled") return;
    for (const a of r.value.agents) {
      if (seen.has(a.id)) continue;
      // Trust the agent's own classification, not the query that found it.
      seen.add(a.id);
      byCategory[a.category].push(a);
    }
  });

  const anySucceeded = results.some((r) => r.status === "fulfilled");
  if (!anySucceeded) {
    // Upstream search is down outright — degrade instead of failing: pull a
    // few unfiltered top-score pages and classify them ourselves. Not as
    // balanced as the targeted searches, but every agent shown is still
    // real, and going a few pages deep gives each category a real shot at
    // being represented rather than just whatever lands on page one.
    const fallbackPages = await Promise.allSettled(
      [0, 1, 2].map((i) => listAgents({ limit: MAX_LIMIT, offset: i * MAX_LIMIT, sort: "total_score" })),
    );
    for (const r of fallbackPages) {
      if (r.status !== "fulfilled") continue;
      for (const a of r.value.agents) byCategory[a.category].push(a);
    }

    // Even the fallback found nothing real — 8004scan is genuinely
    // unreachable right now, not just its search parameter. Throw so this
    // never gets cached as a hollow "0 agents" success.
    if (CATS.every((c) => byCategory[c].length === 0)) {
      const first = fallbackPages.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw first?.reason ?? new ScanError(502, "8004scan unreachable");
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
