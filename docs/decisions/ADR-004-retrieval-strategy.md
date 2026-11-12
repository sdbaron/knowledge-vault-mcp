# ADR-004: Retrieval strategy

## Status

Accepted

## Context

Agents need search, note fetch, and backlinks over the vault. A first useful baseline should be deterministic, offline, and easy to evaluate (Hit@k / MRR) before adding embeddings.

## Decision

- Expose four MCP tools: `vault_search`, `vault_get_note`, `vault_backlinks`, `vault_reindex`.
- Implement search as naive lexical scoring over loaded chunks in `@sdbaron/knowledge-vault-mcp` (`VaultRepository`).
- Keep transport as MCP stdio with NDJSON responses.
- Ship an eval CLI against fixed case files to measure regressions.

Embedding search, FTS5, or hybrid ranking may replace the scorer later inside MCP (or a dedicated package) without changing the contract package.

## Consequences

- Search quality is limited to token overlap; that is intentional for v0.
- Eval cases under `examples/eval/` guard the baseline.
- Schema ownership stays with the indexer; MCP must not invent a second store.
