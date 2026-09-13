import { describe, expect, it } from "@jest/globals";

import { buildChunks } from "../src/chunker.js";
import { parseWikiNote } from "../src/parser.js";

describe("buildChunks", () => {
  it("splittet lange Abschnitte in mehrere Chunks", () => {
    const longParagraph =
      "Dies ist ein langer Satz fuer den Chunk-Test ".repeat(15);

    const content = [
      "---",
      "title: Chunk Test",
      "tags: [wiki, chunk]",
      "domain: qa",
      "owner: team-ocr",
      "updated_at: 2026-05-05",
      "aliases: [ChunkAlias]",
      "---",
      "# Abschnitt Eins",
      longParagraph,
      "",
      "# Abschnitt Zwei",
      "Kurztext.",
    ].join("\n");

    const parsed = parseWikiNote({
      absolutePath: "/vault/chunk.md",
      relativePath: "chunk.md",
      content,
    });

    const chunks = buildChunks(parsed, 120);

    expect(chunks.length).toBeGreaterThan(2);
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
    for (const chunk of chunks) {
      expect(typeof chunk.startLine).toBe("number");
      expect(typeof chunk.endLine).toBe("number");
      expect(chunk.startLine).toBeGreaterThanOrEqual(0);
    }
  });

  it("erzeugt keine Chunks fuer leere Section-Inhalte", () => {
    const content = [
      "---",
      "title: Leer Test",
      "tags: [wiki]",
      "domain: qa",
      "owner: team-ocr",
      "updated_at: 2026-05-05",
      "aliases: [Leer]",
      "---",
      "# Leer",
      "",
      "# Gefuellt",
      "Inhalt vorhanden.",
    ].join("\n");

    const parsed = parseWikiNote({
      absolutePath: "/vault/leer.md",
      relativePath: "leer.md",
      content,
    });

    const chunks = buildChunks(parsed, 200);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.sectionTitle).toBe("Gefuellt");
  });
});
