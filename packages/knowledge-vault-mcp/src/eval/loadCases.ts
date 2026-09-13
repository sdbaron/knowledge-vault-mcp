import { readFile } from "node:fs/promises";

import type { EvalCase, EvalSuite } from "./types.js";

const VALID_SUITES = new Set<EvalSuite>(["examples", "production-vault"]);

export async function loadCases(casesPath: string): Promise<EvalCase[]> {
  const raw = await readFile(casesPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cases.json ist kein gueltiges JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("cases.json muss ein JSON-Array sein.");
  }

  const cases: EvalCase[] = [];
  const seenIds = new Set<string>();

  for (let index = 0; index < parsed.length; index += 1) {
    const entry = parsed[index];
    cases.push(validateCase(entry, index, seenIds));
  }

  return cases;
}

export function filterCasesBySuite(
  cases: EvalCase[],
  suite: EvalSuite | "all" | undefined,
): EvalCase[] {
  if (!suite || suite === "all") {
    return cases;
  }

  return cases.filter((entry) => entry.suite === suite);
}

function validateCase(
  entry: unknown,
  index: number,
  seenIds: Set<string>,
): EvalCase {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Case an Index ${index} ist kein Objekt.`);
  }

  const value = entry as Record<string, unknown>;
  const id = readRequiredString(value.id, `cases[${index}].id`);
  if (seenIds.has(id)) {
    throw new Error(`Doppelte Case-ID: ${id}`);
  }
  seenIds.add(id);

  const suite = readSuite(value.suite, `cases[${index}].suite`);
  const query = readRequiredString(value.query, `cases[${index}].query`);
  const language = readRequiredString(
    value.language,
    `cases[${index}].language`,
  );
  const expectedNotePaths = readExpectedPaths(value.expectedNotePaths, index);

  const evalCase: EvalCase = {
    id,
    suite,
    query,
    language,
    expectedNotePaths,
  };

  if (value.expectedSectionHints !== undefined) {
    evalCase.expectedSectionHints = readStringArray(
      value.expectedSectionHints,
      `cases[${index}].expectedSectionHints`,
    );
  }

  if (value.mustHaveTags !== undefined) {
    evalCase.mustHaveTags = readStringArray(
      value.mustHaveTags,
      `cases[${index}].mustHaveTags`,
    );
  }

  if (value.filters !== undefined && value.filters !== null) {
    evalCase.filters = readFilters(value.filters, index);
  } else if (value.filters === null) {
    evalCase.filters = null;
  }

  if (typeof value.difficulty === "string") {
    evalCase.difficulty = value.difficulty;
  }

  if (typeof value.queryType === "string") {
    evalCase.queryType = value.queryType;
  }

  if (typeof value.notes === "string") {
    evalCase.notes = value.notes;
  }

  return evalCase;
}

function readSuite(value: unknown, fieldName: string): EvalSuite {
  if (typeof value !== "string" || !VALID_SUITES.has(value as EvalSuite)) {
    throw new Error(
      `${fieldName} muss "examples" oder "production-vault" sein.`,
    );
  }

  return value as EvalSuite;
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} muss ein nicht-leerer String sein.`);
  }

  return value.trim();
}

function readExpectedPaths(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `cases[${index}].expectedNotePaths muss ein nicht-leeres Array sein.`,
    );
  }

  return value.map((entry, pathIndex) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(
        `cases[${index}].expectedNotePaths[${pathIndex}] muss ein nicht-leerer String sein.`,
      );
    }

    return entry.trim().replace(/\\/g, "/");
  });
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} muss ein Array sein.`);
  }

  return value.map((entry, index) =>
    readRequiredString(entry, `${fieldName}[${index}]`),
  );
}

function readFilters(value: unknown, index: number): EvalCase["filters"] {
  if (!value || typeof value !== "object") {
    throw new Error(`cases[${index}].filters muss ein Objekt oder null sein.`);
  }

  const filters = value as Record<string, unknown>;
  const result: NonNullable<EvalCase["filters"]> = {};

  if (filters.domain !== undefined) {
    result.domain = readRequiredString(
      filters.domain,
      `cases[${index}].filters.domain`,
    );
  }

  if (filters.owner !== undefined) {
    result.owner = readRequiredString(
      filters.owner,
      `cases[${index}].filters.owner`,
    );
  }

  if (filters.tags !== undefined) {
    result.tags = readStringArray(filters.tags, `cases[${index}].filters.tags`);
  }

  return result;
}
