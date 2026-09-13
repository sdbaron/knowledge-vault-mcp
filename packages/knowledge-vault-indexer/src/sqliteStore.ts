import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

import type { ChunkRecord, IndexRunSummary, WikiFrontmatter } from "./types.js";

interface StatementSyncLike {
  run(...params: unknown[]): void;
  get<T = unknown>(...params: unknown[]): T | undefined;
  all<T = unknown>(...params: unknown[]): T[];
}

interface DatabaseSyncLike {
  exec(sql: string): void;
  prepare(sql: string): StatementSyncLike;
  close(): void;
}

type DatabaseSyncConstructor = new (path: string) => DatabaseSyncLike;

let cachedDatabaseSyncConstructor: DatabaseSyncConstructor | null = null;

const require = createRequire(import.meta.url);

function loadDatabaseSyncConstructor(): DatabaseSyncConstructor {
  if (cachedDatabaseSyncConstructor) {
    return cachedDatabaseSyncConstructor;
  }

  try {
    const moduleValue = require("node:sqlite") as {
      DatabaseSync?: DatabaseSyncConstructor;
    };
    if (typeof moduleValue.DatabaseSync !== "function") {
      throw new Error(
        "node:sqlite exportiert keine gueltige DatabaseSync-Klasse.",
      );
    }

    cachedDatabaseSyncConstructor = moduleValue.DatabaseSync;
    return cachedDatabaseSyncConstructor;
  } catch (error) {
    const message =
      "node:sqlite ist in dieser Node.js-Laufzeit nicht verfuegbar. Verwenden Sie Node.js 22+ mit aktivem node:sqlite Support.";
    throw new Error(message, { cause: error });
  }
}

export function isNodeSqliteAvailable(): boolean {
  try {
    loadDatabaseSyncConstructor();
    return true;
  } catch {
    return false;
  }
}

interface CountRow {
  count: number;
}

interface PathRow {
  path: string;
}

export class SqliteWikiStore {
  private readonly database: DatabaseSyncLike;

  public constructor(private readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const DatabaseSyncValue = loadDatabaseSyncConstructor();
    this.database = new DatabaseSyncValue(dbPath);
    this.database.exec("PRAGMA foreign_keys = ON;");
    this.initializeSchema();
  }

  public getNoteHash(notePath: string): string | null {
    const statement = this.database.prepare(
      "SELECT hash FROM notes WHERE path = ?",
    );
    const row = statement.get<{ hash: string }>(notePath);
    return row?.hash ?? null;
  }

  public upsertNoteAndChunks(
    notePath: string,
    frontmatter: WikiFrontmatter,
    hash: string,
    chunks: ChunkRecord[],
  ): void {
    const now = new Date().toISOString();

    this.database.exec("BEGIN");
    try {
      const upsertNote = this.database.prepare(`
        INSERT INTO notes (
          path,
          hash,
          title,
          domain,
          owner,
          updated_at,
          tags_json,
          aliases_json,
          indexed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          hash = excluded.hash,
          title = excluded.title,
          domain = excluded.domain,
          owner = excluded.owner,
          updated_at = excluded.updated_at,
          tags_json = excluded.tags_json,
          aliases_json = excluded.aliases_json,
          indexed_at = excluded.indexed_at
      `);

      upsertNote.run(
        notePath,
        hash,
        frontmatter.title,
        frontmatter.domain,
        frontmatter.owner,
        frontmatter.updated_at,
        JSON.stringify(frontmatter.tags),
        JSON.stringify(frontmatter.aliases),
        now,
      );

      const deleteChunks = this.database.prepare(
        "DELETE FROM chunks WHERE note_path = ?",
      );
      deleteChunks.run(notePath);

      const insertChunk = this.database.prepare(`
        INSERT INTO chunks (
          id,
          note_path,
          section_title,
          heading_level,
          chunk_index,
          content,
          tags_json,
          links_json,
          updated_at,
          start_line,
          end_line
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const chunk of chunks) {
        insertChunk.run(
          chunk.id,
          chunk.notePath,
          chunk.sectionTitle,
          chunk.headingLevel,
          chunk.chunkIndex,
          chunk.content,
          JSON.stringify(chunk.tags),
          JSON.stringify(chunk.links),
          chunk.updatedAt,
          chunk.startLine,
          chunk.endLine,
        );
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  public removeNotesNotIn(existingPaths: Set<string>): number {
    const selectPaths = this.database.prepare("SELECT path FROM notes");
    const deleteNote = this.database.prepare(
      "DELETE FROM notes WHERE path = ?",
    );

    const rows = selectPaths.all<PathRow>();
    let removedCount = 0;

    for (const row of rows) {
      if (existingPaths.has(row.path)) {
        continue;
      }

      deleteNote.run(row.path);
      removedCount += 1;
    }

    return removedCount;
  }

  public saveRunSummary(summary: IndexRunSummary): void {
    const insert = this.database.prepare(`
      INSERT INTO index_runs (
        started_at,
        finished_at,
        scanned_notes,
        indexed_notes,
        skipped_notes,
        removed_notes,
        chunk_count,
        error_count,
        errors_json,
        db_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      summary.startedAt,
      summary.finishedAt,
      summary.scannedNotes,
      summary.indexedNotes,
      summary.skippedNotes,
      summary.removedNotes,
      summary.chunkCount,
      summary.errorCount,
      JSON.stringify(summary.errors),
      summary.dbPath,
    );
  }

  public getCounts(): { noteCount: number; chunkCount: number } {
    const noteCount =
      this.database
        .prepare("SELECT COUNT(*) AS count FROM notes")
        .get<CountRow>()?.count ?? 0;
    const chunkCount =
      this.database
        .prepare("SELECT COUNT(*) AS count FROM chunks")
        .get<CountRow>()?.count ?? 0;

    return { noteCount, chunkCount };
  }

  public close(): void {
    this.database.close();
  }

  private initializeSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        title TEXT NOT NULL,
        domain TEXT NOT NULL,
        owner TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        aliases_json TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        note_path TEXT NOT NULL,
        section_title TEXT NOT NULL,
        heading_level INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        links_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        start_line INTEGER NOT NULL DEFAULT 0,
        end_line INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(note_path) REFERENCES notes(path) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS index_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        scanned_notes INTEGER NOT NULL,
        indexed_notes INTEGER NOT NULL,
        skipped_notes INTEGER NOT NULL,
        removed_notes INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        error_count INTEGER NOT NULL,
        errors_json TEXT NOT NULL,
        db_path TEXT NOT NULL
      );
    `);

    this.migrateSchema();
  }

  /** Migriert bestehende Datenbanken auf neue Schemata. */
  private migrateSchema(): void {
    interface ColumnInfo {
      name: string;
    }

    const columns = this.database
      .prepare(`SELECT name FROM pragma_table_info('chunks')`)
      .all<ColumnInfo>()
      .map((row) => row.name);

    if (!columns.includes("start_line")) {
      this.database.exec(
        "ALTER TABLE chunks ADD COLUMN start_line INTEGER NOT NULL DEFAULT 0",
      );
    }

    if (!columns.includes("end_line")) {
      this.database.exec(
        "ALTER TABLE chunks ADD COLUMN end_line INTEGER NOT NULL DEFAULT 0",
      );
    }
  }
}
