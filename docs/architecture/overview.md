# Architecture overview

Knowledge Vault MCP is a pnpm monorepo that indexes Markdown/Obsidian vaults into SQLite and exposes retrieval over MCP stdio.

## Packages

| Package | npm name | Responsibility |
| --- | --- | --- |
| contract | `@sdbaron/knowledge-vault-contract` | Portable frontmatter types and validation |
| indexer | `@sdbaron/knowledge-vault-indexer` | Discover Markdown, parse, chunk, write SQLite |
| mcp | `@sdbaron/knowledge-vault-mcp` | MCP JSON-RPC server, tools, retrieval, eval CLI |

Consumers (Tagesberichte, Cursor, Copilot) depend on the published packages. They do not live in this repository.

## Runtime shape

```
Markdown vault
    │
    ▼
@sdbaron/knowledge-vault-indexer  →  SQLite (.knowledge-vault/index.sqlite)
    │
    ▼
@sdbaron/knowledge-vault-mcp      →  stdio MCP (NDJSON)
    │
    ▼
IDE / agent client
```

## Hard product boundaries

- Node.js 22+ is required (`node:sqlite`).
- Index Markdown notes with YAML frontmatter. EPUB/PDF ingest and OCR belong in producers such as `ebook-ingest`, not here.
- Packages are published to GitHub Packages under `@sdbaron/*`.

## Where to look next

- Boundaries: [package-boundaries.md](package-boundaries.md)
- Index and query flow: [data-flow.md](data-flow.md)
- Search scoring and tools: [retrieval.md](retrieval.md)
- Decisions: [../decisions/](../decisions/)
