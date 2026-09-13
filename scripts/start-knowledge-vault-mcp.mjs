#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vaultDir = resolve(process.env.KNOWLEDGE_VAULT_DIR ?? join(repoRoot, 'examples', 'vault'));
const dbPath = resolve(
  process.env.KNOWLEDGE_VAULT_DB_PATH ?? join(repoRoot, '.knowledge-vault', 'index.sqlite'),
);
const indexerCli = join(repoRoot, 'packages', 'knowledge-vault-indexer', 'dist', 'cli.js');
const mcpCli = join(repoRoot, 'packages', 'knowledge-vault-mcp', 'dist', 'cli.js');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

mkdirSync(dirname(dbPath), { recursive: true });

if (!existsSync(indexerCli) || !existsSync(mcpCli)) {
  run('pnpm', ['build']);
}

if (!existsSync(dbPath)) {
  run('pnpm', [
    '-C',
    'packages/knowledge-vault-indexer',
    'reindex',
    '--',
    '--vault',
    vaultDir,
    '--db',
    dbPath,
    '--json',
  ]);
}

process.env.KNOWLEDGE_VAULT_DIR = vaultDir;
process.env.KNOWLEDGE_VAULT_DB_PATH = dbPath;
await import(mcpCli);
