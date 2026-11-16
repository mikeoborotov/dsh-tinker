# Native hover contract: 0.2.2-rc.1

Portable test-only slices of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), build `c59d10aff167ad7eefead4b3a9082fb57c8fbfe8`.

- [workspace.js](<workspace.js>): exact SessionNodeItem and its row helpers/CSS, ArchiveSessionRowButton, PinSessionRowButton. Native controls use a 24px button, -4px footprint margins and 14px SVG viewport.
- [primitives.js](<primitives.js>): current Tooltip, StateDot, default icon renderer/artwork, and theme sprite installer. The ownership slot retains the native `display:contents` layout contract.
- [baseline.css](<baseline.css>): current web reset, Tooltip/StateDot rules and keyframes, global theme sheets and sidebar CSS.
- [provenance.json](<provenance.json>): original software hashes, generated slice hashes and explicit omissions.

HoverCard preview, drag transport, relative-time formatting and shortcut labels are deliberately omitted. MenuItemButton/Toast reuse the existing supported RC.2 public fixtures. These tests exercise the production unread component against a current native source contract; they do not claim live-host, user-theme, physical-device or installed-plugin acceptance.

[build-fixture.mjs](<build-fixture.mjs>) uses only repository files and already-installed test dependencies. It verifies the slice hashes and performs an in-memory build. No ASAR, user profile, external service or private filesystem path is needed in CI.

To refresh the captures, set `T149_NATIVE_EVIDENCE_DIR` to a directory containing public RC.1 software extracts and run `node tests/native-hover-rc1/capture.mjs`. [capture.mjs](<capture.mjs>) verifies all original hashes before writing. Regeneration is a maintainer operation, never a test setup step.

Upstream MIT notices: [DeepSeek](<LICENSE>) and [clsx](<clsx-LICENSE>).
