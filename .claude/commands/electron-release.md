Release a new version of the Electron desktop app.

## Steps

1. Read `electron/package.json` to get the current version
2. Ask the user what the new version should be (or bump patch by default)
3. Update the version in `electron/package.json`
4. Commit the version bump: `git add electron/package.json && git commit -m "Bump Electron to v<NEW_VERSION>"`
5. Push: `git push origin main`
6. Create and push the tag: `git tag v<NEW_VERSION> && git push origin v<NEW_VERSION>`
7. This triggers the GitHub Actions workflow `.github/workflows/electron-release.yml` which:
   - Builds the Windows `.exe` (NSIS installer) on `windows-latest`
   - Builds the macOS `.dmg` on `macos-latest`
   - Creates a GitHub Release and uploads both installers + `latest.yml`
8. Wait for the workflow to complete, then confirm the release is **published** (not draft):
   `gh release view v<NEW_VERSION> --json isDraft --jq '.isDraft'` — must return `false`.
   If it returns `true`, publish it: `gh release edit v<NEW_VERSION> --draft=false`
9. Existing installations auto-detect the update on next app launch

If the user wants to build locally instead of via CI:
- Windows: `cd electron && GH_TOKEN=<token> npm run build:publish:win`
- macOS: `cd electron && GH_TOKEN=<token> npm run build:publish:mac`
- Both: `cd electron && GH_TOKEN=<token> npm run build:publish`

Key files:
- `electron/package.json` - version + build config + publish config (GitHub provider: rabeehzaman/biz_arch_erp)
- `electron/main.js` - auto-updater logic (checks on startup, prompts user to download/install)
- `.github/workflows/electron-release.yml` - CI/CD pipeline triggered by `v*` tags
