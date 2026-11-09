# dsh-tinker

Tinker 0.1.5 is a web UI plugin for DeepSeek Harness. Source is in `src/`; `client.js` is generated and tracked. React and native UI primitives come from the host. Do not add runtime dependencies for this release.

## Branches and permissions

- Work in `develop`; `master` is the stable branch.
- Merge to `master`, create release tags/GitHub Releases and publish to npm only on the owner's explicit command. Completing a task is not release permission.
- Push product code only with explicit consent for that push. Never force-push without separate consent.
- Write commit messages in English: concise and factual, without filler, session details or AI credits.

## Compatibility and data

- The adapters and offline native fixture target DSH 0.2.0-rc.2. A newer core and a physical Mac need separate verification.
- Preserve `dsh-workspace-plus:v1`, `dsh-workspace-plus:v1:legacy-backup`, `dsh-workspace-plus:unread:v1`, the unread Web Lock/event contract and workspace/session IDs. Do not rename saved data as branding work.
- Cordis instance ID `workspace-plus` and internal slot/locale/DOM namespaces are compatibility identities, not display names. Package, patch module name and generated client factory ID must all be `dsh-tinker`.
- Never run host verification scripts against a working user profile. Use an explicitly designated disposable test profile; offline browser fixtures do not prove installed-host compatibility.

## Build and checks

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run test:browser
npm run check
```

`check` builds, runs Node unit tests and runs Playwright. Browser tests default to installed Microsoft Edge. To use the pinned Playwright Chromium, run `npx playwright install chromium` and set `WSP_BROWSER_CHANNEL=chromium`. Dependencies are pinned in `package-lock.json`; do not upgrade them as test setup. Commit regenerated `client.js` with source changes.

## Minimal public release

There is no CI release workflow yet. After owner approval:

1. Check `npm run check`, metadata, version 0.1.5 and the minimal English README. Preserve any older local tarballs.
2. Build and create a distinct `dsh-tinker-0.1.5.tgz` with `npm pack --ignore-scripts --pack-destination dist`; inspect its actual files, licenses and identity. No personal paths, secrets or test artifacts belong in the package.
3. Merge the approved changes to `master` and release the same reviewed commit/version to GitHub and npm, with the owner's authentication. Do not overwrite an existing tag or published name/version.
4. Verify published metadata and installation in a disposable profile. Disable the old Workspace Plus bundle before enabling Tinker; keep raw data backups and do not silently change a working profile.
