import { createRequire } from "node:module";

interface StatementSyncLike {
  run(...params: unknown[]): void;
  get<T = unknown>(...params: unknown[]): T | undefined;
  all<T = unknown>(...params: unknown[]): T[];
}

export interface DatabaseSyncLike {
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
}

export function isNodeSqliteAvailable(): boolean {
  try {
    loadDatabaseSyncConstructor();
    return true;
  } catch {
    return false;
  }
}

export function createDatabaseConnection(dbPath: string): DatabaseSyncLike {
  try {
    const DatabaseSyncValue = loadDatabaseSyncConstructor();
    return new DatabaseSyncValue(dbPath);
  } catch (error) {
    const message =
      "node:sqlite ist in dieser Node.js-Laufzeit nicht verfuegbar. Verwenden Sie Node.js 22+ mit aktivem node:sqlite Support.";
    throw new Error(message, { cause: error });
  }
}
