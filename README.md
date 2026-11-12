# Tinker

Tinker is a web UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It adds workspace appearance, model logos and manual unread reminders to the existing interface. It does not send model requests or change prompts or credentials.

The latest published npm version is **dsh-tinker 0.1.5**. Local profile customization, the unread keyboard shortcut, grouped Settings, new project icons and current workspace-menu/hover-layout fixes in this checkout are **unreleased development changes**, available in a separately built **Tinker (develop)** package.

## Features

- Independent appearance for each workspace: 36 colored icons, system emoji with English/Russian search, or a local image. The appearance is shared by the sidebar and workspace picker above the prompt.
- Model-lab logos in the model selector, model list and chat rows. Includes DeepSeek, OpenAI/Codex, Anthropic, Google, Kimi, xAI, Mistral, Qwen, Zhipu AI/GLM and MiniMax, including recognized Alibaba routes. Unknown models use a neutral AI icon.
- **Mark as unread** in the chat menu and hover actions. The reminder survives reload until the next observed opening. Native running, warning and completion indicators take precedence. The unreleased **Ctrl+Alt+U** shortcut marks the currently open chat on Windows desktop/web and Linux desktop; macOS and Linux web have no new default. The menu shows the effective host-managed binding, including user changes.
- Hide the sidebar's top branding row and its space while retaining New Session and navigation.
- **Local profile appearance (unreleased):** a custom name and avatar in the bottom-left signed-in profile. Open **Appearance** above **Sign out** in its menu. One additional switch in **Settings / Tinker** enables or disables the feature; the editor exists only in the profile menu.
- Six independent native feature switches, grouped under **Appearance**, **AI model logos** and **Chats** in **Settings / Tinker**; published 0.1.5 has five. English and Russian UI; Chinese currently uses English.

Use **Appearance** in a workspace's menu. The Settings page enables or disables features; it does not open appearance editors. Changes apply with **Save**; **Restore default** only changes the draft until saved. Image uploads accept PNG, JPEG, WebP, GIF and AVIF up to 5 MB and 16 million pixels, stored as a static PNG up to 128 px. No remote image links, SVG or animated output.

Profile customization changes only the local display, not your DeepSeek account. Name and image can be overridden independently. **Reset to DeepSeek account details** changes the draft; **Save** applies it. Signed-out **More** and native sign-in/sign-out actions remain unchanged.

## Install

1. Open **Plugins / Add plugin** in DeepSeek Harness.
2. Enter the exact npm package name **[`dsh-tinker`](https://www.npmjs.com/package/dsh-tinker)**.
3. Review the trust prompt, install and enable the plugin. Restart the application if requested.

See the host's [Plugin Manager instructions](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.md). A newly published npm version may be temporarily unavailable under the host's package-age policy; do not disable that protection globally.

## Requirements and verification status

| Area | Requirement or actual coverage |
| --- | --- |
| Host version | The package declares `>=0.2.0-rc.2 <0.3.0-0`. This is an install range, not a claim that every version was tested. |
| UI adapters | Workspace menus recognize the known Rename/Delete and Rename/Show in folder/Delete patterns through 0.2.2-rc.1. Hover unread actions follow its native 24 px button / 14 px icon geometry. Other model/chat adapters retain their RC.2 targets; the guarded profile adapter targets the 0.2.2-rc.1 account launcher. Later interface changes may require updates. |
| Automated browser tests | Windows, with pinned RC.2 primitives and scoped RC.1 hover/MenuOverlay/SlotOutlet source. Shortcut tests use the exact lower-bound registry and actual current Cordis dependency lifecycle; a separate diagnostic executes the full current native Workspace source path. Controlled navigation/remote services and source-shaped account fixtures are not a complete running Host. |
| Live installation | The owner confirmed Workspace appearance and the unread shortcut in an earlier development package, alongside initial profile/hover checks. The grouped Settings redesign and new project icons still need installed-host testing; offline results are not live GUI verification. |
| Newer core / Codex | Newer core versions and newer Codex Subscription releases are not verified. Model-selector adapters target native RC.2 and Codex Subscription 2.5.2 markup. |
| macOS | Physical Mac not verified. Offline tests cover the native darwin markup branch, not OS window behavior. |
| Unread reminders | Require Web Locks in a secure browser context (HTTPS or loopback). Without it, writes report an error rather than risking lost updates. |
| Runtime | React and native UI primitives are supplied by the host; no separate runtime dependencies are installed by this package. |

Adapters leave unsupported structures unchanged rather than guessing. Full-text search results have different markup and do not receive chat logos. Lab-name heuristics can misidentify custom aliases. Emoji rendering depends on the OS/font.

## Data

Workspace appearance, settings, unread reminders and local profile appearance are stored in the browser or desktop profile for the current origin. Profile appearance is shared across DeepSeek accounts within that storage; it is not account-synchronized. Its separate versioned record is not overwritten by the older workspace settings writer.

Keyboard bindings are managed by the host's shortcut settings and catalog, not a second Tinker binding record.

Uploaded images are saved as self-contained PNG copies, not source-file paths. Deleting the original file after a successful save does not remove the saved image. Disabling or uninstalling the plugin does not intentionally remove saved data; clearing profile storage does.

The recovery download may not include the latest settings. Back up the profile before resetting data. There is no cross-device sync or portable appearance import/export.

## Development

Use Node.js and npm; this release was checked with Node 24.18.0 and npm 11.16.0. Development dependencies are pinned in [package-lock.json](<package-lock.json>).

```sh
npm ci --ignore-scripts
npm run check
```

`check` runs the build, Node unit tests and Playwright browser tests. Browser tests default to installed Microsoft Edge. On systems without Edge, install the existing pinned browser with `npx playwright install chromium` and set `WSP_BROWSER_CHANNEL=chromium` before running the tests. Fixtures are isolated browser pages; they do not connect to a running DSH GUI or call models.

### Local development package

```sh
npm run pack:dev
```

This builds a fresh **Tinker (develop)** archive and a hash/provenance file under `dist/develop/`, without changing the stable package identity or publishing anything. The development package uses the separate technical name `dsh-tinker-develop` but shares local preferences with compatible Tinker versions.

1. Build the archive, then add that local archive through the host's Plugin Manager **without enabling it**.
2. Turn off the stable **Tinker** bundle and wait for it to stop. Then enable **Tinker (develop)**; restart if requested.
3. Test the changes. To return, disable **Tinker (develop)** before enabling stable **Tinker**.

Never enable both bundles together: their historical Cordis row and UI namespaces are shared. Switching code versions does not restore an earlier copy of settings. Browser fixtures do not verify this installed-host transition.

## License

[MIT](<LICENSE>). Bundled icon, provider-mark and Unicode data notices are in [THIRD_PARTY_NOTICES.md](<THIRD_PARTY_NOTICES.md>). Brand marks belong to their respective owners; no endorsement is implied.
