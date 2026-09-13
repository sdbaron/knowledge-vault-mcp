import { describe, expect, it } from "@jest/globals";

import {
  extractStdioMessages,
  serializeStdioMessage,
} from "../src/stdioFraming.js";

describe("stdioFraming (MCP NDJSON)", () => {
  it("extrahiert newline-delimited JSON-Nachrichten", () => {
    const input = Buffer.from(
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n\n',
    );
    const { messages, remaining } = extractStdioMessages(input);

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "")).toMatchObject({
      method: "initialize",
    });
    expect(remaining.length).toBe(0);
  });

  it("serialisiert Antworten als NDJSON", () => {
    expect(serializeStdioMessage('{"ok":true}')).toBe('{"ok":true}\n');
  });

  it("akzeptiert legacy Content-Length auf stdin", () => {
    const payload = '{"jsonrpc":"2.0","id":1,"method":"ping"}';
    const input = Buffer.from(
      `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`,
    );
    const { messages } = extractStdioMessages(input);

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "")).toMatchObject({ method: "ping" });
  });
});
