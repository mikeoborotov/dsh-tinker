# Exact native DSH RC.2 test fixture

Test-only copies from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), tag
[dsh-v0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2), commit
[639ed015397290b3745d163aafe02ffee4aa3f84](https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84).
Downloaded from immutable commit URLs, not `main`. Every copied source is byte-identical;
upstream paths, imports, behavior, CSS, and copyright notices are unchanged.

[clsx](https://github.com/lukeed/clsx) is frozen at
[v2.1.1](https://github.com/lukeed/clsx/tree/v2.1.1), commit
[925494cf31bcd97d3337aacd34e659e80cae7fe2](https://github.com/lukeed/clsx/commit/925494cf31bcd97d3337aacd34e659e80cae7fe2).
That version is the exact native lockfile resolution. Both projects are MIT licensed:
[DSH license](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/LICENSE),
[clsx license](https://github.com/lukeed/clsx/blob/925494cf31bcd97d3337aacd34e659e80cae7fe2/license).
The complete license texts accompany the copies.

```text
LICENSE                           DeepSeek MIT notice, unmodified
vendor/clsx/license               Luke Edwards MIT notice, unmodified
source-files.json                 Immutable download URL, byte count, SHA256 for every copy
packages/client/ui-primitives/    Exact Modal, Button, Menu, StateDot, Tooltip, Toast, icon/helper graph
packages/client/ui-sidebar/       Exact SidebarRoot and its stylesheet
packages/client/ui-theme/         Exact relevant native global token and scrollbar sheets
packages/client/web/              Exact global shell reset and platform rules
```

The primitive graph excludes unrelated Markdown/math exports. The test alias reexports
real Modal/Button/Menu/MenuItemButton/StateDot/Tooltip/Toast and required icons/helpers;
input modality uses the native initializer. React and React DOM use existing test packages;
clsx uses its exact vendored source. Native source interaction logic is not rewritten.
[The sidebar fixture](<../sidebar-fixture.jsx>) renders real SidebarRoot and reproduces
native data-slot anchors, ascending single-slot priority and an official priority0 name.
SessionRow/nativeStatus/openSession and Cordis inject/effect lifecycle are hand-written
stand-ins, not native integration coverage. [The builder](<../build-fixture.mjs>) substitutes
three absent build-version constants at compile time rather than adding runtime process
or platform stubs. [The pinned graph tool](<../../scripts/vendor-native-extra.mjs>) adds only
missing commit-pinned files with `--download`; `--check` validates every manifest byte/hash
without a network. No additional packages are installed by the tool.

The fixture builder compiles native CSS Modules with esbuild and separately concatenates
the unchanged shell/theme global sheets. Light is the native default; dark uses
`body[data-ds-dark-theme]`, not a test-specific palette. Native radii, elevation, typography,
focus presentation, reduced-motion guards, corner smoothing, and scrollbar guards remain
intact. Unrelated onboarding/syntax-highlighting/official brand-font sheets are excluded.
Windows and darwin HTML flags exercise stylesheet branches in Chromium, not real caption
controls, dragging, vibrancy, traffic lights, or physical OS window chrome.

```js
import { buildFixture } from './build-fixture.mjs';
const { js, css } = await buildFixture();
// After loading the routed fixture document:
await page.addStyleTag({ content: css });
await page.addScriptTag({ content: js });
```

Keep these copies test-only. Production imports the public host-shared primitives module
as an esbuild external and receives native styles from the DSH shell. Do not import this
fixture into production or include it in the distributed package.
