import { access } from "node:fs/promises";
import { join } from "node:path";

import { runFullReindex } from "@knowledge-vault/indexer";

import { VaultRepository } from "../repository.js";
import { createDatabaseConnection } from "../sqliteRuntime.js";
import { filterCasesBySuite, loadCases } from "./loadCases.js";
import {
  groupSummaries,
  hitAtRank,
  matchesMustHaveTags,
  matchesSectionHints,
  normalizeEvalK,
  reciprocalRank,
  summarizeCaseResults,
  uniqueNotePaths,
} from "./metrics.js";
import type {
  EvalCase,
  EvalCaseResult,
  EvalReport,
  EvalRunOptions,
  EvalSuite,
} from "./types.js";

export async function runEval(options: EvalRunOptions): Promise<EvalReport> {
  const k = normalizeEvalK(options.k);
  const suite = options.suite ?? "all";
  const label = options.label ?? "naive";
  const failOnEmptyDb = options.failOnEmptyDb ?? true;
  const warnings: string[] = [];

  if (options.reindex) {
    const summary = await runFullReindex({
      vaultDir: options.vaultDir,
      dbPath: options.dbPath,
      pruneMissing: true,
    });

    if (summary.errorCount > 0) {
      throw new Error(
        `Reindex fehlgeschlagen mit ${summary.errorCount} Fehler(n).`,
      );
    }
  }

  await assertDbAvailable(options.dbPath, failOnEmptyDb);

  const allCases = await loadCases(options.casesPath);
  const cases = filterCasesBySuite(allCases, suite);

  if (cases.length === 0) {
    throw new Error(`Keine Cases fuer suite="${suite}" gefunden.`);
  }

  if (suite === "all" && new Set(cases.map((entry) => entry.suite)).size > 1) {
    warnings.push(
      "suite=all mit gemischten Suites: alle Cases nutzen dieselbe DB/Vault — nur sinnvoll wenn Indizes uebereinstimmen.",
    );
  }

  await validateExpectedPaths(cases, options.vaultDir, warnings);

  const repository = new VaultRepository(options.dbPath);
  const caseResults: EvalCaseResult[] = [];

  for (const evalCase of cases) {
    caseResults.push(runSingleCase(repository, evalCase, k));
  }

  return {
    meta: {
      label,
      algorithm: "VaultRepository.search",
      timestamp: new Date().toISOString(),
      casesPath: options.casesPath,
      suite,
      k,
      dbPath: options.dbPath,
      vaultDir: options.vaultDir,
      reindexed: options.reindex ?? false,
      caseCount: caseResults.length,
    },
    summary: summarizeCaseResults(caseResults, k),
    summaryBySuite: groupSummaries(caseResults, k, (entry) => entry.suite),
    summaryByQueryType: groupSummaries(
      caseResults,
      k,
      (entry) => entry.queryType,
    ),
    summaryByDifficulty: groupSummaries(
      caseResults,
      k,
      (entry) => entry.difficulty,
    ),
    summaryByLanguage: groupSummaries(
      caseResults,
      k,
      (entry) => entry.language,
    ),
    cases: caseResults,
    warnings,
  };
}

function runSingleCase(
  repository: VaultRepository,
  evalCase: EvalCase,
  k: number,
): EvalCaseResult {
  const started = performance.now();
  const results = repository.search({
    query: evalCase.query,
    k,
    filters: evalCase.filters ?? undefined,
  });
  const latencyMs = performance.now() - started;

  const rankedNotePaths = uniqueNotePaths(results);
  const { value: reciprocalRankValue, firstHitRank } = reciprocalRank(
    rankedNotePaths,
    evalCase.expectedNotePaths,
    k,
  );

  const topResult = results[0];

  return {
    id: evalCase.id,
    suite: evalCase.suite,
    query: evalCase.query,
    language: evalCase.language,
    difficulty: evalCase.difficulty,
    queryType: evalCase.queryType,
    hitAt1: hitAtRank(rankedNotePaths, evalCase.expectedNotePaths, 1),
    hitAt3: hitAtRank(rankedNotePaths, evalCase.expectedNotePaths, 3),
    hitAt5: hitAtRank(rankedNotePaths, evalCase.expectedNotePaths, 5),
    hitAtK: hitAtRank(rankedNotePaths, evalCase.expectedNotePaths, k),
    reciprocalRank: reciprocalRankValue,
    latencyMs,
    resultCount: results.length,
    rankedNotePaths,
    firstHitRank,
    sectionHintMatched: topResult
      ? matchesSectionHints(
          topResult.sectionTitle,
          evalCase.expectedSectionHints,
        )
      : false,
    mustHaveTagsMatched: topResult
      ? matchesMustHaveTags(topResult.tags, evalCase.mustHaveTags)
      : evalCase.mustHaveTags === undefined ||
        evalCase.mustHaveTags.length === 0,
    expectedNotePaths: evalCase.expectedNotePaths,
    notes: evalCase.notes,
  };
}

async function assertDbAvailable(
  dbPath: string,
  failOnEmptyDb: boolean,
): Promise<void> {
  try {
    await access(dbPath);
  } catch {
    throw new Error(`DB-Datei nicht gefunden: ${dbPath}`);
  }

  if (!failOnEmptyDb) {
    return;
  }

  const database = createDatabaseConnection(dbPath);

  try {
    const row = database
      .prepare("SELECT COUNT(*) AS count FROM notes")
      .get<{ count: number }>();
    const count = row?.count ?? 0;
    if (count === 0) {
      throw new Error(`DB enthaelt keine Notizen: ${dbPath}`);
    }
  } finally {
    database.close();
  }
}

async function validateExpectedPaths(
  cases: EvalCase[],
  vaultDir: string,
  warnings: string[],
): Promise<void> {
  for (const evalCase of cases) {
    for (const notePath of evalCase.expectedNotePaths) {
      const absolutePath = join(vaultDir, notePath);
      try {
        await access(absolutePath);
      } catch {
        warnings.push(
          `Case ${evalCase.id}: erwarteter Pfad fehlt im Vault (${notePath}).`,
        );
      }
    }
  }
}

export function parseSuite(
  value: string | null,
): EvalSuite | "all" | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "all") {
    return "all";
  }

  if (value === "examples" || value === "production-vault") {
    return value;
  }

  throw new Error(`Unbekannte suite: ${value}`);
}
