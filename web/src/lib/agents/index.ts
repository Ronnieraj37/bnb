import { listAgents, getAgentDetail, catalogue, scanEnabled, ScanError } from "./scan";
import type { Agent, Category } from "./types";
import { CATEGORIES } from "./types";

// Data access for the marketplace. Everything is live 8004scan data for BNB
// Smart Chain mainnet — there is no local catalogue and no fallback dataset, so
// if the registry is unreachable the UI says exactly that.

export type SortKey = "score" | "feedback" | "newest";
export type BrowseFilters = { x402?: boolean; reviews?: boolean };

export type BrowseResult = {
  agents: Agent[];
  indexed: number;
  isMatchCount?: boolean;
  error?: string;
  /** The single highest-scored agent per category, for a featured strip. */
  featured?: Partial<Record<Category, Agent>>;
};

const CATS = Object.keys(CATEGORIES) as Category[];

/** Apply user-chosen filters and sort to a list of agents. Pure, data-driven. */
function applyView(agents: Agent[], sort: SortKey = "score", filters: BrowseFilters = {}): Agent[] {
  let out = agents;
  if (filters.x402) out = out.filter((a) => a.x402);
  if (filters.reviews) out = out.filter((a) => a.feedbackCount > 0);
  const sorted = [...out];
  if (sort === "feedback") {
    sorted.sort((a, b) => b.feedbackCount - a.feedbackCount || b.averageScore - a.averageScore || b.score - a.score);
  } else if (sort === "newest") {
    const t = (a: Agent) => (a.provenance.createdAt ? Date.parse(a.provenance.createdAt) : 0);
    sorted.sort((a, b) => t(b) - t(a));
  } else {
    sorted.sort((a, b) => b.score - a.score);
  }
  return sorted;
}

export async function browse(opts: {
  category?: Category;
  search?: string;
  sort?: SortKey;
  filters?: BrowseFilters;
} = {}): Promise<BrowseResult> {
  if (!scanEnabled()) {
    return { agents: [], indexed: 0, error: "SCAN_API_KEY is not configured." };
  }

  try {
    if (opts.search?.trim()) {
      const page = await listAgents({ search: opts.search, limit: 60 });
      const filtered = opts.category
        ? page.agents.filter((a) => a.category === opts.category)
        : page.agents;
      return { agents: applyView(filtered, opts.sort, opts.filters), indexed: page.total, isMatchCount: true };
    }

    const { byCategory, indexed } = await catalogue();

    // The list endpoint (what fills the catalogue) does not return an agent's
    // capabilities or health — only its detail endpoint does. The featured
    // strip is small and fixed (one per category), so it is worth the extra
    // round trip to show real tools instead of an empty "no interface" card.
    const base = opts.category
      ? byCategory[opts.category].slice(0, 48)
      : CATS.flatMap((c) => byCategory[c].slice(0, 12));

    // catalogue() degrades rather than throwing, so an empty result here means
    // the registry is unreachable AND we have nothing cached to fall back on.
    // Bail out before the enrichment below — there is nothing to enrich, and
    // waiting on it would just add its deadline to an already-failing page.
    if (base.length === 0) {
      return {
        agents: [], indexed, featured: {},
        error: "The ERC-8004 registry is temporarily unreachable. This is upstream of us — the marketplace will fill back in automatically as soon as it responds.",
      };
    }

    // Populate the featured strip from the catalogue we already hold, so it
    // renders instantly. The detail fetch (which adds tools/health) is an
    // enrichment on top, bounded by a short deadline — previously these four
    // extra round trips blocked the whole page behind a slow registry.
    const featured: Partial<Record<Category, Agent>> = {};
    for (const c of CATS) {
      const top = byCategory[c][0];
      if (top) featured[c] = top;
    }
    await Promise.race([
      Promise.all(
        CATS.map(async (c) => {
          const top = byCategory[c][0];
          if (!top) return;
          const detailed = await getAgentDetail(top.contract, top.tokenId).catch(() => null);
          if (detailed) featured[c] = detailed;
        }),
      ),
      new Promise((r) => setTimeout(r, 1200)),
    ]);

    return { agents: applyView(base, opts.sort, opts.filters), indexed, featured };
  } catch (e) {
    const msg =
      e instanceof ScanError
        ? e.status === 504
          ? "The registry didn't respond in time. Showing what we have cached — it'll refresh automatically."
          : `Registry unavailable (8004scan returned ${e.status}).`
        : "Registry unavailable.";
    return { agents: [], indexed: 0, error: msg };
  }
}

export async function categoryTotals(): Promise<Record<Category, number>> {
  try {
    const { byCategory } = await catalogue();
    return {
      rebalancing: byCategory.rebalancing.length,
      grid: byCategory.grid.length,
      yield: byCategory.yield.length,
      "health-factor": byCategory["health-factor"].length,
    };
  } catch {
    return { rebalancing: 0, grid: 0, yield: 0, "health-factor": 0 };
  }
}

export function countByCategory(agents: Agent[]): Record<Category, number> {
  const c = { rebalancing: 0, grid: 0, yield: 0, "health-factor": 0 } as Record<Category, number>;
  for (const a of agents) c[a.category]++;
  return c;
}

/** Agent page. Ids are "56:contract:tokenId". */
export async function getAgent(id: string): Promise<Agent | null> {
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  const [, contract, tokenId] = parts;
  try {
    return await getAgentDetail(contract, tokenId);
  } catch {
    return null;
  }
}

export * from "./types";
