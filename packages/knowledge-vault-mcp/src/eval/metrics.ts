import type { SearchResultItem } from "../types.js";
import type { EvalCaseResult, LatencySummary, MetricSummary } from "./types.js";

export function uniqueNotePaths(results: SearchResultItem[]): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];

  for (const result of results) {
    if (!seen.has(result.notePath)) {
      seen.add(result.notePath);
      paths.push(result.notePath);
    }
  }

  return paths;
}

export function hitAtRank(
  rankedPaths: string[],
  expectedPaths: string[],
  maxRank: number,
): boolean {
  const expected = new Set(expectedPaths);
  const limit = Math.min(maxRank, rankedPaths.length);

  for (let index = 0; index < limit; index += 1) {
    if (expected.has(rankedPaths[index] ?? "")) {
      return true;
    }
  }

  return false;
}

export function reciprocalRank(
  rankedPaths: string[],
  expectedPaths: string[],
  k: number,
): { value: number; firstHitRank: number | null } {
  const expected = new Set(expectedPaths);
  const limit = Math.min(k, rankedPaths.length);

  for (let index = 0; index < limit; index += 1) {
    const path = rankedPaths[index];
    if (path && expected.has(path)) {
      return { value: 1 / (index + 1), firstHitRank: index + 1 };
    }
  }

  return { value: 0, firstHitRank: null };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

export function summarizeLatencies(latencies: number[]): LatencySummary {
  if (latencies.length === 0) {
    return { p50: 0, p95: 0, mean: 0, min: 0, max: 0 };
  }

  const sum = latencies.reduce((total, value) => total + value, 0);

  return {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    mean: sum / latencies.length,
    min: Math.min(...latencies),
    max: Math.max(...latencies),
  };
}

export function summarizeCaseResults(
  cases: EvalCaseResult[],
  k: number,
): MetricSummary {
  if (cases.length === 0) {
    return {
      hitAt1: 0,
      hitAt3: 0,
      hitAt5: 0,
      hitAtK: 0,
      mrr: 0,
      emptyRate: 0,
      caseCount: 0,
      latencyMs: summarizeLatencies([]),
    };
  }

  const hitAt1Count = cases.filter((entry) => entry.hitAt1).length;
  const hitAt3Count = cases.filter((entry) => entry.hitAt3).length;
  const hitAt5Count = cases.filter((entry) => entry.hitAt5).length;
  const hitAtKCount = cases.filter((entry) => entry.hitAtK).length;
  const emptyCount = cases.filter((entry) => entry.resultCount === 0).length;
  const mrrSum = cases.reduce(
    (total, entry) => total + entry.reciprocalRank,
    0,
  );
  const count = cases.length;

  return {
    hitAt1: hitAt1Count / count,
    hitAt3: hitAt3Count / count,
    hitAt5: hitAt5Count / count,
    hitAtK: hitAtKCount / count,
    mrr: mrrSum / count,
    emptyRate: emptyCount / count,
    caseCount: count,
    latencyMs: summarizeLatencies(cases.map((entry) => entry.latencyMs)),
  };
}

export function groupSummaries(
  cases: EvalCaseResult[],
  k: number,
  selector: (entry: EvalCaseResult) => string | undefined,
): Record<string, MetricSummary> {
  const groups = new Map<string, EvalCaseResult[]>();

  for (const entry of cases) {
    const key = selector(entry)?.trim();
    if (!key) {
      continue;
    }

    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  }

  const summaries: Record<string, MetricSummary> = {};
  for (const [key, bucket] of groups.entries()) {
    summaries[key] = summarizeCaseResults(bucket, k);
  }

  return summaries;
}

export function matchesSectionHints(
  sectionTitle: string,
  hints: string[] | undefined,
): boolean {
  if (!hints || hints.length === 0) {
    return false;
  }

  const normalizedTitle = sectionTitle.toLowerCase();
  return hints.some((hint) => normalizedTitle.includes(hint.toLowerCase()));
}

export function matchesMustHaveTags(
  tags: string[],
  required: string[] | undefined,
): boolean {
  if (!required || required.length === 0) {
    return true;
  }

  const tagSet = new Set(tags);
  return required.every((tag) => tagSet.has(tag));
}

export function normalizeEvalK(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 10;
  }

  const rounded = Math.floor(value);
  if (rounded < 3) {
    return 3;
  }

  if (rounded > 50) {
    return 50;
  }

  return rounded;
}
