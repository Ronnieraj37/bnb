import { listAgents, getAgentDetail, catalogue, scanEnabled, ScanError } from "./scan";
import type { Agent, Category } from "./types";
import { CATEGORIES } from "./types";

// Data access for the marketplace. Everything is live 8004scan data for BNB
// Smart Chain mainnet — there is no local catalogue and no fallback dataset, so
// if the registry is unreachable the UI says exactly that.

export type BrowseResult = {
  agents: Agent[];
  indexed: number;
  isMatchCount?: boolean;
  error?: string;
  /** The single highest-scored agent per category, for a featured strip. */
  featured?: Partial<Record<Category, Agent>>;
};

const CATS = Object.keys(CATEGORIES) as Category[];

export async function browse(opts: {
  category?: Category;
  search?: string;
} = {}): Promise<BrowseResult> {
  if (!scanEnabled()) {
    return { agents: [], indexed: 0, error: "SCAN_API_KEY is not configured." };
  }

  try {
    if (opts.search?.trim()) {
      const page = await listAgents({ search: opts.search, limit: 60 });
      const agents = opts.category
        ? page.agents.filter((a) => a.category === opts.category)
        : page.agents;
      return { agents, indexed: page.total, isMatchCount: true };
    }

    const { byCategory, indexed } = await catalogue();

    // The list endpoint (what fills the catalogue) does not return an agent's
    // capabilities or health — only its detail endpoint does. The featured
    // strip is small and fixed (one per category), so it is worth the extra
    // round trip to show real tools instead of an empty "no interface" card.
    const featured: Partial<Record<Category, Agent>> = {};
    await Promise.all(
      CATS.map(async (c) => {
        const top = byCategory[c][0];
        if (!top) return;
        const detailed = await getAgentDetail(top.contract, top.tokenId).catch(() => null);
        featured[c] = detailed ?? top;
      }),
    );

    const agents = opts.category
      ? byCategory[opts.category].slice(0, 48)
      : CATS.flatMap((c) => byCategory[c].slice(0, 9)).sort((a, b) => b.score - a.score);

    return { agents, indexed, featured };
  } catch (e) {
    const msg =
      e instanceof ScanError
        ? e.status === 504
          ? "The registry did not respond in time. Some search terms are slow upstream — try another."
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
