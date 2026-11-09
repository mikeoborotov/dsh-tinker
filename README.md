# Tinker

**dsh-tinker 0.1.5** is a web UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), previously distributed from this repository as local Workspace Plus bundles/archives. It adds workspace appearance, model logos and manual unread reminders to the existing interface. It does not send model requests or change prompts or credentials.

## Features

- Independent appearance for each workspace: 36 colored icons, system emoji with English/Russian search, or a local image. The appearance is shared by the sidebar and workspace picker above the prompt.
- Model-lab logos in the model selector, model list and chat rows. Includes DeepSeek, OpenAI/Codex, Anthropic, Google, Kimi, xAI, Mistral, Qwen, Zhipu AI/GLM and MiniMax, including recognized Alibaba routes. Unknown models use a neutral AI icon.
- **Mark as unread** in the chat menu and hover actions. The reminder survives reload until the next observed opening. Native running, warning and completion indicators take precedence.
- Hide the sidebar's top branding row and its space while retaining New Session and navigation.
- Five independent feature switches in **Settings / Tinker**. English and Russian UI; Chinese currently uses English.

Use **Appearance** in a workspace's menu or choose a workspace in **Settings / Tinker**. Changes apply with **Save**; **Restore default** only changes the draft until saved. Image uploads accept PNG, JPEG, WebP, GIF and AVIF up to 5 MB and 16 million pixels, stored as a static PNG up to 128 px. No remote image links, SVG or animated output.

## Install

1. Open **Plugins / Add plugin** in DeepSeek Harness.
2. Enter the exact npm package name **`dsh-tinker`**.
3. Review the trust prompt, install and enable the plugin. Restart the application if requested.

For a local release archive, select `dsh-tinker-0.1.5.tgz` instead. Follow the host's [Plugin Manager instructions](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.md). A newly published npm version may be temporarily unavailable under the host's package-age policy; do not disable that protection globally.

If one of this repository's local Workspace Plus bundles is already installed, follow the migration steps below **before enabling Tinker**. Never run both copies together.

## Requirements and verification status

| Area | Requirement or actual coverage |
| --- | --- |
| Host version | The package declares `>=0.2.0-rc.2 <0.3.0-0`. This is an install range, not a claim that every version was tested. |
| UI adapters | Target DSH 0.2.0-rc.2 markup. Later core/interface changes may require updated adapters. |
| Automated browser tests | Windows, using exact vendored RC.2 Modal/Button/Menu/StateDot/Toast and SidebarRoot sources. Session rows, navigation and Cordis lifecycle are fixture stand-ins. |
| Live installation | The rebranded 0.1.5 package has not yet been verified in an installed host. Offline fixture results are not live GUI verification. |
| Newer core / Codex | Newer core versions and newer Codex Subscription releases are not verified. Model-selector adapters target native RC.2 and Codex Subscription 2.5.2 markup. |
| macOS | Physical Mac not verified. Offline tests cover the native darwin markup branch, not OS window behavior. |
| Unread reminders | Require Web Locks in a secure browser context (HTTPS or loopback). Without it, writes report an error rather than risking lost updates. |
| Runtime | React and native UI primitives are supplied by the host; no separate runtime dependencies are installed by this package. |

Adapters leave unsupported structures unchanged rather than guessing. Full-text search results have different markup and do not receive chat logos. Older lab-name heuristics can misidentify custom aliases. Emoji rendering depends on the OS/font. There is no cross-device sync or portable appearance import/export.

## Migrating from this repository's local Workspace Plus builds

These steps apply only to local Workspace Plus bundles/archives from this repository, including releases older than 0.1.5. Tinker is not a rebrand or continuation of the separate public npm package [dsh-workspace-plus](https://www.npmjs.com/package/dsh-workspace-plus).

1. Disable this repository's old local Workspace Plus bundle. Keep its archive and back up the relevant browser/desktop profile before changing the installation. Do not enable both package names at once: they share data and host identities.
2. Save the **raw values of all three keys below**, including a missing value as missing. The recovery download alone is not a complete current-state backup: it may prefer the pre-upgrade legacy copy.
3. Install and test Tinker in a disposable profile first. To test existing settings, use a backed-up copy of the same profile/origin; a fresh profile has no existing data. Do not experiment with the working profile's storage.
4. After verification, replace the old installation using the host's normal plugin procedure, restart as needed and enable only Tinker in the original profile. Disabling/uninstalling the code does not intentionally remove saved data; clearing browser/profile data does.

Historical keys are intentionally unchanged:

- `dsh-workspace-plus:v1` - current appearance/settings schema version 2, despite the historical key suffix.
- `dsh-workspace-plus:v1:legacy-backup` - exact pre-upgrade schema-1 bytes, if migration occurred. Not the latest settings.
- `dsh-workspace-plus:unread:v1` - manual unread reminders; also the Web Lock name.

The event `workspace-plus:unread-change`, Cordis instance ID `workspace-plus` and internal locale/slot/DOM identifiers also remain unchanged for compatibility. Package name, patch module name and compiled factory ID are `dsh-tinker`; workspace and session IDs are not renamed.

Schema-1 appearances migrate once, preserving the original bytes before replacing the main value. Invalid data, quota errors or a conflicting legacy backup stop migration instead of discarding data. **0.1.4 and older cannot read schema 2**: downgrading requires separately saved, valid schema-1 data and loses changes made after that snapshot. Save copies before any reset or rollback.

## Development

Use Node.js and npm; this release was checked with Node 24.18.0 and npm 11.16.0. Development dependencies are pinned in [package-lock.json](<package-lock.json>).

```sh
npm ci --ignore-scripts
npm run check
```

`check` runs the build, Node unit tests and Playwright browser tests. Browser tests default to installed Microsoft Edge. On systems without Edge, install the existing pinned browser with `npx playwright install chromium` and set `WSP_BROWSER_CHANNEL=chromium` before running the tests. Fixtures are isolated browser pages; they do not connect to a running DSH GUI or call models.

After a successful build, create a local archive with:

```sh
npm pack --ignore-scripts --pack-destination dist
```

Work happens on `develop`; `master` is stable. Merge, tags, GitHub Release and npm publication require an explicit owner command; there is no release CI yet. The generated client bundle must accompany source changes. See [AGENTS.md](<AGENTS.md>) for the project guide in a source checkout.

## License

[MIT](<LICENSE>). Bundled icon, provider-mark and Unicode data notices are in [THIRD_PARTY_NOTICES.md](<THIRD_PARTY_NOTICES.md>). Brand marks belong to their respective owners; no endorsement is implied.
