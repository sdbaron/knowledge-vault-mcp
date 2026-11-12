# Package boundaries

These rules are normative. The same graph is encoded in [../../architecture/package-boundaries.json](../../architecture/package-boundaries.json).

## Allowed dependency graph

```
contract
   ▲
   │
indexer
   ▲
   │
  mcp
```

| Package | May depend on | Must not depend on |
| --- | --- | --- |
| contract | nothing in this monorepo | indexer, mcp |
| indexer | contract | mcp |
| mcp | indexer (contract only transitively via indexer public API) | — |

## Import rules

1. Cross-package imports use the published package name (`@sdbaron/knowledge-vault-*`), never a relative path into another package’s `src/`.
2. Only symbols listed in [../../architecture/public-apis.json](../../architecture/public-apis.json) are part of the supported surface. Prefer importing from the package root (`"."`).
3. `"./package.json"` is exported so consumers can `require.resolve("@sdbaron/.../package.json")`. Do not remove that export.
4. Tests may map package names to source via Jest `moduleNameMapper` / TypeScript `paths` for the workspace build; production code must still compile against package entrypoints.

## Responsibility splits

### contract

Allowed: frontmatter TypeScript types and `validateVaultFrontmatter`.

Forbidden: filesystem I/O, SQLite, MCP protocol, retrieval, CLI.

### indexer

Allowed: vault discovery, YAML/Markdown parse, section chunking, content hashing, SQLite schema and upserts, reindex CLI.

Forbidden: MCP framing, JSON-RPC, IDE tool schemas, search scoring for agents.

### mcp

Allowed: stdio NDJSON/JSON-RPC, tool definitions (`vault_*`), reading the SQLite index for search/get/backlinks, calling `runFullReindex` for `vault_reindex`, eval runner.

Forbidden: reimplementing frontmatter validation or Markdown parsing that belongs in contract/indexer; deep imports into indexer internals.

### consumers (outside this repo)

Allowed: depend on published versions from GitHub Packages.

Forbidden: vendoring copies of these packages, or treating private source paths as an API.
