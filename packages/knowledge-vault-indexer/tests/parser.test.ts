import { describe, expect, it } from "@jest/globals";

import { parseWikiNote } from "../src/parser.js";

describe("parseWikiNote", () => {
  it("parst Frontmatter, Sections und Wikilinks", () => {
    const content = [
      "---",
      "title: Prozess Test",
      "tags:",
      "  - wiki",
      "  - phase1",
      "domain: operations",
      "owner: team-ocr",
      "updated_at: 2026-05-05",
      "aliases: [Prozess, Ablauf]",
      "---",
      "# Einleitung",
      "Siehe [[Betriebshandbuch]].",
      "",
      "## Details",
      "Mehr Text.",
      "",
    ].join("\n");

    const parsed = parseWikiNote({
      absolutePath: "/vault/test.md",
      relativePath: "test.md",
      content,
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter.title).toBe("Prozess Test");
    expect(parsed.frontmatter.tags).toEqual(["wiki", "phase1"]);
    expect(parsed.frontmatter.aliases).toEqual(["Prozess", "Ablauf"]);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.allLinks).toEqual(["Betriebshandbuch"]);
  });

  it("erlaubt leeres aliases-Array", () => {
    const content = [
      "---",
      "title: Ohne Alias",
      "tags: [wiki]",
      "domain: operations",
      "owner: team-ocr",
      "updated_at: 2026-05-05",
      "aliases: []",
      "---",
      "# Intro",
      "Text",
    ].join("\n");

    const parsed = parseWikiNote({
      absolutePath: "/vault/no-alias.md",
      relativePath: "no-alias.md",
      content,
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter.aliases).toEqual([]);
  });

  it("meldet fehlende Pflichtfelder", () => {
    const content = [
      "---",
      "title: Fehlerfall",
      "tags: [wiki]",
      "domain: operations",
      "updated_at: 2026-05-05",
      "aliases: [Alias1]",
      "---",
      "# Intro",
      "Text",
    ].join("\n");

    const parsed = parseWikiNote({
      absolutePath: "/vault/error.md",
      relativePath: "error.md",
      content,
    });

    expect(parsed.errors.some((entry) => entry.includes("owner"))).toBe(true);
  });
});
