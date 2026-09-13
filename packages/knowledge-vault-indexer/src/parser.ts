import { sha256 } from "./hash.js";
import { validateVaultFrontmatter } from "@knowledge-vault/contract";
import type { ParsedWikiNote, WikiFrontmatter, WikiSection } from "./types.js";

interface FrontmatterExtraction {
  frontmatterBlock: string;
  body: string;
  bodyStartLine: number;
  errors: string[];
}

interface ParseWikiNoteInput {
  absolutePath: string;
  relativePath: string;
  content: string;
}

export function parseWikiNote(input: ParseWikiNoteInput): ParsedWikiNote {
  const extraction = extractFrontmatter(input.content);
  const parsedFrontmatter = parseFrontmatter(extraction.frontmatterBlock);

  const frontmatter = normalizeFrontmatter(parsedFrontmatter.values);
  const errors = [
    ...extraction.errors,
    ...parsedFrontmatter.errors,
    ...validateFrontmatter(frontmatter),
  ];

  const sections = extractSections(extraction.body, extraction.bodyStartLine);
  const allLinks = extractWikiLinks(extraction.body);

  return {
    absolutePath: input.absolutePath,
    relativePath: normalizeRelativePath(input.relativePath),
    contentHash: sha256(input.content),
    frontmatter,
    sections,
    allLinks,
    errors,
  };
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function extractFrontmatter(content: string): FrontmatterExtraction {
  const lines = content.split(/\r?\n/);

  if (lines.length === 0 || lines[0]?.trim() !== "---") {
    return {
      frontmatterBlock: "",
      body: content,
      bodyStartLine: 1,
      errors: [
        "Frontmatter fehlt. Erwartet wurde ein YAML-Block am Dateianfang.",
      ],
    };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === "---") {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return {
      frontmatterBlock: "",
      body: "",
      bodyStartLine: lines.length,
      errors: ["Frontmatter ist nicht geschlossen. Abschliessendes --- fehlt."],
    };
  }

  const frontmatterBlock = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n");

  return {
    frontmatterBlock,
    body,
    bodyStartLine: closingIndex + 2,
    errors: [],
  };
}

function parseFrontmatter(frontmatterBlock: string): {
  values: Record<string, unknown>;
  errors: string[];
} {
  const values: Record<string, unknown> = {};
  const errors: string[] = [];
  const lines = frontmatterBlock.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trimEnd() ?? "";
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const keyValueMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!keyValueMatch) {
      errors.push(`Ungueltige Frontmatter-Zeile: "${line}"`);
      continue;
    }

    const key = keyValueMatch[1] as string;
    const rawValue = keyValueMatch[2] as string;

    if (!rawValue) {
      const parsedArray = parseIndentedArray(lines, i + 1);
      if (parsedArray.values.length > 0) {
        values[key] = parsedArray.values;
        i = parsedArray.lastIndex;
      } else {
        values[key] = "";
      }
      continue;
    }

    values[key] = parseScalarValue(rawValue);
  }

  return { values, errors };
}

function parseIndentedArray(
  lines: string[],
  startIndex: number,
): { values: string[]; lastIndex: number } {
  const values: string[] = [];
  let lastIndex = startIndex - 1;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      lastIndex = i;
      continue;
    }

    if (!/^\s*-\s+/.test(line)) {
      break;
    }

    values.push(trimmed.replace(/^-\s+/, "").trim());
    lastIndex = i;
  }

  return { values, lastIndex };
}

function parseScalarValue(rawValue: string): string | string[] {
  const value = rawValue.trim();

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }

    return inner
      .split(",")
      .map((part) => stripQuotes(part.trim()))
      .filter((part) => part.length > 0);
  }

  return stripQuotes(value);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeFrontmatter(
  values: Record<string, unknown>,
): WikiFrontmatter {
  return {
    ...values,
    title: toRequiredString(values.title),
    tags: toStringArray(values.tags),
    domain: toRequiredString(values.domain),
    owner: toRequiredString(values.owner),
    updated_at: toRequiredString(values.updated_at),
    aliases: toStringArray(values.aliases),
  };
}

function toRequiredString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function validateFrontmatter(frontmatter: WikiFrontmatter): string[] {
  const errors = validateVaultFrontmatter(frontmatter).errors;

  if (frontmatter.tags.length === 0) {
    errors.push('Frontmatter-Feld "tags" darf nicht leer sein.');
  }

  if (
    frontmatter.updated_at &&
    !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.updated_at)
  ) {
    errors.push(
      'Frontmatter-Feld "updated_at" muss das Format YYYY-MM-DD haben.',
    );
  }

  return errors;
}

function extractSections(body: string, bodyStartLine: number): WikiSection[] {
  const lines = body.split(/\r?\n/);
  const headingPositions: Array<{
    index: number;
    level: number;
    heading: string;
  }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!headingMatch) {
      continue;
    }

    headingPositions.push({
      index: i,
      level: headingMatch[1]?.length ?? 1,
      heading: (headingMatch[2] ?? "").trim(),
    });
  }

  if (headingPositions.length === 0) {
    const content = body.trim();
    if (!content) {
      return [];
    }

    return [
      {
        heading: "Document",
        level: 1,
        content,
        startLine: bodyStartLine,
        endLine: bodyStartLine + Math.max(lines.length - 1, 0),
        links: extractWikiLinks(content),
      },
    ];
  }

  const sections: WikiSection[] = [];

  for (let i = 0; i < headingPositions.length; i += 1) {
    const current = headingPositions[i];
    if (!current) {
      continue;
    }

    const next = headingPositions[i + 1];
    const contentStart = current.index + 1;
    const contentEnd = (next?.index ?? lines.length) - 1;
    const content = lines
      .slice(contentStart, contentEnd + 1)
      .join("\n")
      .trim();

    sections.push({
      heading: current.heading,
      level: current.level,
      content,
      startLine: bodyStartLine + contentStart,
      endLine: bodyStartLine + Math.max(contentEnd, contentStart),
      links: extractWikiLinks(content),
    });
  }

  return sections;
}

export function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(
    /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g,
  );
  const values = new Set<string>();

  for (const match of matches) {
    const value = match[1]?.trim();
    if (!value) {
      continue;
    }

    values.add(value);
  }

  return [...values];
}
