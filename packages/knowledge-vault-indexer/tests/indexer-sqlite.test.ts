import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

import { isNodeSqliteAvailable } from "../src/sqliteStore.js";

const describeWithSqlite = isNodeSqliteAvailable() ? describe : describe.skip;

describeWithSqlite("runFullReindex with sqlite", () => {
  it("arbeitet idempotent ueber den Datei-Hash", async () => {
    const { runFullReindex } = await import("../src/indexer.js");
    const { SqliteWikiStore } = await import("../src/sqliteStore.js");

    const rootDir = await mkdtemp(join(tmpdir(), "wiki-indexer-"));
    const vaultDir = join(rootDir, "vault");
    const dbPath = join(rootDir, "index", "wiki-index.sqlite");
    const notePath = join(vaultDir, "note.md");

    try {
      await mkdir(vaultDir, { recursive: true });

      await writeFile(
        notePath,
        [
          "---",
          "title: Erste Notiz",
          "tags: [wiki, phase1]",
          "domain: operations",
          "owner: team-ocr",
          "updated_at: 2026-05-05",
          "aliases: [Erste]",
          "---",
          "# Intro",
          "Dies ist eine Notiz mit [[Verweis]].",
        ].join("\n"),
        "utf8",
      );

      const first = await runFullReindex({
        vaultDir,
        dbPath,
        pruneMissing: true,
      });
      expect(first.errorCount).toBe(0);
      expect(first.scannedNotes).toBe(1);
      expect(first.indexedNotes).toBe(1);
      expect(first.skippedNotes).toBe(0);

      const second = await runFullReindex({
        vaultDir,
        dbPath,
        pruneMissing: true,
      });
      expect(second.errorCount).toBe(0);
      expect(second.indexedNotes).toBe(0);
      expect(second.skippedNotes).toBe(1);

      await writeFile(
        notePath,
        [
          "---",
          "title: Erste Notiz",
          "tags: [wiki, phase1]",
          "domain: operations",
          "owner: team-ocr",
          "updated_at: 2026-05-06",
          "aliases: [Erste]",
          "---",
          "# Intro",
          "Dies ist eine geaenderte Notiz mit [[Verweis]].",
        ].join("\n"),
        "utf8",
      );

      const third = await runFullReindex({
        vaultDir,
        dbPath,
        pruneMissing: true,
      });
      expect(third.errorCount).toBe(0);
      expect(third.indexedNotes).toBe(1);

      const store = new SqliteWikiStore(dbPath);
      const counts = store.getCounts();
      store.close();

      expect(counts.noteCount).toBe(1);
      expect(counts.chunkCount).toBeGreaterThan(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("erzwingt Neu-Indexierung aller Notizen bei forceReindex: true", async () => {
    const { runFullReindex } = await import("../src/indexer.js");

    const rootDir = await mkdtemp(join(tmpdir(), "wiki-indexer-force-"));
    const vaultDir = join(rootDir, "vault");
    const dbPath = join(rootDir, "index", "wiki-index.sqlite");

    try {
      await mkdir(vaultDir, { recursive: true });

      await writeFile(
        join(vaultDir, "note.md"),
        [
          "---",
          "title: Force Test",
          "tags: [wiki, phase3]",
          "domain: qa",
          "owner: team-ocr",
          "updated_at: 2026-05-05",
          "aliases: [ForceTest]",
          "---",
          "# Intro",
          "Inhalt fuer Force-Reindex-Test.",
        ].join("\n"),
        "utf8",
      );

      const first = await runFullReindex({
        vaultDir,
        dbPath,
        pruneMissing: true,
      });
      expect(first.indexedNotes).toBe(1);
      expect(first.skippedNotes).toBe(0);

      // Zweiter Lauf ohne forceReindex: Notiz wird uebersprungen
      const second = await runFullReindex({
        vaultDir,
        dbPath,
        pruneMissing: true,
      });
      expect(second.indexedNotes).toBe(0);
      expect(second.skippedNotes).toBe(1);

      // Dritter Lauf mit forceReindex: true – Notiz wird neu indexiert trotz identischem Hash
      const third = await runFullReindex({
        vaultDir,
        dbPath,
        pruneMissing: true,
        forceReindex: true,
      });
      expect(third.indexedNotes).toBe(1);
      expect(third.skippedNotes).toBe(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
