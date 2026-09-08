#!/usr/bin/env node
// Regenerate the seed snapshot used as the marketplace's last-resort fallback.
//
// Why this exists: 8004scan goes fully unreachable for stretches. Our caches
// (Next Data Cache + in-process) cover everything except a first-ever cold
// start during an outage — at which point the site had nothing real to show.
// This bakes ~50 real agents into the build so the marketplace is never empty.
//
// Run it whenever the registry is healthy:  npm run snapshot
//
// It stores the RAW upstream items; classification/mapping happens at runtime
// through the same code path as live data, so the snapshot can never drift
// from the app's own categorisation rules.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/lib/agents/snapshot.json");
const BASE = process.env.SCAN_API_BASE ?? "https://api.8004scan.io/api/v1";
const CHAIN_ID = 56;

// Mirrors CATEGORY_QUERIES in src/lib/agents/scan.ts
const QUERIES = [
  "health factor", "liquidation",
  "liquidity", "rebalance",
  "grid", "trading",
  "yield", "staking",
];

async function readKey() {
  if (process.env.SCAN_API_KEY) return process.env.SCAN_API_KEY;
  try {
    const env = await readFile(resolve(HERE, "../.env.local"), "utf8");
    return env.match(/^SCAN_API_KEY=(.*)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function get(path, key) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`8004scan ${res.status} on ${path}`);
  return res.json();
}

const key = await readKey();
if (!key) {
  console.error("✖ SCAN_API_KEY not found (env or web/.env.local)");
  process.exit(1);
}

console.log(`Fetching ${QUERIES.length} category queries from 8004scan…`);

const seen = new Set();
const items = [];
let failures = 0;

for (const q of QUERIES) {
  const params = new URLSearchParams({
    chain_id: String(CHAIN_ID), limit: "50", offset: "0",
    sort_by: "total_score", order: "desc", search: q,
  });
  try {
    const json = await get(`/agents?${params}`, key);
    let added = 0;
    for (const item of json.items ?? []) {
      if (seen.has(item.agent_id)) continue;
      seen.add(item.agent_id);
      items.push(item);
      added++;
    }
    console.log(`  ✓ ${q.padEnd(16)} +${added}`);
  } catch (e) {
    failures++;
    console.log(`  ✖ ${q.padEnd(16)} ${e.message}`);
  }
}

// The registry frequently fails `search=` (HTTP 500) while the plain list
// endpoint still works — mirror the app's own fallback so a snapshot can be
// generated whenever EITHER path is alive.
if (items.length === 0) {
  console.log("\nAll search queries failed — falling back to the plain list endpoint…");
  for (const offset of [0, 100, 200]) {
    const params = new URLSearchParams({
      chain_id: String(CHAIN_ID), limit: "100", offset: String(offset),
      sort_by: "total_score", order: "desc",
    });
    try {
      const json = await get(`/agents?${params}`, key);
      let added = 0;
      for (const item of json.items ?? []) {
        if (seen.has(item.agent_id)) continue;
        seen.add(item.agent_id);
        items.push(item);
        added++;
      }
      console.log(`  ✓ page offset=${offset} +${added}`);
    } catch (e) {
      console.log(`  ✖ page offset=${offset} ${e.message}`);
    }
  }
}

if (items.length === 0) {
  console.error("\n✖ No agents fetched — the registry is unreachable on both search and list. Snapshot NOT written (existing file left untouched).");
  process.exit(1);
}

let indexed = 0;
try {
  indexed = (await get(`/agents?chain_id=${CHAIN_ID}&limit=1`, key)).total ?? 0;
} catch { /* non-fatal */ }

await writeFile(OUT, JSON.stringify({ at: Date.now(), indexed, items }, null, 2) + "\n");
console.log(`\n✓ Wrote ${items.length} agents to snapshot.json (indexed: ${indexed}, ${failures} query failures)`);
