# Agent Instructions

Before modifying code:

1. Read [docs/architecture/overview.md](docs/architecture/overview.md).
2. Read [docs/architecture/package-boundaries.md](docs/architecture/package-boundaries.md).
3. Read the relevant ADRs under [docs/decisions/](docs/decisions/).
4. Check the machine-readable rules in [architecture/package-boundaries.json](architecture/package-boundaries.json) and [architecture/public-apis.json](architecture/public-apis.json).

## Architecture constraints

- `contract` must not depend on indexer or MCP.
- `indexer` may depend on `contract` only.
- `MCP` may depend on `indexer` (and transitively `contract`).
- Packages must not import internal source files from other packages.
- Public APIs must be exported through package entrypoints (`"."` and `"./package.json"`).
- This repo indexes Markdown/Obsidian notes only. Do not add EPUB/PDF ingestion or OCR here.

## Definition of Done

All changes must:

- Respect the package boundaries above and the ADRs they change.
- Keep published package `exports`, `files`, and version pins consistent when releasing.
- Pass:

  ```bash
  pnpm build
  pnpm lint
  pnpm test
  ```

Further detail: [docs/development/definition-of-done.md](docs/development/definition-of-done.md), [docs/development/testing.md](docs/development/testing.md), [docs/development/release.md](docs/development/release.md).
