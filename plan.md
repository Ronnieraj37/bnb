# Proven — Build-to-Ship Plan

Goal: turn Proven from "impressive to look at" into "a marketplace real users can find, understand, hire from, and control" — and win the tracks it targets. Items are checkboxes; we complete them one by one. `[x]` = done, `[~]` = partial, `[ ]` = todo.

Honesty rule (non-negotiable, the project's whole thesis): **no fabricated numbers.** Real on-chain / real market data, or an explicit "illustrative / N/A" label. Never a number that pretends to be something it isn't.

## Positioning (locked)
Competitor **4lpha** = ~9 curated flagship agents with **designed metrics** (tell: 4 trading agents all show the same "14.2%" PnL), a working "Hire Now", CRT-gold polish, **no mobile**. They win on "feels finished."

**Our commitment: the honest real-data marketplace — our moat.** Real 290k ERC-8004 registry, live endpoint verification, REAL reconstructed on-chain track records, the `/build` AI studio, and mobile. Pitch: **"every number is real and on-chain-verifiable, not marketing."** We adopt their UX lessons (outcome-first cards, a hire that completes, cohesion) but keep our product taste and integrity — we do NOT fake polish with invented numbers. Build all gaps one by one and make each actually work.

### Execution order (each must fully work before moving on)
1. [x] **Real sort/filter** (score/most-reviewed/newest + x402/has-reviews toggles, URL-driven, server-sorted — verified). [~] outcome-first card content (bold redesign done; richer real per-agent metric still gated on the BSC history key). Also fixed a real bug: entrance reveals were JS/hydration-dependent and could leave sections invisible — now pure CSS.
2. [x] **Working Hire → Activate → Revoke** — hire now COMPLETES: the grant is a real **EIP-712 wallet signature** over the scoped permission (allowlist + spend cap + expiry), persisted; the agent shows **"Hired · active"**; a **`/hired` "My agents"** page lists every session with spend cap, expiry countdown, allowed calls, and one-click **Revoke**; header shows a live active-count badge. Verified end-to-end (store→UI→revoke). Honest label: submitting the signed grant to the Altana Keystore for on-chain enforcement is the documented next step (SDK not concretely published). No more disabled dead-end.
3. **Cohesive visual polish** — our identity, finished feel, mobile.
Then the sponsor-bounty items (Advantage Report, PancakeSwap benefit, x402).

---

## Phase 0 — Trust & the interactive demo (do first; answers "is this real?")

- [~] **Ground the StrategyDemo in real data.** Price is already real (Binance BNB/USDT). Make the parameters real where possible and honest where not:
  - [x] Budget = the agent's **real wallet portfolio USD** (from `walletSnapshot`), not a hardcoded 500.
  - [x] Yield demo APRs = **real DeFiLlama** BSC venue rates (from `getBscPools`), not hardcoded.
  - [x] Venue label = the agent's declared protocol.
  - [x] Clear caption: honest "illustrative simulation… agent doesn't publish exact params on-chain."
  - [ ] Where an agent DOES expose live config via MCP (grid levels, thresholds), read them and use the real values; otherwise say so.
- [ ] Health-factor demo: show the agent wallet's **real current Venus HF** (via `venusHealthFactor`) as an anchor when it has a position.

## Phase 1 — Go-live essentials (users can USE it, not just look)

- [~] **Wallet connection** — currently raw `window.ethereum`. Make it robust and shared:
  - [ ] One `useWallet` hook (connect, account, chainId, switch/add BSC, disconnect, `accountsChanged`/`chainChanged` listeners, persistence).
  - [ ] Show connected state in the global header on every page.
- [ ] **Complete the Hire → Activate → Revoke flow** (removes the disabled dead-end):
  - [ ] Grant a **real scoped session** — Altana Keystore on BSC testnet if the SDK cooperates; otherwise a signed, stored session with a real, working **Revoke** and clear testnet labeling.
  - [ ] Reach an explicit **"Agent activated"** state (limits shown), never a disabled button.
- [ ] **"My Hired Agents" tray/page** — active sessions, spend used vs cap, time to expiry, one-click **Revoke** (satisfies Altana's user-facing-control criterion).
- [ ] **States everywhere**: loading (skeletons ✓ on agent page — extend to home/build/compare), empty, and error states with retry. No blank flashes, no dead ends.
- [x] **Mobile responsiveness** — verified marketplace + agent page + hero + hire all work on 375px; `/build` canvas now shows a clean "desktop experience" gate on mobile (like the competitor, but our core hire journey works on mobile — they support none); CompareTray made mobile-safe (truncated, width-capped); fixed `CountUp` (was stuck at 0 when hidden — now guaranteed to show the real number).
- [ ] **Resilience**: 8004scan rate-limit/timeout handling with graceful copy; never a white screen.
- [~] **Metadata/SEO/OG** per page — [x] dynamic per-agent title/description/OG via `generateMetadata`; [ ] `robots`, OG image, `sitemap`.
- [ ] **Env & secrets**: confirm `.env.local` gitignored; document required keys in README; sane behavior when keys absent.
- [ ] **Testnet vs mainnet clarity**: consistent, visible labeling of what's live-mainnet-read vs testnet-execute.

## Phase 2 — UI / UX overhaul (cleaner, calmer, more usable)

Direction: calmer and more legible than the current heavy "cosmic" theme — closer to the clean dark reference. Keep BNB gold accent, dial back glow/blur, tighten spacing and hierarchy.

- [x] Perf: static background, throttled starfield, streamed sections.
- [x] **Design-system pass**: new elevated `.card`/`.card-hover` surface (replaces muddy glass on content), `.eyebrow`, `.stat-value`, `.pill`, per-category **accent colors**, global focus ring, font smoothing, tighter headings, selection color, calmer background.
- [~] **Shared `<SiteHeader>`** on home/agent/loading (build/compare + wallet state still to wire); `<SiteFooter>` [ ].
- [x] **Bold agent card redesign** — category accent edge + pill, big name, score ring, always-present "what it does", clean live/runnable/rating footer, hover lift.
- [x] **Agent hero redesign** — accent-glow header, big score ring + name, quick-signal badges, provenance chips, prominent Hire.
- [x] **Track record → dashboard** with big tabular numbers.
- [ ] **Marketplace**: real **sort** (score/feedback/newest), **filters** (x402, has-reviews, endpoint-live), clearer category tabs.
- [ ] **Agent page**: tighten the section rhythm, make the StrategyDemo the clear hero, group sidebar trust signals, better mobile stack.
- [ ] **Build page**: cleaner block palette, better empty state, results panel polish, mobile fallback message.
- [ ] **Compare page**: make it a genuine side-by-side decision tool (metrics table, demo thumbnails).
- [ ] Consistent micro-interactions (hover, focus rings, reduced-motion respected).

## Phase 3 — Sponsor tracks & bounties (win conditions)

### Main track — BNB Agent Studio Marketplace
- [x] Live 8004scan data, four categories surfaced with equal depth.
- [~] End-to-end journey: land → find by category → understand (demo + track record) → **activate**. Blocked only by the Hire completion (Phase 1).
- [ ] **Data quality**: ensure each category page shows real, decision-grade numbers (not just counts).
- [ ] Compliance note: "agents surfaced must be live on BSC" — our marketplace lists real on-chain registry agents ✓; keep any first-party agents clearly labeled.

### Partner — Best Built with Altana (needs live on-chain proof)
- [ ] Agents on their **own Altana wallets**; sessions with **call allowlist + spend cap + expiry**.
- [ ] Sessions **registered in Keystore** (read on-chain, not from the pitch).
- [ ] **Real on-chain transaction through a session key** (testnet counts) — link to the Altana explorer in-app.
- [ ] **User-facing revoke** inside the product (Phase 1 tray).
- [ ] Bonus: **ERC-8183 hire** via Altana SDK; **x402/B402 sell** via x402 server SDK.

### Partner — TermiX Challenge (prove agent advantage with numbers)
- [x] **Agent Advantage Report** page (`/advantage`): 3 tasks run **with agent vs without** (time/cost/outcome), ≥1 trading (PancakeSwap V3 LP), grounded in **live** BSC data (real BNB price, real best-yield spread, BNB gas) with honest live/est. labels; linked in the header.
- [ ] Surface **trading track record** (win rate, window, risk) where we have the wallet history (needs the BSC history key — Etherscan Lite or a free NodeReal adapter).

### Partner — PancakeSwap (real benefit to LPs/traders)
- [x] `/build` executes **real testnet PancakeSwap v3 swaps** (approve + swap, user-signed).
- [ ] Rebalancing / yield surfaces use **real Pancake pool data**; make the LP/trader benefit explicit and measurable.

## Phase 4 — Nice-to-haves
- [ ] Alerts (Telegram infra already exists in `lib/alerts`).
- [ ] Light/dark toggle; full a11y pass (keyboard, ARIA, contrast).
- [ ] Shareable agent pages (OG cards), copy-link.
- [ ] Analytics (privacy-respecting) to show judges usage.

---

### Data-source dependency (tracked)
- BSC transaction history for the real Track Record needs a key: **Etherscan Lite plan** (paid, covers BSC) or a **free NodeReal/BSCTrace adapter**. Until then the Track Record shows the honest RPC snapshot fallback.
