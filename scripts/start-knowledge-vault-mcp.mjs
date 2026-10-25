#!/usr/bin/env node
/**
 * Portable knowledge-vault MCP launcher for Cursor / CLI.
 * Resolves paths from the repository root (parent of scripts/).
 *
 * Env (optional; `.env` overrides the shell for vault path keys):
 *   KNOWLEDGE_VAULT_DB_PATH — SQLite index path (default: <repo>/.knowledge-vault/index.sqlite)
 *   KNOWLEDGE_VAULT_DIR     — Markdown vault root (default: <repo>/examples/vault)
 *
 * Local overrides: copy `.env.example` → `.env` (gitignored).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

loadDotEnv(join(repoRoot, ".env"));

const dbPath = resolve(
  process.env.KNOWLEDGE_VAULT_DB_PATH ??
    join(repoRoot, ".knowledge-vault", "index.sqlite"),
);
const vaultDir = resolve(
  process.env.KNOWLEDGE_VAULT_DIR ?? join(repoRoot, "examples", "vault"),
);
const indexerCli = join(
  repoRoot,
  "packages",
  "knowledge-vault-indexer",
  "dist",
  "cli.js",
);
const mcpCli = join(
  repoRoot,
  "packages",
  "knowledge-vault-mcp",
  "dist",
  "cli.js",
);

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    );
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (
      key === "KNOWLEDGE_VAULT_DIR" ||
      key === "KNOWLEDGE_VAULT_DB_PATH" ||
      process.env[key] === undefined
    ) {
      process.env[key] = value;
    }
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(dirname(dbPath), { recursive: true });

if (!existsSync(indexerCli)) {
  process.stderr.write(
    "[start-knowledge-vault-mcp] Building @knowledge-vault/indexer…\n",
  );
  run("pnpm", ["-C", "packages/knowledge-vault-indexer", "build"]);
}

if (!existsSync(mcpCli)) {
  process.stderr.write(
    "[start-knowledge-vault-mcp] Building @knowledge-vault/mcp…\n",
  );
  run("pnpm", ["-C", "packages/knowledge-vault-mcp", "build"]);
}

if (!existsSync(dbPath)) {
  process.stderr.write(
    `[start-knowledge-vault-mcp] No index at ${dbPath}; indexing vault ${vaultDir}…\n`,
  );
  run("pnpm", [
    "-C",
    "packages/knowledge-vault-indexer",
    "reindex",
    "--",
    "--vault",
    vaultDir,
    "--db",
    dbPath,
    "--json",
  ]);
}

process.stderr.write(
  `[start-knowledge-vault-mcp] db=${dbPath} vault=${vaultDir}\n`,
);

// Run MCP in this process — Cursor's MCP IPC expects the spawned process to own stdio.
process.env.KNOWLEDGE_VAULT_DIR = vaultDir;
process.env.KNOWLEDGE_VAULT_DB_PATH = dbPath;

await import(pathToFileURL(mcpCli).href);
