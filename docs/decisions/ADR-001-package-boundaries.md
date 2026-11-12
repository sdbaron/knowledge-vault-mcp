# ADR-001: Package boundaries

## Status

Accepted

## Context

The vault stack was extracted from Tagesberichte so producers and consumers can share one implementation. Without hard package splits, MCP protocol code and Markdown parsing tend to tangle, and consumers start depending on private source paths.

## Decision

Split the monorepo into three publishable packages under `@sdbaron/*`:

1. **contract** — frontmatter types and validation only.
2. **indexer** — parse, chunk, SQLite index.
3. **mcp** — MCP server, tools, retrieval over the index, eval CLI.

Dependencies flow upward only: mcp → indexer → contract. Cross-package imports use package names and public entrypoints.

## Consequences

- Shared frontmatter rules can be reused by producers without pulling SQLite or MCP.
- Retrieval changes do not force contract version bumps.
- Violating boundaries (for example MCP importing indexer `src/parser.ts` by relative path) is considered a defect.
