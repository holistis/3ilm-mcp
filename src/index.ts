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
  "Search the 3ilm knowledge base (1,032 exact-reconciled Sherlock findings, 10 contests) by " +
    "keyword to find which vulnerability pattern category a bug belongs to, its real acceptance " +
    "rate, and concrete accepted/rejected write-up examples. Call this when you've spotted a " +
    'potential bug and want to know if it\'s the kind that typically gets paid — e.g. query ' +
    '"oracle price manipulation" to learn it\'s accepted only 36% of the time (needs strong ' +
    'proof of impact), or "reentrancy" to see it\'s accepted 78% of the time (a comparatively ' +
    "safe category) — before spending time writing a full report. Input: a 3+ character keyword " +
    "phrase. Output: matched patterns ranked by relevance, each with acceptance %, accepted and " +
    "rejected examples, and Sherlock-specific notes. Faster and more reliable than re-deriving " +
    "acceptance rates yourself from raw Sherlock judging-repo GitHub issues — this data is " +
    "already reconciled against each contest's own accepted/invalid folder structure.",
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
  "Get the complete stats table for exactly ONE named vulnerability pattern (one of 12 " +
    "categories — call list_patterns first if you don't know the exact kebab-case name, e.g. " +
    '"access-control" or "oracle-manipulation"). Use this once you already know which pattern ' +
    "you're dealing with and need the full picture: total/accepted/rejected/duplicated counts, " +
    "a Sherlock-specific note, and BOTH accepted and rejected example write-ups so you can see " +
    "exactly where the line falls between a finding that pays out and one that gets thrown out. " +
    "Input: the exact pattern name. Output: a markdown stats table plus a plain-English read on " +
    'whether the pattern is "strong" (>=50% acceptance) or "competitive/noisy" (<50%, needs ' +
    "stronger proof of impact).",
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
  "List all 12 vulnerability pattern categories at once, ranked by finding volume, each with a " +
    "🟢/🟡/🔴 acceptance-rate indicator (🟢 >=55%, 🟡 45-54%, 🔴 <45%). Call this FIRST when " +
    "triaging a new codebase or when you don't yet know which specific bug class applies — e.g. " +
    'to see at a glance that "trusted-actor" issues (311 submitted) are far more common than ' +
    '"flash-loan" issues (13 submitted), so you can prioritize review time accordingly. No ' +
    "input required. Output: a full ranked table. Follow up with search_vulnerabilities for a " +
    "keyword lookup, or get_pattern_details once you've picked one specific pattern from this " +
    "list.",
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
