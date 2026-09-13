#!/usr/bin/env node

import { resolve } from "node:path";

import { runFullReindex } from "./indexer.js";

interface CliArgs {
  command: string;
  vaultDir: string;
  dbPath: string;
  jsonOutput: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command !== "reindex") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const summary = await runFullReindex({
    vaultDir: args.vaultDir,
    dbPath: args.dbPath,
    pruneMissing: true,
  });

  if (args.jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("Wiki-Indexer Full Reindex abgeschlossen");
    console.log(`Vault: ${resolve(args.vaultDir)}`);
    console.log(`DB: ${summary.dbPath}`);
    console.log(`Gescannt: ${summary.scannedNotes}`);
    console.log(`Indexiert: ${summary.indexedNotes}`);
    console.log(`Uebersprungen (Hash unveraendert): ${summary.skippedNotes}`);
    console.log(`Entfernt (nicht mehr vorhanden): ${summary.removedNotes}`);
    console.log(`Neue Chunks: ${summary.chunkCount}`);
    console.log(`Fehler: ${summary.errorCount}`);

    if (summary.errors.length > 0) {
      console.log("Fehlerdetails:");
      for (const error of summary.errors) {
        console.log(`- ${error.path}: ${error.message}`);
      }
    }
  }

  if (summary.errorCount > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(rawArgs: string[]): CliArgs {
  const command = rawArgs[0] ?? "reindex";
  const rest = rawArgs.slice(1);

  const vaultArg = getOption(rest, "--vault");
  const dbArg = getOption(rest, "--db");
  const jsonOutput = rest.includes("--json");

  return {
    command,
    vaultDir: vaultArg ?? process.cwd(),
    dbPath: dbArg ?? ".knowledge-vault/index.sqlite",
    jsonOutput,
  };
}

function getOption(args: string[], optionName: string): string | null {
  const index = args.indexOf(optionName);
  if (index < 0) {
    return null;
  }

  return args[index + 1] ?? null;
}

function printUsage(): void {
  console.log(
    "Verwendung: knowledge-vault-indexer reindex [--vault <path>] [--db <path>] [--json]",
  );
}

void main().catch((error) => {
  console.error("Reindex fehlgeschlagen:", error);
  process.exitCode = 1;
});
