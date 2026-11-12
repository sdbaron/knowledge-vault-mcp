# Retrieval

## MCP tools

| Tool | Purpose |
| --- | --- |
| `vault_search` | Ranked chunk search with optional `domain` / `owner` / `tags` filters |
| `vault_get_note` | Full note or one section by path, title, or alias |
| `vault_backlinks` | Notes whose chunks link to a target (`[[wikilinks]]`) |
| `vault_reindex` | `changed_only` or `full` reindex via the indexer package |

## Search algorithm (current)

Implemented in `VaultRepository.search` (`packages/knowledge-vault-mcp/src/repository.ts`):

1. Load all chunks joined to notes from SQLite.
2. Apply optional metadata filters.
3. Tokenize the query on whitespace (lowercase).
4. Score each row: token occurrences in `title + section_title + content`, plus bonuses for title (+2) and section title (+1) hits.
5. Drop zero scores, sort descending, return top `k` (default 5, max 50) with a short snippet around the first hit.

This is a naive lexical baseline. Changing ranking, adding embeddings, or FTS belongs in the MCP package (or a future dedicated retrieval package), not in contract. Prefer an ADR if the strategy changes.

## Index schema (owned by indexer)

- `notes`: path, hash, title, domain, owner, updated_at, tags_json, aliases_json, indexed_at
- `chunks`: id, note_path, section_title, heading_level, chunk_index, content, tags_json, links_json, updated_at, start_line, end_line
- `index_runs`: run metrics and error JSON

MCP reads this schema; indexer owns migrations.
