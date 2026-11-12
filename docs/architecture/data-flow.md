# Data flow

## Indexing

1. `findMarkdownFiles(vaultDir)` walks the vault for `.md` files.
2. Each file is `parseWikiNote`’d: YAML frontmatter → `validateVaultFrontmatter` (contract) plus indexer-local checks (non-empty `tags`, `updated_at` as `YYYY-MM-DD`).
3. Body sections become `ChunkRecord`s via `buildChunks`.
4. `SqliteWikiStore` upserts `notes` and `chunks`. Unchanged content hashes are skipped unless `forceReindex` is set.
5. Optional prune removes notes that disappeared from the vault.
6. An `index_runs` row records the summary.

Env / CLI defaults in this repo:

- Vault: `KNOWLEDGE_VAULT_DIR` (default `examples/vault` for the launcher)
- Database: `KNOWLEDGE_VAULT_DB_PATH` (default `.knowledge-vault/index.sqlite`)

## Serving

1. `scripts/start-knowledge-vault-mcp.mjs` or `knowledge-vault-mcp` starts the MCP stdio server.
2. Clients speak newline-delimited JSON-RPC (MCP transport). Content-Length frames are accepted inbound; responses are NDJSON.
3. Tools call `VaultRepository` against the SQLite file, or `runFullReindex` for `vault_reindex`.
4. Structured tool results are returned as MCP `content` + `structuredContent`. Observability lines go to stderr as JSON.

## Eval

`knowledge-vault-eval` / `pnpm -C packages/knowledge-vault-mcp eval` loads cases (for example `examples/eval/cases.json`), optionally reindexes, runs `VaultRepository.search`, and writes Hit@k / MRR reports. Eval is a consumer of the same search path as MCP tools.
