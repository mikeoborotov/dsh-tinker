![Tinker](icon.svg)

# Tinker

---

Workspace appearance, model logos, manual unread reminders and sidebar branding.

[![npm version](https://img.shields.io/npm/v/dsh-tinker)](https://www.npmjs.com/package/dsh-tinker)
[![Downloads over the last 18 months](https://img.shields.io/npm/d18m/dsh-tinker?label=downloads%2F18mo)](https://www.npmjs.com/package/dsh-tinker)
[![MIT license](https://img.shields.io/npm/l/dsh-tinker)](LICENSE)

A web UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Make the interface yours without changing prompts, model requests or credentials.

## Install

1. Open **Plugins / Add plugin** in DeepSeek Harness.
2. Enter **[`dsh-tinker`](https://www.npmjs.com/package/dsh-tinker)** and install it.
3. Enable the plugin. Restart only if the application asks you to.

Requires DeepSeek Harness `>=0.2.0-rc.2 <0.3.0-0`.

## Features

### Workspace appearance

Give each workspace its own color and icon, emoji or image. The same appearance follows it in the sidebar and workspace picker. Open **Appearance** from the workspace menu.

### Account appearance

Set a local display name and avatar from **Appearance** in the bottom-left account menu. Name and image are independent; reset either to the native account details. This changes the local interface, not your DeepSeek account.

### Model logos

Recognize model labs in the composer, model list and chat rows, including supported subscription and routed models. Unknown or ambiguous models keep a neutral AI icon instead of a guessed brand.

### Manual unread reminders

Mark a chat as unread from its menu, hover action or the host-managed shortcut. The reminder survives reload until the chat is opened again. Native running, warning and completion indicators take precedence.

### Cleaner sidebar

Hide the top branding row and its empty space while keeping **New Session** and navigation.

Manage features independently in **Settings / Tinker**. The interface is available in English and Russian.

## Local data

Appearance and reminders are stored in the current browser or desktop profile, not synchronized across devices. Uploaded images are stored as static PNG copies. Profile appearance is shared by accounts using that local storage.

Disabling or uninstalling the plugin does not intentionally erase saved preferences; clearing the profile storage does. Adapters leave unsupported menu structures unchanged rather than guessing.

## License

[MIT](LICENSE). Bundled artwork and data notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Brand marks belong to their respective owners; no endorsement is implied.
