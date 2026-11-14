<div align="center">

![Tinker](icon.svg)

# DSH Tinker

A plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Everyday usability upgrades - workspace icons, AI model logos, unread reminders, profile styling, cleaner sidebar.

[![npm](https://img.shields.io/npm/v/dsh-tinker?logo=npm&label=npm)](https://www.npmjs.com/package/dsh-tinker) [![Downloads](https://img.shields.io/npm/d18m/dsh-tinker?logo=npm&label=downloads "Downloads over the last 18 months")](https://www.npmjs.com/package/dsh-tinker) [![MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)

</div>

## Install

1. Open **Plugins / Add plugin**.
2. Select **Official npm registry**.
3. Enter plugin's package name:

   ```text
   dsh-tinker
   ```

4. Click **Install** and enable plugin.

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

## Enable only what you need

Open **Settings / Tinker** to turn features on or off individually. You don't need to enable them all.

## Your settings stay local

- **Local storage.** Appearance and reminders stay in this browser or desktop profile, without cross-device sync.
- **Local profile.** Name and avatar overrides do not change your account; they apply to all accounts using this storage.
- **Saved settings.** Disabling Tinker keeps your preferences. Clearing the profile's storage removes them.

## License

[MIT](LICENSE). Bundled artwork and data notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Brand marks belong to their respective owners; no endorsement is implied.
