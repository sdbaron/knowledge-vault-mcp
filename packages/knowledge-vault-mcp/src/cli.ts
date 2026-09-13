#!/usr/bin/env node
import { resolve } from "node:path";

import { KnowledgeVaultMcpServer } from "./server.js";
import { extractStdioMessages, serializeStdioMessage } from "./stdioFraming.js";
import type { JsonRpcRequest, JsonRpcResponse } from "./types.js";

const server = new KnowledgeVaultMcpServer({
  dbPath: resolve(
    process.env.KNOWLEDGE_VAULT_DB_PATH ?? ".knowledge-vault/index.sqlite",
  ),
  vaultDir: resolve(process.env.KNOWLEDGE_VAULT_DIR ?? process.cwd()),
});

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer().catch((error) => {
    writeRawError(error);
  });
});

process.stdin.on("error", (error) => {
  writeRawError(error);
});

async function processBuffer(): Promise<void> {
  const extracted = extractStdioMessages(buffer);
  buffer = Buffer.from(extracted.remaining);

  for (const messageText of extracted.messages) {
    const request = parseRequest(messageText);
    if (!request) {
      continue;
    }

    const response = await server.handleRequest(request);
    if (response === null) {
      continue;
    }

    writeResponse(response);
  }
}

function parseRequest(payload: string): JsonRpcRequest | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("JSON-RPC Payload ist kein Objekt.");
    }

    const request = parsed as Partial<JsonRpcRequest>;
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      throw new Error("JSON-RPC Request ist ungueltig.");
    }

    return request as JsonRpcRequest;
  } catch (error) {
    writeRawError(error);
    return null;
  }
}

function writeResponse(response: JsonRpcResponse): void {
  process.stdout.write(serializeStdioMessage(JSON.stringify(response)));
}

function writeRawError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
}
