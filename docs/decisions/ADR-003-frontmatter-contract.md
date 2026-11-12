# ADR-003: Frontmatter contract

## Status

Accepted

## Context

Indexed notes come from Obsidian vaults and producers such as ebook-ingest. Without a shared minimum frontmatter shape, indexing errors and search filters become inconsistent across tools.

## Decision

`@sdbaron/knowledge-vault-contract` defines `VaultFrontmatter` and `validateVaultFrontmatter` requiring:

- `title` (non-empty string)
- `tags` (array)
- `domain` (non-empty string)
- `owner` (non-empty string)
- `updated_at` (non-empty string)
- `aliases` (array)

Extra YAML fields are preserved (`[key: string]: unknown`). The indexer may add stricter local checks (for example non-empty `tags`, `updated_at` as `YYYY-MM-DD`) without removing the portable contract package.

## Consequences

- Producers can validate notes without depending on indexer or MCP.
- Contract stays free of I/O.
- Breaking frontmatter field renames need a coordinated version bump across packages.
