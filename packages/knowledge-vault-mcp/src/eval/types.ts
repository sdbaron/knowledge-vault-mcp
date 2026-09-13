import type { SearchResultItem } from "../types.js";

export type EvalSuite = "examples" | "production-vault";

export interface EvalCaseFilters {
  domain?: string;
  owner?: string;
  tags?: string[];
}

export interface EvalCase {
  id: string;
  suite: EvalSuite;
  query: string;
  language: string;
  expectedNotePaths: string[];
  expectedSectionHints?: string[];
  mustHaveTags?: string[];
  filters?: EvalCaseFilters | null;
  difficulty?: string;
  queryType?: string;
  notes?: string;
}

export interface EvalRunOptions {
  casesPath: string;
  dbPath: string;
  vaultDir: string;
  suite?: EvalSuite | "all";
  k?: number;
  reindex?: boolean;
  label?: string;
  failOnEmptyDb?: boolean;
}

export interface LatencySummary {
  p50: number;
  p95: number;
  mean: number;
  min: number;
  max: number;
}

export interface MetricSummary {
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  hitAtK: number;
  mrr: number;
  emptyRate: number;
  caseCount: number;
  latencyMs: LatencySummary;
}

export interface EvalCaseResult {
  id: string;
  suite: EvalSuite;
  query: string;
  language?: string;
  difficulty?: string;
  queryType?: string;
  hitAt1: boolean;
  hitAt3: boolean;
  hitAt5: boolean;
  hitAtK: boolean;
  reciprocalRank: number;
  latencyMs: number;
  resultCount: number;
  rankedNotePaths: string[];
  firstHitRank: number | null;
  sectionHintMatched: boolean;
  mustHaveTagsMatched: boolean;
  expectedNotePaths: string[];
  notes?: string;
}

export interface EvalReportMeta {
  label: string;
  algorithm: string;
  timestamp: string;
  casesPath: string;
  suite: EvalSuite | "all";
  k: number;
  dbPath: string;
  vaultDir: string;
  reindexed: boolean;
  caseCount: number;
}

export interface EvalReport {
  meta: EvalReportMeta;
  summary: MetricSummary;
  summaryBySuite: Record<string, MetricSummary>;
  summaryByQueryType: Record<string, MetricSummary>;
  summaryByDifficulty: Record<string, MetricSummary>;
  summaryByLanguage: Record<string, MetricSummary>;
  cases: EvalCaseResult[];
  warnings: string[];
}

export type { SearchResultItem };
