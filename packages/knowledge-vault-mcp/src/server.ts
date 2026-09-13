import { executeTool, VAULT_TOOLS } from "./tools.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerOptions,
} from "./types.js";

export class KnowledgeVaultMcpServer {
  public constructor(private readonly options: McpServerOptions) {}

  public async handleRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse | null> {
    if (
      request.id === undefined &&
      request.method.startsWith("notifications/")
    ) {
      return null;
    }

    const id = request.id ?? null;

    try {
      if (request.method === "initialize") {
        const params = toOptionalObject(request.params);
        const requestedVersion =
          typeof params?.protocolVersion === "string"
            ? params.protocolVersion
            : "2024-11-05";

        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: requestedVersion,
            capabilities: {
              tools: {
                listChanged: true,
              },
            },
            serverInfo: {
              name: "knowledge-vault-mcp",
              version: "0.1.0",
            },
          },
        };
      }

      if (request.method === "ping") {
        return {
          jsonrpc: "2.0",
          id,
          result: {},
        };
      }

      if (request.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: VAULT_TOOLS,
          },
        };
      }

      if (request.method === "prompts/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: { prompts: [] },
        };
      }

      if (request.method === "resources/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: { resources: [] },
        };
      }

      if (request.method === "resources/templates/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: { resourceTemplates: [] },
        };
      }

      if (request.method === "tools/call") {
        const params = toObject(
          request.params,
          "tools/call erwartet ein Objekt als params.",
        );
        const name = asString(
          params.name,
          "tools/call.name muss ein String sein.",
        );
        const args = params.arguments;

        const result = await executeTool(name, args, {
          dbPath: this.options.dbPath,
          vaultDir: this.options.vaultDir,
        });

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result,
            isError: false,
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Methode nicht unterstuetzt: ${request.method}`,
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

function toOptionalObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function toObject(
  value: unknown,
  errorMessage: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(errorMessage);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, errorMessage: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }

  return value;
}
