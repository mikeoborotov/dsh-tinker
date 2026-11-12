# Exact optional Settings slot lifecycle fixture

Unmodified sources from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
[dsh-v0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2), immutable
[639ed015397290b3745d163aafe02ffee4aa3f84](https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84).
`provenance.json` records exact source URLs, byte counts and hashes. The original MIT license is included.

The real SlotCore and SlotRegistry are bundled only in memory by the Settings unit test, with the
existing portable actual Cordis/Cosmokit runtime from `../native-shortcuts-rc2/runtime/` and its licenses.
No runtime bodies are rewritten and no slot lifecycle is mocked. The test executes the production
optional icon registration call against the actual registry: absent old-host seat, late declaration,
collapse/redeclare, caller disposal, pending cancellation and current 16px owner props.

The public Switch sources and stylesheet are exact lower-bound files in `../native-rc2/`, with their
additional `switch-files.json` provenance; the native primitive alias reexports that implementation.
All inputs are repository-relative, offline and test-only. No installed ASAR, personal profile, network,
additional dependency or live Harness is needed by default CI. These sources never enter the package.
