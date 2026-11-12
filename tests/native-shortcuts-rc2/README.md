# Portable native shortcut contract fixtures

Test-only exact sources from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
[dsh-v0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2), immutable commit
[639ed015397290b3745d163aafe02ffee4aa3f84](https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84).
The native registry, physical binding policy, configuration validator, DOM dispatcher and types are
unmodified. `provenance.json` records each original URL, byte count and SHA256. The upstream MIT
license is included. No native sources are downloaded during the default test run.

`runtime/cordis.js` and `runtime/cosmokit.js` are exact installed 0.2.2-rc.1 program bundles, build
`c59d10aff167ad7eefead4b3a9082fb57c8fbfe8`. Their archive entries and hashes are in
`runtime/provenance.json`; their original Shigma MIT licenses and immutable license provenance
accompany them. These portable copies exercise actual `Context`/`ctx.inject` service dependency,
withdrawal, reprovide and parent-disposal behavior, not a handwritten lifecycle mock.

`../unread-shortcut-host.js` supplies only explicit boundary adapters: snapshot storage uses the
product's synchronous observable store; UUID uses the test runtime's crypto; `assertNever` throws.
`../unread-shortcut-primitives.js` reexports the existing exact native RC.2 primitives plus their
modal selector. Native registration, conflict resolution, validation, keyboard dispatch, composition
tracking, MenuItemButton markup and keycap formatting are not rewritten.

The browser fixture uses the actual DOM dispatcher and registry. Desktop cases exercise its
priority policy after DOM delivery, not Electron physical interception, OS shortcut delivery or a
live Harness profile. Slot discovery, Session data and resource providers are isolated fixtures.
All fixture imports are repository-relative; default tests require no personal installation paths,
archive extraction, network access, dependency installation or new packages. These test sources
must not enter the production bundle or package.
