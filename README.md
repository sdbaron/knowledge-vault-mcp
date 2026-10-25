# Knowledge Vault MCP

Portable local knowledge-base infrastructure for Markdown and Obsidian vaults.

Requires Node.js 22 or newer because the SQLite index uses the built-in `node:sqlite` module.

It contains three workspace packages, published to GitHub Packages as:

- `@sdbaron/knowledge-vault-contract` — portable frontmatter contract and validation.
- `@sdbaron/knowledge-vault-indexer` — Markdown parsing, section chunking, and SQLite indexing.
- `@sdbaron/knowledge-vault-mcp` — stdio MCP server with search, note retrieval, backlinks, and reindexing.

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

## Consuming the packages

Packages are published to `https://npm.pkg.github.com` under the `sdbaron` owner. The scope has to match that owner, which is why the names are `@sdbaron/*` and not `@knowledge-vault/*`.

Inside this repo, dependencies stay `workspace:*`. `pnpm publish` rewrites that protocol when it packs: `workspace:*` becomes the dependency's exact version (`0.1.0`), and `workspace:^` would become `^0.1.0`. Publishing is in dependency order (contract, then indexer, then mcp), so the rewritten ranges exist on the registry before a dependent is published.

A release is a git tag `vX.Y.Z` whose version matches `version` in all three package manifests (the leading `v` is stripped). Pushing that tag runs `.github/workflows/release.yml`, which installs, checks the version, builds, tests, and publishes with `GITHUB_TOKEN` (`packages: write`). Do not publish by hand from a laptop unless you intend to.

### Registry auth

In the consuming project (for example SergeyLC/Tagesberichte), add an `.npmrc`:

```
@sdbaron:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

`NODE_AUTH_TOKEN` is a token that can read these packages. Depend on the packages as normal versions:

```json
{
  "dependencies": {
    "@sdbaron/knowledge-vault-mcp": "0.1.0"
  }
}
```

`@sdbaron/knowledge-vault-indexer` and `@sdbaron/knowledge-vault-contract` are pulled in transitively. All three need Node.js 22 or newer.

Tagesberichte is owned by `SergeyLC`, not `sdbaron`, so its workflow `GITHUB_TOKEN` cannot read these packages until access is granted. Two ways to do that:

1. **Personal access token (works across owners).** Create a classic PAT with `read:packages`, or a fine-grained PAT that can read `sdbaron/knowledge-vault-mcp` and its packages. The token's user must be allowed to read the package (the `sdbaron` account, or a user invited on the package). Store it as a secret in SergeyLC/Tagesberichte and export it as `NODE_AUTH_TOKEN` before `pnpm install`.
2. **Package settings → Actions access.** After the first publish, open each package (`@sdbaron/knowledge-vault-contract`, `@sdbaron/knowledge-vault-indexer`, `@sdbaron/knowledge-vault-mcp`) → Package settings → Manage Actions access, and add the repository that should install it with `GITHUB_TOKEN`. GitHub only lists repositories owned by the same account as the package. `SergeyLC/Tagesberichte` will not appear in that list. Use a PAT for that repo. Actions access is the right switch for another repository under `sdbaron`.

Invite a person from Package settings → Invite teams or people if the PAT belongs to someone other than `sdbaron`.

