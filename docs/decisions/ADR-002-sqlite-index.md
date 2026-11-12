# ADR-002: SQLite index via `node:sqlite`

## Status

Accepted

## Context

The vault must support local, offline retrieval for IDE agents. External search services or heavy embedding stores add auth, network, and packaging cost for a Markdown-first workflow.

## Decision

- Persist the index in a local SQLite file (default `.knowledge-vault/index.sqlite`).
- Use Node.js built-in `node:sqlite` (`DatabaseSync`), which requires Node 22+.
- Own schema creation and migrations in `@sdbaron/knowledge-vault-indexer`.
- Let MCP open the same database read/write as needed for tools and reindex.

## Consequences

- Engines field and CI must stay on Node 22+.
- No separate SQLite native addon in published packages.
- Consumers must point `KNOWLEDGE_VAULT_DB_PATH` (or equivalent) at a writable path.
