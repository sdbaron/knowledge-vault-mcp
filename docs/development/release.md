# Release

## Versioning

All three packages share the same version for a release. Internal deps use `workspace:X.Y.Z` so pnpm links locally and publishes the exact version.

## Publish path

1. Merge to `main`.
2. Ensure every non-private package `version` equals `X.Y.Z`.
3. Tag and push:

   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. `.github/workflows/release.yml` installs, checks tag vs versions, builds, tests, and runs `pnpm -r publish` to `https://npm.pkg.github.com` with `GITHUB_TOKEN`.

Do not publish from a laptop unless you intend a special recovery. Creating a GitHub Release from an already-pushed tag does not publish again.

## Consumer auth

See the root README. Cross-owner consumers (for example SergeyLC/Tagesberichte) need a PAT with `read:packages`; package Actions access only lists repos under `sdbaron`.
