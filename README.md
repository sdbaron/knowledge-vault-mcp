# Knowledge Vault MCP

Portable local knowledge-base infrastructure for Markdown and Obsidian vaults.

Requires Node.js 22 or newer because the SQLite index uses the built-in `node:sqlite` module.

It contains three workspace packages:

- `@knowledge-vault/contract` — portable frontmatter contract and validation.
- `@knowledge-vault/indexer` — Markdown parsing, section chunking, and SQLite indexing.
- `@knowledge-vault/mcp` — stdio MCP server with search, note retrieval, backlinks, and reindexing.

The project deliberately does not ingest EPUB/PDF files or perform OCR. Producers such as
`ebook-ingest` write Markdown notes; consumers such as Tagesberichte, Cursor, and Copilot
use this project to index and retrieve those notes.

## Quick start

```bash
pnpm install
pnpm build
pnpm -C packages/knowledge-vault-indexer reindex -- --vault "$PWD/examples/vault" --db "$PWD/.knowledge-vault/index.sqlite"
KNOWLEDGE_VAULT_DIR=./examples/vault KNOWLEDGE_VAULT_DB_PATH=.knowledge-vault/index.sqlite pnpm -C packages/knowledge-vault-mcp start
```

`scripts/start-knowledge-vault-mcp.mjs` builds any missing package, indexes the vault when the SQLite file is absent, and loads `.env` (see `.env.example`). Path keys in that file override the shell. Stdio is newline-delimited JSON. `scripts/verify-knowledge-vault-mcp.mjs` smoke-tests initialize, `tools/list`, and `vault_search` against an existing index.

The MCP tools are `vault_search`, `vault_get_note`, `vault_backlinks`, and `vault_reindex`.

Phase B2 retrieval eval:

```bash
pnpm -C packages/knowledge-vault-mcp eval -- \
  --cases examples/eval/cases.json \
  --suite examples \
  --vault examples/vault \
  --db .knowledge-vault/index.sqlite \
  --reindex
```

## Compatibility

The contract requires `title`, `tags`, `domain`, `owner`, `updated_at`, and `aliases` in YAML
frontmatter. Extra fields, including source metadata emitted by ebook-ingest, are preserved.
