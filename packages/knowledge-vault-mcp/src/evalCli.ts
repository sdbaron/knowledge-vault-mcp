#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  formatReportJson,
  formatReportMarkdown,
  formatStdoutSummary,
} from "./eval/formatReport.js";
import { parseSuite, runEval } from "./eval/runEval.js";
import type { EvalSuite } from "./eval/types.js";

interface EvalCliArgs {
  casesPath: string;
  dbPath: string;
  vaultDir: string;
  suite?: EvalSuite | "all";
  k?: number;
  reindex: boolean;
  outPath?: string;
  markdownPath?: string;
  label: string;
  jsonStdout: boolean;
  failOnEmptyDb: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await runEval({
    casesPath: args.casesPath,
    dbPath: args.dbPath,
    vaultDir: args.vaultDir,
    suite: args.suite,
    k: args.k,
    reindex: args.reindex,
    label: args.label,
    failOnEmptyDb: args.failOnEmptyDb,
  });

  const json = formatReportJson(report);

  if (args.outPath) {
    await ensureParentDir(args.outPath);
    await writeFile(args.outPath, json, "utf8");
  }

  if (args.markdownPath) {
    await ensureParentDir(args.markdownPath);
    await writeFile(args.markdownPath, formatReportMarkdown(report), "utf8");
  }

  if (args.outPath && !args.jsonStdout) {
    console.log(formatStdoutSummary(report));
    if (args.markdownPath) {
      console.log(`Markdown: ${args.markdownPath}`);
    }
    console.log(`JSON: ${args.outPath}`);
    return;
  }

  if (args.jsonStdout || !args.outPath) {
    process.stdout.write(json);
  }
}

function parseArgs(rawArgs: string[]): EvalCliArgs {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const casesPath = getRequiredOption(rawArgs, "--cases");
  const dbPath = getRequiredOption(rawArgs, "--db");
  const vaultDir = getRequiredOption(rawArgs, "--vault");
  const suiteOption = getOption(rawArgs, "--suite");
  const kOption = getOption(rawArgs, "--k");
  const outPath = getOption(rawArgs, "--out") ?? undefined;
  const markdownPath = getOption(rawArgs, "--markdown") ?? undefined;
  const label = getOption(rawArgs, "--label") ?? "naive";

  let suite: EvalSuite | "all" | undefined;
  if (suiteOption) {
    suite = parseSuite(suiteOption);
  }

  let k: number | undefined;
  if (kOption) {
    const parsed = Number.parseInt(kOption, 10);
    if (Number.isNaN(parsed)) {
      throw new Error("--k muss eine Ganzzahl sein.");
    }
    k = parsed;
  }

  return {
    casesPath: resolve(casesPath),
    dbPath: resolve(dbPath),
    vaultDir: resolve(vaultDir),
    suite,
    k,
    reindex: rawArgs.includes("--reindex"),
    outPath: outPath ? resolve(outPath) : undefined,
    markdownPath: markdownPath ? resolve(markdownPath) : undefined,
    label,
    jsonStdout: rawArgs.includes("--json"),
    failOnEmptyDb: !rawArgs.includes("--allow-empty-db"),
  };
}

function getOption(args: string[], optionName: string): string | null {
  const index = args.indexOf(optionName);
  if (index < 0) {
    return null;
  }

  return args[index + 1] ?? null;
}

function getRequiredOption(args: string[], optionName: string): string {
  const value = getOption(args, optionName);
  if (!value) {
    throw new Error(`Pflichtoption fehlt: ${optionName}`);
  }

  return value;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function printUsage(): void {
  console.log(`Verwendung:
  wiki-eval --cases <path> --db <path> --vault <path> [Optionen]

Optionen:
  --suite examples|production-vault|all   Nur Cases dieser Suite (Default: all)
  --k <number>                            Top-k fuer search (Default: 10)
  --reindex                               Vault vor Eval neu indexieren
  --out <path>                            JSON-Report schreiben
  --markdown <path>                       Markdown-Report schreiben
  --label <name>                          Algorithmus-Label (Default: naive)
  --json                                  JSON auf stdout (sonst Kurzsummary wenn --out gesetzt)
  --allow-empty-db                        Kein Fehler bei leerer notes-Tabelle
  --help                                  Diese Hilfe

Beispiel:
  pnpm -C packages/knowledge-vault-mcp eval -- \\
    --cases docs/wiki-llm-obsidian/eval/cases.json \\
    --suite examples \\
    --vault examples/vault \\
    --db .knowledge-vault/index.sqlite \\
    --reindex --k 10 \\
    --out docs/wiki-llm-obsidian/eval/results/run-examples.json
`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Eval fehlgeschlagen: ${message}`);
  process.exitCode = 1;
});
