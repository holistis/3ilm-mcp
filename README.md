# 3ilm MCP Server

MCP server exposing **3ilm** — a curated knowledge base of 1,032 smart contract vulnerability findings from 10 fully-reconciled [Sherlock](https://audits.sherlock.xyz) audit contests.

Built for AI agents, security researchers, and audit tools that need structured data on which bug classes get paid, at what rates, and why.

## What it is

3ilm (Arabic: علم, "knowledge") contains:

- **1,032 verified findings** from 10 Sherlock contests (fully reconciled against contest outcomes)
- **12 vulnerability pattern categories** with real acceptance rates, not estimates
- **Accepted and rejected examples** per category — learn what passes triage

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

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "3ilm": {
      "command": "npx",
      "args": ["-y", "@holistis/3ilm-mcp"]
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "3ilm": {
      "command": "npx",
      "args": ["-y", "@holistis/3ilm-mcp"]
    }
  }
}
```

## Example queries

Ask your AI assistant:

- "What is the acceptance rate for oracle manipulation findings on Sherlock?"
- "Show me all vulnerability patterns and their payout rates"
- "Search for reentrancy vulnerabilities — what percentage get accepted?"
- "What does a accepted flash loan finding look like vs a rejected one?"

## Data source

All data from the verified `sherlock/_index.json` in the [3ilm knowledge base](https://github.com/holistis/3ilm-mcp). Findings are reconciled against actual contest outcomes — no scraping, no estimates.

The 12 patterns: `fee-miscalculation`, `dos-griefing`, `reentrancy`, `trusted-actor`, `overflow`, `staleness`, `rounding`, `access-control`, `oracle-manipulation`, `mev-slippage`, `liquidation`, `flash-loan`.

## Related

- HTTP API (pay-per-query, USDC on Base): `https://wazir-x402.duckdns.org/api/vuln-search?q=oracle`
- x402 Tollbooth: all endpoints listed at `/api/status`

## License

MIT
