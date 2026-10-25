import { runFullReindex } from "@sdbaron/knowledge-vault-indexer";

import { VaultRepository } from "./repository.js";
import type {
  BacklinksParams,
  GetNoteParams,
  McpTool,
  ReindexParams,
  SearchParams,
} from "./types.js";

export const VAULT_TOOLS: McpTool[] = [
  {
    name: "vault_search",
    description:
      "Sucht relevante Wiki-Chunks nach Query, optional mit Filtern.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        k: { type: "number", minimum: 1, maximum: 50 },
        filters: {
          type: "object",
          properties: {
            domain: { type: "string" },
            owner: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "vault_get_note",
    description:
      "Liefert eine komplette Notiz oder einen spezifischen Abschnitt.",
    inputSchema: {
      type: "object",
      properties: {
        path_or_id: { type: "string" },
        section: { type: "string" },
      },
      required: ["path_or_id"],
    },
  },
  {
    name: "vault_backlinks",
    description: "Liefert Rueckverweise auf eine Zielnotiz.",
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string" },
        include_context: { type: "boolean" },
      },
      required: ["note"],
    },
  },
  {
    name: "vault_reindex",
    description: "Fuehrt ein Reindexing fuer changed_only oder full aus.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["changed_only", "full"] },
        vault_dir: { type: "string" },
        db_path: { type: "string" },
      },
    },
  },
];

export interface ToolRuntimeOptions {
  dbPath: string;
  vaultDir: string;
}

export async function executeTool(
  toolName: string,
  rawArgs: unknown,
  runtimeOptions: ToolRuntimeOptions,
): Promise<unknown> {
  const startMs = Date.now();

  try {
    const result = await executeToolInner(toolName, rawArgs, runtimeOptions);
    const durationMs = Date.now() - startMs;
    logObservability({ toolName, durationMs, success: true, result });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startMs;
    logObservability({ toolName, durationMs, success: false, error });
    throw error;
  }
}

function logObservability(entry: {
  toolName: string;
  durationMs: number;
  success: boolean;
  result?: unknown;
  error?: unknown;
}): void {
  try {
    const resultCount = resolveResultCount(entry.result);
    const errorMessage =
      entry.error instanceof Error
        ? entry.error.message
        : entry.error
          ? String(entry.error)
          : null;

    const logEntry = {
      ts: new Date().toISOString(),
      tool: entry.toolName,
      durationMs: entry.durationMs,
      success: entry.success,
      ...(resultCount !== null ? { resultCount } : {}),
      ...(errorMessage !== null ? { error: errorMessage } : {}),
    };

    process.stderr.write(`[knowledge-vault-mcp] ${JSON.stringify(logEntry)}\n`);
  } catch {
    // Observability must never affect the actual tool execution path.
  }
}

function resolveResultCount(result: unknown): number | null {
  if (result === null || result === undefined || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;

  if (typeof value["count"] === "number") {
    return value["count"];
  }

  if (typeof value["indexedNotes"] === "number") {
    return value["indexedNotes"];
  }

  return null;
}

async function executeToolInner(
  toolName: string,
  rawArgs: unknown,
  runtimeOptions: ToolRuntimeOptions,
): Promise<unknown> {
  const repository = new VaultRepository(runtimeOptions.dbPath);

  if (toolName === "vault_search") {
    const args = parseSearchParams(rawArgs);
    const results = repository.search(args);
    return {
      query: args.query,
      count: results.length,
      results,
    };
  }

  if (toolName === "vault_get_note") {
    const args = parseGetNoteParams(rawArgs);
    return repository.getNote(args.path_or_id, args.section);
  }

  if (toolName === "vault_backlinks") {
    const args = parseBacklinksParams(rawArgs);
    const results = repository.backlinks(args);
    return {
      note: args.note,
      count: results.length,
      results,
    };
  }

  if (toolName === "vault_reindex") {
    const args = parseReindexParams(rawArgs);
    const isFullMode = (args.mode ?? "changed_only") === "full";
    const summary = await runFullReindex({
      vaultDir: args.vault_dir ?? runtimeOptions.vaultDir,
      dbPath: args.db_path ?? runtimeOptions.dbPath,
      pruneMissing: true,
      forceReindex: isFullMode,
    });

    return summary;
  }

  throw new Error(`Unbekanntes Tool: ${toolName}`);
}

function parseSearchParams(rawArgs: unknown): SearchParams {
  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("vault_search erwartet ein Objekt als Eingabe.");
  }

  const value = rawArgs as Partial<SearchParams>;

  if (typeof value.query !== "string" || value.query.trim().length === 0) {
    throw new Error(
      "vault_search.query ist erforderlich und muss ein nicht-leerer String sein.",
    );
  }

  if (
    value.k !== undefined &&
    (typeof value.k !== "number" || Number.isNaN(value.k))
  ) {
    throw new Error("vault_search.k muss eine Zahl sein.");
  }

  if (value.filters !== undefined && typeof value.filters !== "object") {
    throw new Error("vault_search.filters muss ein Objekt sein.");
  }

  return {
    query: value.query,
    k: value.k,
    filters: value.filters,
  };
}

function parseGetNoteParams(rawArgs: unknown): GetNoteParams {
  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("vault_get_note erwartet ein Objekt als Eingabe.");
  }

  const value = rawArgs as Partial<GetNoteParams>;

  if (
    typeof value.path_or_id !== "string" ||
    value.path_or_id.trim().length === 0
  ) {
    throw new Error(
      "vault_get_note.path_or_id ist erforderlich und muss ein String sein.",
    );
  }

  if (value.section !== undefined && typeof value.section !== "string") {
    throw new Error("vault_get_note.section muss ein String sein.");
  }

  return {
    path_or_id: value.path_or_id,
    section: value.section,
  };
}

function parseBacklinksParams(rawArgs: unknown): BacklinksParams {
  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("vault_backlinks erwartet ein Objekt als Eingabe.");
  }

  const value = rawArgs as Partial<BacklinksParams>;

  if (typeof value.note !== "string" || value.note.trim().length === 0) {
    throw new Error(
      "vault_backlinks.note ist erforderlich und muss ein String sein.",
    );
  }

  if (
    value.include_context !== undefined &&
    typeof value.include_context !== "boolean"
  ) {
    throw new Error("vault_backlinks.include_context muss ein Boolean sein.");
  }

  return {
    note: value.note,
    include_context: value.include_context,
  };
}

function parseReindexParams(rawArgs: unknown): ReindexParams {
  if (rawArgs === undefined) {
    return {};
  }

  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("vault_reindex erwartet ein Objekt als Eingabe.");
  }

  const value = rawArgs as Partial<ReindexParams>;

  if (
    value.mode !== undefined &&
    value.mode !== "changed_only" &&
    value.mode !== "full"
  ) {
    throw new Error("vault_reindex.mode muss changed_only oder full sein.");
  }

  if (value.vault_dir !== undefined && typeof value.vault_dir !== "string") {
    throw new Error("vault_reindex.vault_dir muss ein String sein.");
  }

  if (value.db_path !== undefined && typeof value.db_path !== "string") {
    throw new Error("vault_reindex.db_path muss ein String sein.");
  }

  return {
    mode: value.mode,
    vault_dir: value.vault_dir,
    db_path: value.db_path,
  };
}
