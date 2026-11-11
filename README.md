# 3ilm MCP Server

MCP server exposing **3ilm**, a curated knowledge base of 1,032 smart contract vulnerability findings from 10 fully-reconciled [Sherlock](https://audits.sherlock.xyz) audit contests.

Built for AI agents, security researchers, and audit tools that need structured data on which bug classes get paid, at what rates, and why.

## Size, stated honestly

[Solodit](https://www.cyfrin.io/products/solodit) (Cyfrin) advertises 80,000+ aggregated findings. This dataset is smaller on purpose: 1,032 findings, every one reconciled by hand against the contest's own published outcome, not scraped and left as-is. If you want raw volume across every audit firm, use Solodit. If you want a smaller set where every acceptance-rate number has been checked against what the contest actually paid, that's what's here.

**Why this exists next to [bug-bounty-intelligence-mcp](https://github.com/holistis/bug-bounty-intelligence-mcp):** same verified dataset, but this package has no paid tier at all and no dependency on anything beyond pattern lookup. If you only ever want the free `search_vulnerabilities` / `get_pattern_details` / `list_patterns` tools, this is the lighter install. If you also want the paid `scan_contract` full-repo scan, use bug-bounty-intelligence-mcp instead; it includes everything this package does plus that one paid tool.

## What it is

3ilm (Arabic: علم, "knowledge") contains:

- **1,032 verified findings** from 10 Sherlock contests (fully reconciled against contest outcomes)
- **12 vulnerability pattern categories** with real acceptance rates, not estimates
- **Accepted and rejected examples** per category, to learn what passes triage

## Tools

| Tool | Description |
|------|-------------|
| `search_vulnerabilities` | Keyword search across all 12 categories. Returns matching patterns with acceptance rates and examples. |
| `get_pattern_details` | Full stats table for one specific pattern: totals, acceptance rate, Sherlock-specific note, examples. |
| `list_patterns` | All 12 patterns ranked by volume with 🟢🟡🔴 acceptance indicators. |

## Install

```bash
npx 3ilm-mcp
```

## Add to Claude / Cursor

**Claude Desktop** (add to `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "3ilm": {
      "command": "npx",
      "args": ["-y", "3ilm-mcp"]
    }
  }
}
```

**Cursor** (add to `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "3ilm": {
      "command": "npx",
      "args": ["-y", "3ilm-mcp"]
    }
  }
}
```

## Example queries

Ask your AI assistant:

- "What is the acceptance rate for oracle manipulation findings on Sherlock?"
- "Show me all vulnerability patterns and their payout rates"
- "Search for reentrancy vulnerabilities: what percentage get accepted?"
- "What does a accepted flash loan finding look like vs a rejected one?"

## Data source

Same underlying dataset as [`vulnerability-acceptance-rates.json`](https://github.com/holistis/bug-bounty-intelligence-mcp/blob/main/vulnerability-acceptance-rates.json), CC0, downloadable directly, no server required. That file is the canonical, publicly reproducible source; the numbers here are copied from it, not independently computed. Findings are reconciled against actual contest outcomes, no scraping, no estimates. See [METHODOLOGY.md](https://github.com/holistis/bug-bounty-intelligence-mcp/blob/main/METHODOLOGY.md) for the exact reconciliation method.

The 12 patterns: `fee-miscalculation`, `dos-griefing`, `reentrancy`, `trusted-actor`, `overflow`, `staleness`, `rounding`, `access-control`, `oracle-manipulation`, `mev-slippage`, `liquidation`, `flash-loan`.

## How this relates to bug-bounty-intelligence-mcp

Both MCP servers read the same verified data. They differ in scope:

| | 3ilm-mcp (this repo) | [bug-bounty-intelligence-mcp](https://github.com/holistis/bug-bounty-intelligence-mcp) |
|---|---|---|
| Pattern search / acceptance rates | Free | Free (`list_vulnerability_patterns`) |
| Full-repo contract scan | Not offered | $5 USDC via x402 (`scan_contract`) |
| Cost | Always free, no paid tier | Free tools + one paid tool |
| Best for | Just want the pattern data via MCP, nothing else | Also want an actual scan of your own contracts |

If you only need to query acceptance rates, either server works identically for that. Use 3ilm-mcp if you want the smaller, free-only package; use bug-bounty-intelligence-mcp if you also want the paid full-repo scan tool.

## Related

- HTTP API (pay-per-query, USDC on Base): `https://wazir-x402.duckdns.org/api/vuln-search?q=oracle`
- x402 Tollbooth: all endpoints listed at `/api/status`

## License

MIT
