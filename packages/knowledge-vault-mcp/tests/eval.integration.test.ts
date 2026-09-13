import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@jest/globals";

import { runEval } from "../src/eval/runEval.js";
import { isNodeSqliteAvailable } from "../src/sqliteRuntime.js";

const describeWithSqlite = isNodeSqliteAvailable() ? describe : describe.skip;

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const examplesVault = join(repoRoot, "examples/vault");
const casesPath = join(repoRoot, "examples/eval/cases.json");

describeWithSqlite("wiki eval integration", () => {
  it("runs the examples suite against the example vault", async () => {
    const root = await mkdtemp(join(tmpdir(), "wiki-eval-int-"));
    const dbPath = join(root, "wiki-index.sqlite");

    try {
      const report = await runEval({
        casesPath,
        dbPath,
        vaultDir: examplesVault,
        suite: "examples",
        k: 10,
        reindex: true,
        label: "naive-test",
      });

      expect(report.meta.caseCount).toBe(12);
      expect(report.summary.caseCount).toBe(12);
      expect(
        report.cases.every((entry) => typeof entry.latencyMs === "number"),
      ).toBe(true);
      expect(
        report.cases.every((entry) => entry.rankedNotePaths.length <= 10),
      ).toBe(true);

      const ex07 = report.cases.find((entry) => entry.id === "EX-07");
      expect(ex07).toBeDefined();
      expect(ex07?.hitAt1).toBe(true);

      const ex01 = report.cases.find((entry) => entry.id === "EX-01");
      expect(ex01).toBeDefined();
      expect(ex01?.hitAt3).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
