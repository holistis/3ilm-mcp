/**
 * data.ts — loads and searches the 3ilm verified vulnerability knowledge base.
 *
 * Canonical source: Sherlock _index.json (10 fully-reconciled contests, 1,032 findings).
 * Using only verified data — acceptance rates are ground-truth, not estimates.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PatternStats {
  total: number;
  accepted: number;
  rejected: number;
  duplicated?: number;
  acceptance_rate: string;
  examples_accepted: string[];
  examples_rejected: string[];
  platform_breakdown?: {
    sherlock?: { acceptance_rate: number; total: number; note: string };
    code4rena?: { acceptance_rate: number; total: number; note: string };
  };
}

export interface Index {
  last_updated: string;
  contests_crawled: number;
  total_findings: number;
  methodology: string;
  pattern_library: Record<string, PatternStats>;
}

export interface SearchResult {
  pattern: string;
  score: number;
  total_findings: number;
  accepted: number;
  acceptance_rate: number;
  examples_accepted: string[];
  examples_rejected: string[];
  platform_note: string;
}

// ── Load data ─────────────────────────────────────────────────────────────────

const DATA_PATH_CANDIDATES = [
  // When installed via npm — bundled data next to dist/
  join(dirname(fileURLToPath(import.meta.url)), "..", "data", "sherlock-index.json"),
  // When running from repo (dev / npx from source)
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "sherlock-index.json"),
  // Absolute fallback for local dev: wazir-al-ghanima repo
  resolve("C:/Code/wazir-al-ghanima/knowledge/3ilm/sherlock/_index.json"),
  resolve(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "wazir-al-ghanima", "knowledge", "3ilm", "sherlock", "_index.json")
  ),
];

function loadIndex(): Index {
  for (const p of DATA_PATH_CANDIDATES) {
    try {
      const raw = readFileSync(p, "utf8");
      const parsed: Index = JSON.parse(raw);
      if (parsed.pattern_library && parsed.total_findings) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `3ilm data file not found. Tried:\n${DATA_PATH_CANDIDATES.join("\n")}`
  );
}

export const index: Index = loadIndex();
export const patterns = index.pattern_library;
export const ALL_PATTERN_NAMES = Object.keys(patterns);

// ── Search ────────────────────────────────────────────────────────────────────

export function searchPatterns(query: string): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const [name, data] of Object.entries(patterns)) {
    let score = 0;
    const nameParts = name.split("-");

    for (const term of terms) {
      // Exact pattern-name word match → highest score
      if (nameParts.some((w) => w === term)) score += 6;
      // Prefix match on pattern-name word
      else if (nameParts.some((w) => w.startsWith(term) || term.startsWith(w))) score += 3;
      // Pattern name contains term
      else if (name.includes(term)) score += 2;
      // Example titles contain term
      if (data.examples_accepted.some((e) => e.toLowerCase().includes(term))) score += 1;
      if (data.examples_rejected.some((e) => e.toLowerCase().includes(term))) score += 0.5;
    }

    if (score > 0) {
      results.push({
        pattern: name,
        score,
        total_findings: data.total,
        accepted: data.accepted,
        acceptance_rate: parseFloat(data.acceptance_rate),
        examples_accepted: data.examples_accepted.slice(0, 3),
        examples_rejected: data.examples_rejected.slice(0, 2),
        platform_note: data.platform_breakdown?.sherlock
          ? `Sherlock: ${Math.round(data.platform_breakdown.sherlock.acceptance_rate * 100)}% acceptance (n=${data.platform_breakdown.sherlock.total})`
          : "",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function getPatternDetails(patternName: string): PatternStats | null {
  const key = patternName.toLowerCase().replace(/\s+/g, "-");
  return patterns[key] ?? patterns[patternName] ?? null;
}

export function listAllPatterns(): Array<{
  pattern: string;
  total: number;
  acceptance_rate: number;
  description: string;
}> {
  return Object.entries(patterns)
    .map(([name, data]) => ({
      pattern: name,
      total: data.total,
      acceptance_rate: parseFloat(data.acceptance_rate),
      description: data.examples_accepted[0]?.slice(0, 80) ?? "",
    }))
    .sort((a, b) => b.total - a.total);
}
