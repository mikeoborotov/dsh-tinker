/** Known model-slot DOM contracts: native DSH RC.2 and Codex Subscription 2.5.2. */
export function composerBoundary(marker) {
  const scopes = [];
  for (let el = marker.parentElement, depth = 0; el && depth < 4; el = el.parentElement, depth++) scopes.push(el);
  return { scopes, boundary: scopes.at(-1) };
}
export function findComposerTarget(scopes) {
  for (const scope of scopes) {
    const codex = scope.querySelectorAll('button.codexModelSelectTrigger[aria-haspopup="menu"][title]');
    if (codex.length === 1 && codex[0].querySelector(':scope > .codexModelSelectLabel')) return { trigger: codex[0], kind: 'codex' };
    const native = scope.querySelectorAll('button[aria-haspopup="menu"][aria-busy][title]');
    if (native.length === 1 && native[0].querySelector(':scope > svg')) return { trigger: native[0], kind: 'native' };
  }
  return null;
}
