#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcher = join(repoRoot, 'scripts', 'start-knowledge-vault-mcp.mjs');
const dbPath = resolve(repoRoot, '.knowledge-vault', 'index.sqlite');

if (!existsSync(dbPath)) {
  console.error(`[verify-knowledge-vault-mcp] missing index: ${dbPath}`);
  process.exit(1);
}

const proc = spawn(process.execPath, [launcher], { cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'] });
let output = '';
proc.stdout.on('data', chunk => {
  output += chunk;
});

const message = value => `${JSON.stringify(value)}\n`;
proc.stdin.write(message({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
proc.stdin.write(message({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
proc.stdin.write(
  message({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'vault_search', arguments: { query: 'incident', k: 1 } },
  }),
);

await new Promise(resolveDone => setTimeout(resolveDone, 1000));
proc.kill();

const messages = output
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line));
const toolNames = messages.find(item => item.id === 2)?.result?.tools?.map(tool => tool.name) ?? [];

if (!toolNames.includes('vault_search') || !messages.find(item => item.id === 3)?.result) {
  console.error('[verify-knowledge-vault-mcp] FAIL');
  process.exit(1);
}

console.log('[verify-knowledge-vault-mcp] OK');
