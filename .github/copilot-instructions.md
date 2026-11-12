# Copilot instructions

This repository is the portable Knowledge Vault monorepo (`@sdbaron/knowledge-vault-*`).

Before changing code, follow [AGENTS.md](../AGENTS.md):

1. Read `docs/architecture/overview.md` and `docs/architecture/package-boundaries.md`.
2. Obey `architecture/package-boundaries.json` and `architecture/public-apis.json`.
3. Do not add EPUB/PDF ingest or OCR here.
4. Run `pnpm build`, `pnpm lint`, and `pnpm test` before considering work done.

Dependency direction: mcp → indexer → contract. Cross-package imports must use package names, not other packages’ `src/` trees.
