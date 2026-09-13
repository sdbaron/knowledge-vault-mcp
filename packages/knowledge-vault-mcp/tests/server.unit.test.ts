import { describe, expect, it } from "@jest/globals";

import { VAULT_TOOLS } from "../src/tools.js";

describe("VAULT_TOOLS metadata", () => {
  it("enthaelt alle geforderten Tool-Namen", () => {
    const names = VAULT_TOOLS.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "vault_search",
        "vault_get_note",
        "vault_backlinks",
        "vault_reindex",
      ]),
    );
  });
});
