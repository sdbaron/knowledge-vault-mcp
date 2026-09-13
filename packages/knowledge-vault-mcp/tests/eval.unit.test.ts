import { describe, expect, it } from "@jest/globals";

import { loadCases } from "../src/eval/loadCases.js";
import {
  groupSummaries,
  hitAtRank,
  matchesMustHaveTags,
  matchesSectionHints,
  normalizeEvalK,
  percentile,
  reciprocalRank,
  summarizeCaseResults,
  uniqueNotePaths,
} from "../src/eval/metrics.js";
import type { EvalCaseResult } from "../src/eval/types.js";
import type { SearchResultItem } from "../src/types.js";

function makeResult(
  notePath: string,
  sectionTitle = "Section",
): SearchResultItem {
  return {
    notePath,
    sectionTitle,
    snippet: "snippet",
    score: 1,
    updatedAt: "2026-01-01",
    tags: ["adr"],
    startLine: 1,
  };
}

describe("eval metrics", () => {
  it("dedupes note paths while preserving rank order", () => {
    const results = [
      makeResult("a.md"),
      makeResult("a.md"),
      makeResult("b.md"),
      makeResult("c.md"),
    ];

    expect(uniqueNotePaths(results)).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("computes Hit@1 / Hit@3 and MRR with OR expected paths", () => {
    const ranked = ["wrong.md", "expected.md", "other.md"];
    expect(hitAtRank(ranked, ["expected.md"], 1)).toBe(false);
    expect(hitAtRank(ranked, ["expected.md"], 3)).toBe(true);

    const rr = reciprocalRank(ranked, ["expected.md"], 10);
    expect(rr.firstHitRank).toBe(2);
    expect(rr.value).toBeCloseTo(0.5);
  });

  it("returns reciprocal rank 0 when there is no hit in top-k", () => {
    const rr = reciprocalRank(["x.md", "y.md"], ["expected.md"], 2);
    expect(rr.value).toBe(0);
    expect(rr.firstHitRank).toBeNull();
  });

  it("computes percentiles for latency aggregation", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
  });

  it("summarizes case results into metric summary", () => {
    const cases: EvalCaseResult[] = [
      {
        id: "A",
        suite: "examples",
        query: "q1",
        hitAt1: true,
        hitAt3: true,
        hitAt5: true,
        hitAtK: true,
        reciprocalRank: 1,
        latencyMs: 10,
        resultCount: 2,
        rankedNotePaths: ["a.md"],
        firstHitRank: 1,
        sectionHintMatched: false,
        mustHaveTagsMatched: true,
        expectedNotePaths: ["a.md"],
      },
      {
        id: "B",
        suite: "examples",
        query: "q2",
        hitAt1: false,
        hitAt3: true,
        hitAt5: true,
        hitAtK: true,
        reciprocalRank: 0.5,
        latencyMs: 30,
        resultCount: 3,
        rankedNotePaths: ["x.md", "b.md"],
        firstHitRank: 2,
        sectionHintMatched: true,
        mustHaveTagsMatched: false,
        expectedNotePaths: ["b.md"],
      },
    ];

    const summary = summarizeCaseResults(cases, 10);
    expect(summary.caseCount).toBe(2);
    expect(summary.hitAt1).toBeCloseTo(0.5);
    expect(summary.hitAt3).toBeCloseTo(1);
    expect(summary.mrr).toBeCloseTo(0.75);
    expect(summary.latencyMs.p50).toBe(10);
  });

  it("groups summaries by query type", () => {
    const cases: EvalCaseResult[] = [
      {
        id: "A",
        suite: "examples",
        query: "q1",
        queryType: "howto",
        hitAt1: true,
        hitAt3: true,
        hitAt5: true,
        hitAtK: true,
        reciprocalRank: 1,
        latencyMs: 5,
        resultCount: 1,
        rankedNotePaths: ["a.md"],
        firstHitRank: 1,
        sectionHintMatched: false,
        mustHaveTagsMatched: true,
        expectedNotePaths: ["a.md"],
      },
    ];

    const grouped = groupSummaries(cases, 10, (entry) => entry.queryType);
    expect(grouped.howto?.caseCount).toBe(1);
    expect(grouped.howto?.hitAt1).toBe(1);
  });

  it("matches section hints and required tags as soft signals", () => {
    expect(
      matchesSectionHints("Entscheidung / Kontext", ["Entscheidung"]),
    ).toBe(true);
    expect(matchesMustHaveTags(["adr", "process"], ["adr"])).toBe(true);
    expect(matchesMustHaveTags(["process"], ["adr"])).toBe(false);
  });

  it("normalizes eval k within repository bounds", () => {
    expect(normalizeEvalK(undefined)).toBe(10);
    expect(normalizeEvalK(2)).toBe(3);
    expect(normalizeEvalK(100)).toBe(50);
  });
});

describe("loadCases", () => {
  it("rejects duplicate ids", async () => {
    await expect(
      loadCasesFromArray([
        {
          id: "EX-01",
          suite: "examples",
          query: "q",
          language: "de",
          expectedNotePaths: ["a.md"],
        },
        {
          id: "EX-01",
          suite: "examples",
          query: "q2",
          language: "de",
          expectedNotePaths: ["b.md"],
        },
      ]),
    ).rejects.toThrow(/Doppelte Case-ID/);
  });

  it("rejects empty expected paths", async () => {
    await expect(
      loadCasesFromArray([
        {
          id: "EX-02",
          suite: "examples",
          query: "q",
          language: "de",
          expectedNotePaths: [],
        },
      ]),
    ).rejects.toThrow(/expectedNotePaths/);
  });
});

async function loadCasesFromArray(entries: unknown[]): Promise<unknown> {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const root = await mkdtemp(join(tmpdir(), "wiki-eval-cases-"));
  const filePath = join(root, "cases.json");

  await writeFile(filePath, JSON.stringify(entries), "utf8");
  try {
    return await loadCases(filePath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
