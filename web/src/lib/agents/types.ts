// Domain model for ERC-8004 agents on BNB Smart Chain.
//
// Every field here maps to something 8004scan actually returns for a real agent
// on mainnet. There is no placeholder data and no synthesised performance: if we
// do not have a number for an agent, the field is absent and the UI says so.

export type Category = "rebalancing" | "grid" | "yield" | "health-factor";

export const CATEGORIES: Record<
  Category,
  { label: string; blurb: string; emoji: string; /** what matters when judging one */ judgeOn: string }
> = {
  rebalancing: {
    label: "Rebalancing",
    blurb: "Manages LP ranges and resets positions automatically.",
    emoji: "♻️",
    judgeOn: "Can it read a position and reset a range without you signing each time?",
  },
  grid: {
    label: "Grid Trading",
    blurb: "Places and manages automated grid orders.",
    emoji: "▦",
    judgeOn: "Can it place and cancel orders, and does it guard against one-way moves?",
  },
  yield: {
    label: "Yield Optimisation",
    blurb: "Routes liquidity to the highest available APR.",
    emoji: "🌱",
    judgeOn: "Does it compare venues, and does it account for gas before moving?",
  },
  "health-factor": {
    label: "Health Factor",
    blurb: "Protects lending positions from liquidation.",
    emoji: "🛡️",
    judgeOn: "Can it read your health factor and actually repay before liquidation?",
  },
};

/** 8004scan's own multi-factor score breakdown (0-100 each). */
export type ScoreBreakdown = {
  quality: number;
  popularity: number;
  activity: number;
  wallet: number;
  freshness: number;
  metadataCompleteness: number;
  health: number;
};

/** Live endpoint check performed by 8004scan. */
export type Health = {
  score: number | null;
  verified: boolean;
  error?: string;
  checkedAt?: string;
  domain?: string;
};

/** A callable interface the agent publishes (MCP tools / A2A endpoint). */
export type Capability = {
  kind: "mcp" | "a2a";
  endpoint: string;
  version?: string;
  /** Real tool names the agent exposes — the best evidence of what it can do. */
  tools: string[];
};

/** How the agent came to exist on-chain. */
export type Provenance = {
  txHash?: string;
  blockNumber?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Agent = {
  /** "56:contract:tokenId" */
  id: string;
  tokenId: string;
  contract: string;
  name: string;
  description: string;
  category: Category;
  /** Why we placed it in that category — shown to the user, never hidden. */
  categoryEvidence: string;

  ownerAddress: string;
  agentWallet?: string;

  imageUrl?: string;
  protocols: string[];
  x402: boolean;
  identityVerified: boolean;
  active: boolean;

  score: number;
  rank: number | null;
  breakdown?: ScoreBreakdown;
  feedbackCount: number;
  averageScore: number;
  validations: { total: number; successful: number };
  stars: number;

  health?: Health;
  capabilities: Capability[];
  provenance: Provenance;
  trustModels: string[];
  crossChainCount: number;
  /**
   * True only when this record came from the detail endpoint. The list
   * endpoint never returns capabilities or health, so on a list-derived
   * agent `capabilities` being empty means "we haven't checked" — not
   * "this agent has no interface". Cards must not conflate the two.
   */
  detailed: boolean;
};

export type AgentPage = {
  agents: Agent[];
  total: number;
  offset: number;
  limit: number;
};
