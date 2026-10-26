import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packages = [
  "knowledge-vault-contract",
  "knowledge-vault-indexer",
  "knowledge-vault-mcp",
];

describe("published package.json exports", () => {
  it("lets an outside consumer resolve each package.json from the packed tarball", () => {
    const work = mkdtempSync(join(tmpdir(), "kv-exports-"));
    try {
      const scopeDir = join(work, "node_modules", "@sdbaron");
      mkdirSync(scopeDir, { recursive: true });

      for (const directory of packages) {
        const packed = packPackage(join(work, "packs", directory), directory);
        const extracted = join(work, "extract", directory);
        mkdirSync(extracted, { recursive: true });
        execFileSync("tar", ["-xzf", packed, "-C", extracted]);
        execFileSync("mv", [
          join(extracted, "package"),
          join(scopeDir, directory),
        ]);
      }

      const consumer = join(work, "consumer.cjs");
      writeFileSync(consumer, "");
      const require = createRequire(consumer);

      for (const directory of packages) {
        const name = `@sdbaron/${directory}`;
        const resolved = require.resolve(`${name}/package.json`);
        const manifest = JSON.parse(readFileSync(resolved, "utf8")) as {
          name: string;
          version: string;
          exports: Record<string, unknown>;
          dependencies?: Record<string, string>;
        };

        expect(resolved.endsWith(`${directory}/package.json`)).toBe(true);
        expect(manifest.name).toBe(name);
        expect(manifest.version).toBe("0.1.1");
        expect(manifest.exports["./package.json"]).toBe("./package.json");
      }

      const indexer = JSON.parse(
        readFileSync(
          join(scopeDir, "knowledge-vault-indexer", "package.json"),
          "utf8",
        ),
      ) as { dependencies: Record<string, string> };
      expect(indexer.dependencies["@sdbaron/knowledge-vault-contract"]).toBe(
        "0.1.1",
      );
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

function packagesRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function packPackage(destination: string, directory: string): string {
  mkdirSync(destination, { recursive: true });
  execFileSync("pnpm", ["pack", "--pack-destination", destination], {
    cwd: join(packagesRoot(), directory),
    stdio: "pipe",
  });
  const tarballs = readdirSync(destination).filter((name) =>
    name.endsWith(".tgz"),
  );
  if (tarballs.length !== 1) {
    throw new Error(`Expected one tarball in ${destination}, got ${tarballs}`);
  }
  return join(destination, tarballs[0] as string);
}
