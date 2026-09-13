import { validateVaultFrontmatter } from "../src/index.js";

describe("validateVaultFrontmatter", () => {
  it("accepts the minimal portable vault contract", () => {
    expect(
      validateVaultFrontmatter({
        title: "A note",
        tags: [],
        domain: "general",
        owner: "unassigned",
        updated_at: "2026-09-10",
        aliases: [],
      }),
    ).toEqual({ valid: true, errors: [] });
  });
});
