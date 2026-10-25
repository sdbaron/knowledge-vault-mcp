#!/usr/bin/env node
/**
 * Smoke-test knowledge-vault MCP stdio transport (MCP NDJSON lifecycle).
 * Exit 0 = ready for Cursor; exit 1 = failure.
 *
 * Requires an existing index (run scripts/start-knowledge-vault-mcp.mjs once,
 * or the indexer reindex command).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launcher = join(repoRoot, "scripts", "start-knowledge-vault-mcp.mjs");
const node = process.env.KNOWLEDGE_VAULT_MCP_NODE ?? process.execPath;
const dbPath = resolve(repoRoot, ".knowledge-vault", "index.sqlite");

if (!existsSync(dbPath)) {
  console.error(`[verify-knowledge-vault-mcp] missing index: ${dbPath}`);
  process.exit(1);
}

const ndjson = (obj) => `${JSON.stringify(obj)}\n`;
const env = { ...process.env };

function fail(message) {
  console.error(`[verify-knowledge-vault-mcp] FAIL: ${message}`);
  process.exit(1);
}

const proc = spawn(node, [launcher], {
  cwd: repoRoot,
  env,
  stdio: ["pipe", "pipe", "pipe"],
});

let out = "";
let err = "";
proc.stdout.on("data", (chunk) => {
  out += chunk;
});
proc.stderr.on("data", (chunk) => {
  err += chunk;
});

proc.stdin.write(
  ndjson({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "verify-knowledge-vault-mcp", version: "1.0.0" },
    },
  }),
);
proc.stdin.write(
  ndjson({ jsonrpc: "2.0", method: "notifications/initialized" }),
);
proc.stdin.write(
  ndjson({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
);
proc.stdin.write(
  ndjson({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "vault_search", arguments: { query: "incident", k: 1 } },
  }),
);

const done = new Promise((resolveDone) => {
  setTimeout(() => {
    proc.kill();
    resolveDone();
  }, 2000);
});

await done;

if (out.includes("Content-Length:")) {
  fail("stdout uses Content-Length framing; MCP spec requires NDJSON");
}

const lines = out.split("\n").filter(Boolean);
const messages = lines
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const init = messages.find((message) => message.id === 1);
const tools = messages.find((message) => message.id === 2);
const search = messages.find((message) => message.id === 3);

if (!init?.result?.serverInfo?.name) {
  fail(`initialize failed\nstderr:\n${err}`);
}

const toolNames = (tools?.result?.tools ?? []).map((tool) => tool.name);
const expected = [
  "vault_search",
  "vault_get_note",
  "vault_backlinks",
  "vault_reindex",
];
for (const name of expected) {
  if (!toolNames.includes(name)) {
    fail(`missing tool ${name}; got ${toolNames.join(", ")}`);
  }
}

const count = search?.result?.structuredContent?.count;
if (typeof count !== "number") {
  fail(`vault_search failed\nstderr:\n${err}\nstdout:\n${out}`);
}

console.log("[verify-knowledge-vault-mcp] OK");
console.log(
  `  server: ${init.result.serverInfo.name} @ ${init.result.protocolVersion}`,
);
console.log(`  tools: ${toolNames.join(", ")}`);
console.log(`  vault_search("incident"): ${count} hit(s)`);
if (err.trim()) {
  console.log(`  stderr: ${err.trim().split("\n")[0]}`);
}
