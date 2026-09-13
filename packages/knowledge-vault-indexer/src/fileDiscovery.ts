import { readdir } from "node:fs/promises";
import { join } from "node:path";

const IGNORED_DIRECTORIES = new Set([".git", ".obsidian", "node_modules"]);

export async function findMarkdownFiles(vaultDir: string): Promise<string[]> {
  const results: string[] = [];

  await walkDirectory(vaultDir, results);

  results.sort((left, right) => left.localeCompare(right));
  return results;
}

async function walkDirectory(
  directory: string,
  results: string[],
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await walkDirectory(fullPath, results);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    results.push(fullPath);
  }
}
