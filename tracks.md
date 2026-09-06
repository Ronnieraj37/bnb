The Smart Money Era: Build the Era

5 Aug - 9 Sep, 2026

Online

30,000 USD

Overview
Prizes & Bounties
Tracks
Resources
Main Track: Build the BNB Agent Studio Marketplace
Build the best agent marketplace for BNB Chain.

Somewhere, users need to find agents, understand what they do, and hire them in a few clicks. Right now that place doesn't exist. So: build it.

The top submission gets officially adopted as the BNB Agent Studio marketplace, the canonical front door for every agent on BSC. This isn't a demo day. Whatever you ship here is what real users interact with next.

What You're Building
A front end that surfaces agent data, lets users discover and activate agents by category, and doesn't make them think too hard about it.

Four categories, all first-class:

Category	What the agent does
Rebalancing	Manages LP ranges, resets positions automatically
Grid Trading	Places and manages automated grid orders
Yield Optimisation	Routes liquidity to the highest available APR
Health Factor Monitoring	Protects lending positions from liquidation
Single-category submissions score poorly. All four, equally deep, is the bar.

How You're Judged
Three judges, scored independently, then compared.

Criterion	Weight
Functionality	The full journey works end to end: land, find an agent by category, understand what it does, activate it, with minimal friction. Someone with zero Agent Studio knowledge should be able to get through it without hitting a dead end.
Data Quality	Real-time, accurate data that goes beyond basic counts. A user should be able to look at what you're showing and make a genuinely informed call on which agent to hire.
Agent Diversity	All four categories (rebalancing, grid trading, yield, health factor) surfaced with equal depth. A submission that treats one category as the main event and the rest as an afterthought won't score well here.
We'all also assess more criterias in the second phase, stay tuned to find out!

Timeline
Build: NOW!
Shortlist: Submissions close and the top 3 are shortlisted publicly.
Phase 2: [REDACTED]
Winner announced
Tooling
Describe it, and Cursor scaffolds it against the BNB Agent Studio CLI. No blockchain experience required to get from idea to deployed agent. Agent Studio runs on AWS underneath; that's just how it works, not a separate track to build for.

Eligibility
Open globally, to individuals or teams.
One entry per team.
Your submission must be functional and publicly accessible during judging.
Agents surfaced on your marketplace must be live on BSC.
Partner Track: Best Built with Altana
Altana is self-custodial infrastructure for sovereign agents. An agent holds its own wallet and its own key: no custodian, no shared treasury, no human signing every transaction. The owner grants a scoped session (which calls the agent may make, how much it may spend, when the permission expires), and grant and revoke stay with the owner. Every session key is registered in a public onchain registry, so any app or agent can check which keys hold authority on a wallet and when that authority expires. Revocation is one transaction and takes effect immediately.

The track: build an agent marketplace on BNB Chain where the agents transact for themselves, inside limits their users set.

What Separates a Winner from a Participant
To be considered for the prize, your submission must show live onchain transactions in the Altana explorer (testnet or mainnet).

Agents on their own Altana wallets.
Sessions with real limits: call allowlist, spend cap, expiry.
Sessions registered in Keystore, so integration is read onchain rather than from the pitch.
Real onchain transactions through a session key. Testnet counts, mainnet is stronger.
User-facing control: a user can see what their agent may do, and revoke it, inside the product.
Bonus:

Hire BNB Agent Studio agents through ERC-8183 using the Altana ERC-8183 SDK. Altana ships both the buyer side and the seller side.
Implement sell over x402/B402 using the x402 server SDK.
Ideas to Build
Build	The agent does	Altana piece
Agent hiring marketplace	Hires and pays other agents, escrow handled	ERC-8183 buyer side, hireErc8183Agent
Agent-to-agent commerce	Buys inference or data per call, neither side holds the other's keys	b402 payments, @altananetwork/x402-server
Autonomous DeFi	Rebalances, lends, stakes, copy-trades inside a cap it cannot exceed	Spend caps plus Aave, Venus, PancakeSwap, Lista skills
Micro-payment streaming	Pays per call, per second, per unit, with no human approving each one	Session key with expiry, b402
Treasury or payroll	Runs recurring payments and subscriptions on a schedule	Multiple agents on one wallet, different scopes
Partner Track: TermiX Challenge
What TermiX is judging, in one line: does hiring an agent on this marketplace actually beat doing the job yourself, and can you prove it with numbers?

You are not asked to integrate anything with TermiX. The submission is the marketplace itself, judged on whether the agents on it are genuinely worth paying for. TermiX will hire from your marketplace themselves and see what comes back.

How You're Judged
TermiX scores independently of the main track rubric.

Criterion	Weight	What "great" looks like
Value of the services	30%	Real working agents at a price and speed that beat the alternative. TermiX will hire from your marketplace and evaluate the results.
Proven agent advantage	30%	Measured, not asserted, backed by the required Agent Advantage Report.
High-stakes categories & track record	20%	Trading, stock/equities and security agents weighted above general-purpose. Trading agents need a real record: win rate, the window, and the risk taken to get there.
Marketplace quality	20%	Find, compare, hire, without instructions.
Required: Agent Advantage Report
Your submission must include an Agent Advantage Report:

At least 3 real tasks run both ways: with an agent hired through your marketplace vs. without.
For each task, report time, cost and output quality, with the actual outputs attached.
At least one task must come from trading, stock or security.
The "Proven agent advantage" criterion (30%) is scored against this report, so plan for it from day one.

Partner Challenge: PancakeSwap
Your agent must deliver a real benefit to PancakeSwap traders or liquidity providers. For example: smarter liquidity management, finding better yields, researching market movements to find demand where creating PancakeSwap pools could improve liquidity efficiency, or executing safe automated swaps using PancakeSwap products without ever putting user funds at risk.