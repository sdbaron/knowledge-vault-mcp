import { createDatabaseConnection } from "./sqliteRuntime.js";
import type {
  BacklinkItem,
  BacklinksParams,
  NoteChunk,
  NoteResponse,
  SearchParams,
  SearchResultItem,
} from "./types.js";

interface SearchRow {
  note_path: string;
  section_title: string;
  content: string;
  updated_at: string;
  tags_json: string;
  title: string;
  domain: string;
  owner: string;
  start_line: number;
}

interface NoteRow {
  path: string;
  title: string;
  domain: string;
  owner: string;
  updated_at: string;
  tags_json: string;
  aliases_json: string;
}

interface ChunkRow {
  id: string;
  section_title: string;
  heading_level: number;
  chunk_index: number;
  content: string;
  links_json: string;
}

interface BacklinkRow {
  note_path: string;
  section_title: string;
  content: string;
  links_json: string;
}

export class VaultRepository {
  public constructor(private readonly dbPath: string) {}

  public search(params: SearchParams): SearchResultItem[] {
    const query = params.query.trim();
    if (!query) {
      throw new Error("query darf nicht leer sein.");
    }

    const k = normalizeLimit(params.k);
    const tokens = tokenize(query);
    const database = createDatabaseConnection(this.dbPath);

    try {
      const rows = database
        .prepare(
          `
        SELECT
          c.note_path,
          c.section_title,
          c.content,
          c.updated_at,
          c.tags_json,
          c.start_line,
          n.title,
          n.domain,
          n.owner
        FROM chunks c
        JOIN notes n ON n.path = c.note_path
      `,
        )
        .all<SearchRow>();

      const filteredRows = rows.filter((row) =>
        matchesFilters(row, params.filters),
      );

      const scored = filteredRows
        .map((row) => {
          const score = scoreRow(row, tokens);
          return { row, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, k)
        .map(({ row, score }) => ({
          notePath: row.note_path,
          sectionTitle: row.section_title,
          snippet: buildSnippet(row.content, tokens),
          score,
          updatedAt: row.updated_at,
          tags: parseJsonArray(row.tags_json),
          startLine: row.start_line,
        }));

      return scored;
    } finally {
      database.close();
    }
  }

  public getNote(pathOrId: string, section?: string): NoteResponse {
    const value = pathOrId.trim();
    if (!value) {
      throw new Error("path_or_id darf nicht leer sein.");
    }

    const database = createDatabaseConnection(this.dbPath);

    try {
      const note = this.findNote(database, value);
      if (!note) {
        throw new Error(`Notiz nicht gefunden: ${value}`);
      }

      let chunks = database
        .prepare(
          `
          SELECT
            id,
            section_title,
            heading_level,
            chunk_index,
            content,
            links_json
          FROM chunks
          WHERE note_path = ?
          ORDER BY chunk_index ASC
        `,
        )
        .all<ChunkRow>(note.path)
        .map<NoteChunk>((row) => ({
          id: row.id,
          sectionTitle: row.section_title,
          headingLevel: row.heading_level,
          chunkIndex: row.chunk_index,
          content: row.content,
          links: parseJsonArray(row.links_json),
        }));

      if (section && section.trim().length > 0) {
        const normalizedSection = section.trim().toLowerCase();
        chunks = chunks.filter(
          (chunk) => chunk.sectionTitle.toLowerCase() === normalizedSection,
        );
      }

      return {
        notePath: note.path,
        title: note.title,
        domain: note.domain,
        owner: note.owner,
        updatedAt: note.updated_at,
        tags: parseJsonArray(note.tags_json),
        aliases: parseJsonArray(note.aliases_json),
        chunks,
      };
    } finally {
      database.close();
    }
  }

  public backlinks(params: BacklinksParams): BacklinkItem[] {
    const target = normalizeLinkTarget(params.note);
    if (!target) {
      throw new Error("note darf nicht leer sein.");
    }

    const includeContext = params.include_context ?? false;
    const database = createDatabaseConnection(this.dbPath);

    try {
      const rows = database
        .prepare(
          `
        SELECT
          note_path,
          section_title,
          content,
          links_json
        FROM chunks
      `,
        )
        .all<BacklinkRow>();

      return rows
        .filter((row) => {
          const links = parseJsonArray(row.links_json).map(normalizeLinkTarget);
          return links.includes(target);
        })
        .map((row) => ({
          sourceNotePath: row.note_path,
          sectionTitle: row.section_title,
          context: includeContext
            ? row.content.slice(0, 280).trim()
            : undefined,
        }));
    } finally {
      database.close();
    }
  }

  private findNote(
    database: ReturnType<typeof createDatabaseConnection>,
    pathOrId: string,
  ): NoteRow | null {
    const byPath = database
      .prepare(
        `
      SELECT
        path,
        title,
        domain,
        owner,
        updated_at,
        tags_json,
        aliases_json
      FROM notes
      WHERE path = ?
      LIMIT 1
    `,
      )
      .get<NoteRow>(pathOrId);

    if (byPath) {
      return byPath;
    }

    const fallbackRows = database
      .prepare(
        `
      SELECT
        path,
        title,
        domain,
        owner,
        updated_at,
        tags_json,
        aliases_json
      FROM notes
    `,
      )
      .all<NoteRow>();

    const normalizedNeedle = pathOrId.toLowerCase();

    return (
      fallbackRows.find((row) => {
        if (row.title.toLowerCase().includes(normalizedNeedle)) {
          return true;
        }

        const aliases = parseJsonArray(row.aliases_json).map((value) =>
          value.toLowerCase(),
        );
        return aliases.some((alias) => alias.includes(normalizedNeedle));
      }) ?? null
    );
  }
}

function matchesFilters(
  row: SearchRow,
  filters: SearchParams["filters"],
): boolean {
  if (!filters) {
    return true;
  }

  if (filters.domain && row.domain !== filters.domain) {
    return false;
  }

  if (filters.owner && row.owner !== filters.owner) {
    return false;
  }

  if (filters.tags && filters.tags.length > 0) {
    const rowTags = parseJsonArray(row.tags_json);
    const required = new Set(filters.tags);

    for (const tag of required) {
      if (!rowTags.includes(tag)) {
        return false;
      }
    }
  }

  return true;
}

function scoreRow(row: SearchRow, tokens: string[]): number {
  const haystack =
    `${row.title} ${row.section_title} ${row.content}`.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const regex = new RegExp(escapeRegex(token), "g");
    const matches = haystack.match(regex);
    const count = matches?.length ?? 0;
    score += count;

    if (row.title.toLowerCase().includes(token)) {
      score += 2;
    }

    if (row.section_title.toLowerCase().includes(token)) {
      score += 1;
    }
  }

  return score;
}

function buildSnippet(content: string, tokens: string[]): string {
  const value = content.trim();
  if (!value) {
    return "";
  }

  const lower = value.toLowerCase();
  let firstHit = -1;

  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index >= 0) {
      firstHit = index;
      break;
    }
  }

  if (firstHit < 0) {
    return value.slice(0, 220);
  }

  const start = Math.max(firstHit - 80, 0);
  const end = Math.min(start + 220, value.length);
  return value.slice(start, end).trim();
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 5;
  }

  const rounded = Math.floor(value);
  if (rounded < 1) {
    return 1;
  }

  if (rounded > 50) {
    return 50;
  }

  return rounded;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function normalizeLinkTarget(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
