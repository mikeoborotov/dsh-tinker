# Tinker

**dsh-tinker 0.1.5** is a web UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It adds workspace appearance, model logos and manual unread reminders to the existing interface. It does not send model requests or change prompts or credentials.

## Features

- Independent appearance for each workspace: 36 colored icons, system emoji with English/Russian search, or a local image. The appearance is shared by the sidebar and workspace picker above the prompt.
- Model-lab logos in the model selector, model list and chat rows. Includes DeepSeek, OpenAI/Codex, Anthropic, Google, Kimi, xAI, Mistral, Qwen, Zhipu AI/GLM and MiniMax, including recognized Alibaba routes. Unknown models use a neutral AI icon.
- **Mark as unread** in the chat menu and hover actions. The reminder survives reload until the next observed opening. Native running, warning and completion indicators take precedence.
- Hide the sidebar's top branding row and its space while retaining New Session and navigation.
- Five independent feature switches in **Settings / Tinker**. English and Russian UI; Chinese currently uses English.

Use **Appearance** in a workspace's menu or choose a workspace in **Settings / Tinker**. Changes apply with **Save**; **Restore default** only changes the draft until saved. Image uploads accept PNG, JPEG, WebP, GIF and AVIF up to 5 MB and 16 million pixels, stored as a static PNG up to 128 px. No remote image links, SVG or animated output.

## Install

1. Open **Plugins / Add plugin** in DeepSeek Harness.
2. Enter the exact npm package name **[`dsh-tinker`](https://www.npmjs.com/package/dsh-tinker)**.
3. Review the trust prompt, install and enable the plugin. Restart the application if requested.

See the host's [Plugin Manager instructions](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.md). A newly published npm version may be temporarily unavailable under the host's package-age policy; do not disable that protection globally.

## Requirements and verification status

| Area | Requirement or actual coverage |
| --- | --- |
| Host version | The package declares `>=0.2.0-rc.2 <0.3.0-0`. This is an install range, not a claim that every version was tested. |
| UI adapters | Target DSH 0.2.0-rc.2 markup. Later core/interface changes may require updated adapters. |
| Automated browser tests | Windows, using exact vendored RC.2 Modal/Button/Menu/StateDot/Toast and SidebarRoot sources. Session rows, navigation and Cordis lifecycle are fixture stand-ins. |
| Live installation | The 0.1.5 package has not been verified in an installed host. Offline fixture results are not live GUI verification. |
| Newer core / Codex | Newer core versions and newer Codex Subscription releases are not verified. Model-selector adapters target native RC.2 and Codex Subscription 2.5.2 markup. |
| macOS | Physical Mac not verified. Offline tests cover the native darwin markup branch, not OS window behavior. |
| Unread reminders | Require Web Locks in a secure browser context (HTTPS or loopback). Without it, writes report an error rather than risking lost updates. |
| Runtime | React and native UI primitives are supplied by the host; no separate runtime dependencies are installed by this package. |

Adapters leave unsupported structures unchanged rather than guessing. Full-text search results have different markup and do not receive chat logos. Lab-name heuristics can misidentify custom aliases. Emoji rendering depends on the OS/font.

## Data

Workspace appearance, settings and unread reminders are stored in the browser or desktop profile for the current origin. Disabling or uninstalling the plugin does not intentionally remove saved data; clearing profile storage does.

The recovery download may not include the latest settings. Back up the profile before resetting data. There is no cross-device sync or portable appearance import/export.

## Development

Use Node.js and npm; this release was checked with Node 24.18.0 and npm 11.16.0. Development dependencies are pinned in [package-lock.json](<package-lock.json>).

```sh
npm ci --ignore-scripts
npm run check
```

`check` runs the build, Node unit tests and Playwright browser tests. Browser tests default to installed Microsoft Edge. On systems without Edge, install the existing pinned browser with `npx playwright install chromium` and set `WSP_BROWSER_CHANNEL=chromium` before running the tests. Fixtures are isolated browser pages; they do not connect to a running DSH GUI or call models.

## License

[MIT](<LICENSE>). Bundled icon, provider-mark and Unicode data notices are in [THIRD_PARTY_NOTICES.md](<THIRD_PARTY_NOTICES.md>). Brand marks belong to their respective owners; no endorsement is implied.
