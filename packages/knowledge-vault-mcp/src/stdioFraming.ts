/**
 * MCP stdio transport (spec 2025-03-26): newline-delimited JSON-RPC messages.
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 *
 * Legacy Content-Length framing is accepted on input only (older test clients).
 */

export interface StdioExtractResult {
  remaining: Buffer;
  messages: string[];
}

export function extractStdioMessages(buffer: Buffer): StdioExtractResult {
  const messages: string[] = [];
  let remaining = buffer;

  while (remaining.length > 0) {
    if (looksLikeContentLengthFrame(remaining)) {
      const framed = extractContentLengthMessage(remaining);
      if (!framed) {
        break;
      }

      messages.push(framed.payload);
      remaining = framed.remaining;
      continue;
    }

    const newlineIndex = remaining.indexOf("\n");
    if (newlineIndex < 0) {
      break;
    }

    const line = remaining.subarray(0, newlineIndex).toString("utf8").trim();
    remaining = remaining.subarray(newlineIndex + 1);

    if (line.length > 0) {
      messages.push(line);
    }
  }

  return { remaining, messages };
}

export function serializeStdioMessage(payload: string): string {
  return `${payload}\n`;
}

function looksLikeContentLengthFrame(buffer: Buffer): boolean {
  const prefix = buffer
    .subarray(0, Math.min(buffer.length, 16))
    .toString("utf8");
  return /^Content-Length:/i.test(prefix);
}

function extractContentLengthMessage(
  buffer: Buffer,
): { payload: string; remaining: Buffer } | null {
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  const lfIndex = buffer.indexOf("\n\n");
  const separatorIndex = crlfIndex >= 0 ? crlfIndex : lfIndex;
  const separatorLength = crlfIndex >= 0 ? 4 : 2;

  if (separatorIndex < 0) {
    return null;
  }

  const headerText = buffer.subarray(0, separatorIndex).toString("utf8");
  const contentLength = parseContentLength(headerText);
  if (contentLength === null) {
    return null;
  }

  const messageStart = separatorIndex + separatorLength;
  const messageEnd = messageStart + contentLength;
  if (buffer.length < messageEnd) {
    return null;
  }

  return {
    payload: buffer.subarray(messageStart, messageEnd).toString("utf8"),
    remaining: buffer.subarray(messageEnd),
  };
}

function parseContentLength(headerText: string): number | null {
  for (const line of headerText.split(/\r?\n/)) {
    const match = /^Content-Length:\s*(\d+)$/i.exec(line.trim());
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}
