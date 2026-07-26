#!/usr/bin/env node
/**
 * 3ilm MCP Server
 *
 * Exposes the 3ilm vulnerability knowledge base via the Model Context Protocol.
 * Data: 1,032 smart contract findings from 10 fully-reconciled Sherlock audit contests.
 *
 * Tools:
 *   search_vulnerabilities  — keyword search across 12 vulnerability pattern categories
 *   get_pattern_details     — full stats for a specific pattern
 *   list_patterns           — all 12 patterns ranked by volume with acceptance rates
 *
 * Usage in Claude / Cursor: add to mcp config, then ask e.g.
 *   "What is the acceptance rate for oracle manipulation findings on Sherlock?"
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchPatterns,
  getPatternDetails,
  listAllPatterns,
  index,
  ALL_PATTERN_NAMES,
} from "./data.js";

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "3ilm",
  version: "1.0.0",
});

// ── Tool 1: search_vulnerabilities ────────────────────────────────────────────

server.tool(
  "search_vulnerabilities",
  {
    query: z
      .string()
      .min(3)
      .describe(
        'Keyword search query. Examples: "oracle price manipulation", "reentrancy", "fee calculation", "flash loan", "access control", "rounding error"'
      ),
  },
  async ({ query }) => {
    const results = searchPatterns(query);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: [
              `No patterns found for query: "${query}"`,
              ``,
              `Available patterns: ${ALL_PATTERN_NAMES.join(", ")}`,
              ``,
              `Try shorter or different keywords, e.g. "oracle", "fee", "dos", "flash".`,
            ].join("\n"),
          },
        ],
      };
    }

    const lines: string[] = [
      `## 3ilm Vulnerability Search: "${query}"`,
      `Source: ${index.contests_crawled} fully-reconciled Sherlock contests · ${index.total_findings} findings`,
      ``,
    ];

    for (const r of results) {
      const pct = Math.round(r.acceptance_rate * 100);
      lines.push(`### ${r.pattern}`);
      lines.push(`- **Acceptance rate**: ${pct}% (${r.accepted}/${r.total_findings} findings accepted)`);
      if (r.platform_note) lines.push(`- **Sherlock context**: ${r.platform_note}`);
      lines.push(`- **Examples (accepted)**:`);
      for (const ex of r.examples_accepted) lines.push(`  - ${ex}`);
      if (r.examples_rejected.length > 0) {
        lines.push(`- **Examples (rejected)**:`);
        for (const ex of r.examples_rejected) lines.push(`  - ${ex}`);
      }
      lines.push(``);
    }

    lines.push(
      `> Tip: use \`get_pattern_details\` for full stats on a specific pattern.`
    );

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── Tool 2: get_pattern_details ───────────────────────────────────────────────

server.tool(
  "get_pattern_details",
  {
    pattern: z
      .string()
      .describe(
        `Exact pattern name (kebab-case). One of: ${ALL_PATTERN_NAMES.join(", ")}`
      ),
  },
  async ({ pattern }) => {
    const data = getPatternDetails(pattern);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: [
              `Pattern "${pattern}" not found.`,
              `Available: ${ALL_PATTERN_NAMES.join(", ")}`,
            ].join("\n"),
          },
        ],
      };
    }

    const pct = Math.round(parseFloat(data.acceptance_rate) * 100);
    const rejectionPct = 100 - pct;

    const lines: string[] = [
      `## Pattern: ${pattern}`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total findings | ${data.total} |`,
      `| Accepted | ${data.accepted} (${pct}%) |`,
      `| Rejected | ${data.rejected} (${rejectionPct}%) |`,
      `| Duplicated | ${data.duplicated ?? 0} |`,
      `| Acceptance rate | **${pct}%** |`,
      ``,
    ];

    if (data.platform_breakdown?.sherlock) {
      const sh = data.platform_breakdown.sherlock;
      lines.push(`### Sherlock`);
      lines.push(`- Acceptance rate: ${Math.round(sh.acceptance_rate * 100)}%`);
      lines.push(`- Total findings: ${sh.total}`);
      lines.push(`- Note: ${sh.note}`);
      lines.push(``);
    }

    lines.push(`### Accepted finding examples`);
    for (const ex of data.examples_accepted) lines.push(`- ${ex}`);
    lines.push(``);

    lines.push(`### Rejected finding examples`);
    for (const ex of data.examples_rejected) lines.push(`- ${ex}`);
    lines.push(``);

    lines.push(
      `### How to use this data`,
      `An acceptance rate of ${pct}% means roughly ${pct} out of 100 submitted findings in this category get paid out on Sherlock.`,
      pct >= 50
        ? `This is a **strong** category — well-scoped findings here have good payout odds.`
        : `This is a **competitive/noisy** category — findings need strong proof of impact to be accepted.`
    );

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── Tool 3: list_patterns ─────────────────────────────────────────────────────

server.tool(
  "list_patterns",
  {},
  async () => {
    const all = listAllPatterns();

    const lines: string[] = [
      `## 3ilm — All Vulnerability Pattern Categories`,
      `Source: ${index.contests_crawled} Sherlock contests · ${index.total_findings} findings · ${index.last_updated?.slice(0, 10) ?? "2026"}`,
      ``,
      `| Pattern | Total | Acceptance Rate | Sherlock note |`,
      `|---------|-------|-----------------|---------------|`,
    ];

    for (const p of all) {
      const pct = Math.round(p.acceptance_rate * 100);
      const bar =
        pct >= 55 ? "🟢" : pct >= 45 ? "🟡" : "🔴";
      const shNote =
        (index.pattern_library[p.pattern]?.platform_breakdown?.sherlock?.note ??
          "").replace(/High\+Medium betaalt/g, "H+M paid");
      lines.push(
        `| ${p.pattern} | ${p.total} | ${bar} ${pct}% | ${shNote} |`
      );
    }

    lines.push(``);
    lines.push(`🟢 ≥55% · 🟡 45–54% · 🔴 <45%`);
    lines.push(``);
    lines.push(
      `Use \`search_vulnerabilities\` to find patterns by keyword, or \`get_pattern_details\` for full stats.`
    );

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
