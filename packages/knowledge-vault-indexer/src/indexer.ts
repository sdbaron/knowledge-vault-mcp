import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { buildChunks } from "./chunker.js";
import { findMarkdownFiles } from "./fileDiscovery.js";
import { parseWikiNote } from "./parser.js";
import { SqliteWikiStore } from "./sqliteStore.js";
import type { IndexError, IndexRunSummary, ReindexOptions } from "./types.js";

export async function runFullReindex(
  options: ReindexOptions,
): Promise<IndexRunSummary> {
  const startedAt = new Date().toISOString();
  const resolvedVaultDir = resolve(options.vaultDir);
  const resolvedDbPath = resolve(options.dbPath);
  const pruneMissing = options.pruneMissing ?? true;

  const store = new SqliteWikiStore(resolvedDbPath);
  const errors: IndexError[] = [];
  const seenPaths = new Set<string>();

  let scannedNotes = 0;
  let indexedNotes = 0;
  let skippedNotes = 0;
  let removedNotes = 0;
  let chunkCount = 0;

  try {
    const markdownFiles = await findMarkdownFiles(resolvedVaultDir);

    for (const absolutePath of markdownFiles) {
      scannedNotes += 1;
      const relativePath = normalizePath(
        relative(resolvedVaultDir, absolutePath),
      );
      seenPaths.add(relativePath);

      try {
        const content = await readFile(absolutePath, "utf8");
        const parsed = parseWikiNote({
          absolutePath,
          relativePath,
          content,
        });

        if (parsed.errors.length > 0) {
          errors.push({
            path: relativePath,
            message: parsed.errors.join("; "),
          });
          continue;
        }

        const existingHash = store.getNoteHash(parsed.relativePath);
        if (!options.forceReindex && existingHash === parsed.contentHash) {
          skippedNotes += 1;
          continue;
        }

        const chunks = buildChunks(parsed);
        store.upsertNoteAndChunks(
          parsed.relativePath,
          parsed.frontmatter,
          parsed.contentHash,
          chunks,
        );

        indexedNotes += 1;
        chunkCount += chunks.length;
      } catch (error) {
        errors.push({
          path: relativePath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (pruneMissing) {
      removedNotes = store.removeNotesNotIn(seenPaths);
    }

    const summary: IndexRunSummary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      dbPath: resolvedDbPath,
      scannedNotes,
      indexedNotes,
      skippedNotes,
      removedNotes,
      chunkCount,
      errorCount: errors.length,
      errors,
    };

    store.saveRunSummary(summary);
    return summary;
  } finally {
    store.close();
  }
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
