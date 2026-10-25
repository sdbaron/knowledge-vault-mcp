import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";
import { runFullReindex } from "@sdbaron/knowledge-vault-indexer";

import { KnowledgeVaultMcpServer } from "../src/server.js";
import { isNodeSqliteAvailable } from "../src/sqliteRuntime.js";
import type { JsonRpcRequest } from "../src/types.js";

const describeWithSqlite = isNodeSqliteAvailable() ? describe : describe.skip;

describeWithSqlite("KnowledgeVaultMcpServer integration", () => {
  it("deckt initialize, tools/list und Tool-Calls Ende-zu-Ende ab", async () => {
    const root = await mkdtemp(join(tmpdir(), "wiki-mcp-int-"));
    const vaultDir = join(root, "vault");
    const dbPath = join(root, "index", "wiki-index.sqlite");

    try {
      await mkdir(vaultDir, { recursive: true });

      await writeFile(
        join(vaultDir, "incident.md"),
        [
          "---",
          "title: Incident Prozess",
          "tags: [operations, process]",
          "domain: operations",
          "owner: team-ocr",
          "updated_at: 2026-05-05",
          "aliases: [Incident Ablauf]",
          "---",
          "# Kontext",
          "Incident Bearbeitung mit [[runbook-ocr]].",
          "## Eskalation",
          "Eskalation an team-ocr.",
        ].join("\n"),
      );

      await writeFile(
        join(vaultDir, "runbook-ocr.md"),
        [
          "---",
          "title: OCR Runbook",
          "tags: [operations, runbook]",
          "domain: operations",
          "owner: team-ocr",
          "updated_at: 2026-05-05",
          "aliases: [Betriebsanleitung OCR]",
          "---",
          "# Zweck",
          "Runbook fuer Betrieb und Monitoring.",
        ].join("\n"),
      );

      await runFullReindex({ vaultDir, dbPath, pruneMissing: true });

      const server = new KnowledgeVaultMcpServer({ dbPath, vaultDir });

      const initialize = await server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });
      expect(initialize.error).toBeUndefined();

      const toolsList = await server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });

      const toolNames = (
        (toolsList.result as { tools?: Array<{ name: string }> })?.tools ?? []
      ).map((tool) => tool.name);
      expect(toolNames).toEqual(
        expect.arrayContaining([
          "vault_search",
          "vault_get_note",
          "vault_backlinks",
          "vault_reindex",
        ]),
      );

      const searchResponse = await callTool(server, 3, "vault_search", {
        query: "Incident Bearbeitung",
        k: 3,
      });
      const searchStructured = readStructured(searchResponse);
      expect(searchStructured.count).toBeGreaterThan(0);
      const firstResult = searchStructured.results?.[0];
      expect(typeof firstResult?.startLine).toBe("number");
      expect(firstResult?.startLine).toBeGreaterThanOrEqual(0);

      const getNoteResponse = await callTool(server, 4, "vault_get_note", {
        path_or_id: "incident.md",
      });
      const getNoteStructured = readStructured(getNoteResponse);
      expect(getNoteStructured.notePath).toBe("incident.md");
      expect(getNoteStructured.chunks.length).toBeGreaterThan(0);

      const backlinksResponse = await callTool(server, 5, "vault_backlinks", {
        note: "runbook-ocr",
        include_context: true,
      });
      const backlinksStructured = readStructured(backlinksResponse);
      expect(backlinksStructured.count).toBeGreaterThan(0);

      const beforeChangedOnly = await readFile(
        join(vaultDir, "runbook-ocr.md"),
        "utf8",
      );
      await writeFile(
        join(vaultDir, "runbook-ocr.md"),
        `${beforeChangedOnly}\n## Update\nNeue Zeile fuer changed_only Test.\n`,
      );

      const changedOnlyResponse = await callTool(server, 6, "vault_reindex", {
        mode: "changed_only",
        vault_dir: vaultDir,
        db_path: dbPath,
      });

      const changedOnlyStructured = readStructured(changedOnlyResponse);
      expect(changedOnlyStructured.indexedNotes).toBeGreaterThan(0);

      // full-Modus: erzwingt Neu-Indexierung aller Notizen unabhaengig vom Hash
      const fullResponse = await callTool(server, 7, "vault_reindex", {
        mode: "full",
        vault_dir: vaultDir,
        db_path: dbPath,
      });

      const fullStructured = readStructured(fullResponse);
      expect(fullStructured.scannedNotes).toBeGreaterThan(0);
      // Bei full werden alle Notizen neu indexiert (kein Skip)
      expect(fullStructured.skippedNotes).toBe(0);
      expect(fullStructured.indexedNotes).toBe(fullStructured.scannedNotes);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("antwortet nicht auf notifications/initialized", async () => {
    const root = await mkdtemp(join(tmpdir(), "wiki-mcp-notify-"));
    const vaultDir = join(root, "vault");
    const dbPath = join(root, "index", "wiki-index.sqlite");

    try {
      await mkdir(vaultDir, { recursive: true });
      const server = new KnowledgeVaultMcpServer({ dbPath, vaultDir });

      const response = await server.handleRequest({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });

      expect(response).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("liefert valide Fehler fuer ungueltige Calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "wiki-mcp-error-"));
    const vaultDir = join(root, "vault");
    const dbPath = join(root, "index", "wiki-index.sqlite");

    try {
      await mkdir(vaultDir, { recursive: true });

      const server = new KnowledgeVaultMcpServer({ dbPath, vaultDir });

      const badMethod = await server.handleRequest({
        jsonrpc: "2.0",
        id: 100,
        method: "tools/unknown",
      });
      expect(badMethod.error?.code).toBe(-32601);

      const badInput = await callTool(server, 101, "vault_search", {
        query: "",
      });
      expect(badInput.error?.code).toBe(-32000);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deckt zehn Smoke-Queries fuer vault_search ab", async () => {
    const root = await mkdtemp(join(tmpdir(), "wiki-mcp-smoke-"));
    const vaultDir = join(root, "vault");
    const dbPath = join(root, "index", "wiki-index.sqlite");

    try {
      await mkdir(vaultDir, { recursive: true });

      await writeFile(
        join(vaultDir, "ops.md"),
        [
          "---",
          "title: Betrieb OCR",
          "tags: [operations, runbook, monitoring]",
          "domain: operations",
          "owner: team-ocr",
          "updated_at: 2026-05-05",
          "aliases: [OCR Betrieb]",
          "---",
          "# Monitoring",
          "Monitoring, Alerting und Incident Ablauf.",
          "## Reindex",
          "Reindex mode changed_only und full.",
          "## Backlinks",
          "Verknuepfungen mit [[incident]].",
        ].join("\n"),
      );

      await writeFile(
        join(vaultDir, "incident.md"),
        [
          "---",
          "title: Incident Playbook",
          "tags: [operations, process]",
          "domain: operations",
          "owner: team-ocr",
          "updated_at: 2026-05-05",
          "aliases: [Stoerung Ablauf]",
          "---",
          "# Incident",
          "Eskalation, Fehleranalyse und Kommunikation.",
        ].join("\n"),
      );

      await runFullReindex({ vaultDir, dbPath, pruneMissing: true });

      const server = new KnowledgeVaultMcpServer({ dbPath, vaultDir });

      const queries = [
        "monitoring",
        "incident",
        "reindex full",
        "changed_only",
        "backlinks",
        "owner team-ocr",
        "operations runbook",
        "eskalation",
        "fehleranalyse",
        "alerting",
      ];

      for (let i = 0; i < queries.length; i += 1) {
        const response = await callTool(server, 1000 + i, "vault_search", {
          query: queries[i],
          k: 5,
        });

        const structured = readStructured(response);
        expect(Array.isArray(structured.results)).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function callTool(
  server: KnowledgeVaultMcpServer,
  id: number,
  name: string,
  args: Record<string, unknown>,
): Promise<Awaited<ReturnType<KnowledgeVaultMcpServer["handleRequest"]>>> {
  return server.handleRequest({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  } as JsonRpcRequest);
}

function readStructured(
  response: Awaited<ReturnType<KnowledgeVaultMcpServer["handleRequest"]>>,
): any {
  if (!response) {
    throw new Error("Unerwartete leere Antwort.");
  }

  if (response.error) {
    throw new Error(`Unerwarteter Fehler: ${response.error.message}`);
  }

  const result = response.result as { structuredContent?: unknown };
  return result.structuredContent as any;
}
