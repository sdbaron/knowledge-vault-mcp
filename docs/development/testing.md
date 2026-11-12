# Testing

## Commands

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
```

Workspace tests run per package via Jest ESM (`node --experimental-vm-modules`).

## What each package covers

| Package | Typical tests |
| --- | --- |
| contract | Frontmatter validation; pack/export resolve for `package.json` |
| indexer | Parser, chunker, SQLite reindex (gated on `node:sqlite`) |
| mcp | Tool metadata, NDJSON framing, server integration, eval unit/integration |

SQLite-backed tests skip or guard when `isNodeSqliteAvailable()` is false. CI runs on Node 22 so they should execute.

## Smoke scripts

After a local index exists:

```bash
node scripts/verify-knowledge-vault-mcp.mjs
```

This exercises initialize, `tools/list`, and `vault_search` over NDJSON.
