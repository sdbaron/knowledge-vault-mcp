# Definition of Done

A change is done when all of the following hold:

1. **Boundaries** — Imports and dependencies match [../architecture/package-boundaries.md](../architecture/package-boundaries.md) and [../../architecture/package-boundaries.json](../../architecture/package-boundaries.json). No new relative imports across packages.
2. **Public API** — New exported symbols are added to the package `src/index.ts` (or documented CLI/bin) and, when they are part of the supported surface, to [../../architecture/public-apis.json](../../architecture/public-apis.json).
3. **Docs / ADRs** — Behavior or boundary changes update architecture docs or add/amend an ADR under [../decisions/](../decisions/).
4. **Quality gates** — `pnpm build`, `pnpm lint`, and `pnpm test` pass on Node 22+.
5. **Release hygiene** (only when publishing) — All three package versions match the `v*` tag; `exports` still include `"."` and `"./package.json"`; workspace pins use `workspace:X.Y.Z`.
