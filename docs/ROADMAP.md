# Roadmap

## Positioning

Our competitor curates ~9 flagship agents with hand-set metrics (four of their trading agents show the identical "14.2%"), a polished hire flow, and no mobile support. They win on "feels finished".

**We commit to the honest real-data marketplace instead** — the real ~300k-agent registry, real on-chain reads, real live rates, and full mobile support for the hire journey. We adopt their UX lessons (outcome-first cards, a hire that completes, cohesion) without ever faking a number.

## Done

**Trust & data**
- [x] Real 8004scan integration, four categories with equal depth
- [x] Strategy demo grounded in real BNB price, real wallet size, live DeFiLlama rates — labelled illustrative
- [x] Prominent **live APR** on agent pages; live yields + prices on home
- [x] Keyless **on-chain holdings & activity** (no API key required)
- [x] Optional full track record (money in/out, PnL, venues, equity curve) when a BSC history key is present

**Product**
- [x] Marketplace with real sort (score / most-reviewed / newest) and filters (x402, has reviews)
- [x] Plain-English capabilities, split into reads vs actions that move your money
- [x] **Hire → Activate → Revoke** — EIP-712 scoped session (allowlist + cap + expiry), `/hired` control panel, header badge, one-click revoke
- [x] Flow builder with one-click starter templates and real BSC-testnet swaps
- [x] Agent Advantage Report (`/advantage`) — 3 jobs, by hand vs with an agent
- [x] Full mobile support for browse → agent → hire; builder gated to desktop with a clear message

**Quality**
- [x] Clean card design system, per-category accents, calm background
- [x] Hire flow as a portalled popup (escapes the card's containing block)
- [x] Robustness: CSS-only reveals (no invisible content), guaranteed CountUp settle, background-tab-safe session loading
- [x] Dead code removed (live-probe UI, unused MCP routes/client, unused `motion` dependency)

## Next

**Highest value**
- [ ] **Altana Keystore on-chain grant** — submit the signed session so enforcement and revocation are fully on-chain and visible in the Altana explorer. Needs their SDK/contract addresses, which aren't concretely published yet.
- [ ] **Richer outcome-first cards** — a real per-agent performance number on the marketplace card. Gated on a BSC history data source (Etherscan Lite, or a free NodeReal/BSCTrace adapter).

**Then**
- [ ] Read live strategy config from agents that expose it via MCP, and use real values instead of category defaults
- [ ] Real current Venus health factor as an anchor in the health-factor demo
- [ ] Shared wallet hook + connected state in the global header
- [ ] `/compare` as a genuine side-by-side decision tool
- [ ] x402 / ERC-8183 sell-side integration
- [ ] OG images, sitemap, robots
