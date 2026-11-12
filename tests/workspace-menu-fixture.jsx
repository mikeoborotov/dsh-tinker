import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu, Toast } from '@deepseek-ai/dsh-client-ui-primitives';
import { capturedMenuOverlay } from './native-workspace-rc1/MenuOverlay.js';
import { capturedSlotOutlet } from './native-workspace-rc1/SlotOutlet.js';
import { createDOMAdapter } from '../src/adapters.js';
import { createStore } from '../src/store.js';
import { nativeWorkspaceMenuLabels } from '../src/appearance-menu.js';

// Actual pinned RC.2 Menu rendering/keyboard implementation, NOT an installed Host.
// Current three-action presentation is source-shaped from RC.1 contributions.
// Portable source hashes and license reference: native-workspace-rc1/provenance.json.
// Every native action is a local counter; no workspace, directory or shell service runs.
const labels = {
  en: { rename: 'Rename', remove: 'Delete workspace', reveal: ['Show in folder', 'Show in Finder'], appearance: 'Appearance' },
  ru: { rename: 'Переименовать', remove: 'Удалить рабочую область', reveal: ['Показать в папке', 'Показать в Finder'], appearance: 'Оформление' },
};
const glyph = <svg width="16" height="16" aria-hidden="true"><path d="M2 2h12v12H2z" /></svg>;
let root, adapter, config, preferences, workspaceList;
let calls = {}, edits = [], nativeRefs = [], nativeContent, controls = {};
const noopSubscribe = () => () => {};
const slotHost = { subscribe: noopSubscribe, getVersion: () => 0,
  specOf: slot => ({ inline: slot === 'contextMenu.icon', kind: 'keyed', scope: 'root' }) };
const NativeSlotOutlet = capturedSlotOutlet({
  useHost: () => slotHost, useLocaleRevision() {}, useScopeBinding: () => ({ key: undefined }),
  // Static slot service data, not a model of the outlet's DOM protocol.
  renderOutletContent: (_host, slot) => slot === 'contextMenu.icon' ? glyph : config.content ? <span>Native contribution</span> : null,
});
function renderSlot(slotKey, ownerProps, opts) { return <NativeSlotOutlet {...{ slotKey, ownerProps, opts }} declaredInline={slotKey === 'contextMenu.icon'} />; }
const AnchorContext = React.createContext(null);
function AnchoredPinnedMenu(props) {
  // RC.2's Menu has no current returnFocus prop; bridge only its anchor API.
  const anchor = React.useContext(AnchorContext);
  return <Menu {...props} anchor={anchor} />;
}
const NativeMenuOverlay = capturedMenuOverlay({ Menu: AnchoredPinnedMenu, Toast });

function WorkspaceRow({ id }) {
  const [open, setOpen] = useState(false), [requested, setRequested] = useState(false);
  const request = useRef(0);
  const close = () => { request.current++; setRequested(false); setOpen(false); };
  controls[id] = { close, open: () => setOpen(true) };
  const toggle = event => {
    event.stopPropagation();
    if (open || requested) { close(); return; }
    if (!config.delay) { setOpen(true); return; }
    const generation = ++request.current;
    setRequested(true); // Native target/aria-expanded is set before resolution.ready.
    window.setTimeout(() => {
      if (request.current === generation) { setRequested(false); setOpen(true); }
    }, config.delay);
  };
  const copy = labels[config.lang];
  const icon = glyph; // Current icons are resolved by captured menuEntries -> actual SlotOutlet below.
  let items = [
    { id: 'rename', label: copy.rename, icon },
    ...(config.variant === 'legacy' || config.reveal === false ? [] : [{ id: 'reveal', label: copy.reveal[config.finder ? 1 : 0], icon }]),
    ...(config.extra ? [{ id: 'extra', label: 'Other command', icon }] : []),
    { id: 'delete', label: copy.remove, danger: true, icon },
  ];
  if (config.reordered) items = [items.at(-1), ...items.slice(0, -1)];
  if (config.separator) items.splice(items.findIndex(item => item.id === 'delete'), 0, { type: 'separator', id: 'separator' });
  const anchor = <button id={'workspace-trigger-' + id} type="button" data-context-menu-trigger={config.variant === 'legacy' ? undefined : true} aria-haspopup="menu" aria-expanded={open || requested}
    aria-label={'Workspace actions ' + id} onClick={toggle}>...</button>;
  const select = action => { calls[id + ':' + action] = (calls[id + ':' + action] ?? 0) + 1; close(); };
  const actions = items.filter(item => item.type !== 'separator').map(item => ({ ...item, icon: { key: 'fixture.' + item.id }, separatorBefore: item.id === 'delete' && config.separator }));
  const rect = document.getElementById('workspace-trigger-' + id)?.getBoundingClientRect();
  return <div role="treeitem" data-row-key={'workspace:' + id} aria-expanded="true">
    <span>{glyph}</span><span>{glyph}</span><span>Workspace {id}</span><span>
      {config.variant === 'legacy' ? <Menu open={open} portal autoFocus items={items} onClose={close} onSelect={select} anchor={anchor} />
        : <AnchorContext.Provider value={anchor}><NativeMenuOverlay
          useStore={selector => selector({ target: open ? { kind: 'workspace', value: { workspaceId: id } } : null,
            point: { x: rect?.left ?? 0, y: rect?.bottom ?? 0 }, items: actions, notice: null, occurrence: 0, closing: false, replacing: false })}
          useCatalog={selector => selector([])} actions={{ notify() {} }} renderSlot={renderSlot} close={close} select={select}
          returnFocus={() => document.getElementById('workspace-trigger-' + id)} />
        </AnchorContext.Provider>}
      <button aria-label={'New session ' + id} onClick={() => { calls.newSession = (calls.newSession ?? 0) + 1; }}>+</button>
    </span>
  </div>;
}
function render() { root.render(<><WorkspaceRow id="w1" /><WorkspaceRow id="w2" /><button id="outside">Outside</button></>); }
function startAdapter() {
  adapter = createDOMAdapter({ document, preferences, workspaces: { list: workspaceList },
    sessions: { list: { getSnapshot: () => ({ byId: {} }), subscribe: noopSubscribe }, refreshProjections() { throw new Error('Unexpected projection read'); } },
    translate: () => labels[config.lang].appearance,
    workspaceMenuLabels: () => nativeWorkspaceMenuLabels({ bind(namespace) {
      if (namespace === 'open-in-app' && config.missingRevealNamespace) throw new Error('Namespace unavailable on legacy Host');
      return key => ({ rename: labels[config.lang].rename, 'delete.workspace': labels[config.lang].remove,
        'menu.reveal': labels[config.lang].reveal[0], 'menu.finder': labels[config.lang].reveal[1] })[key] ?? key;
    } }),
    onEdit: (id, anchor) => edits.push({ id, anchor: anchor.id }),
  });
}
window.workspaceMenuFixture = {
  mount(options = {}) {
    config = { variant: 'current', lang: 'en', separator: true, ...options };
    calls = {}; edits = []; controls = {}; nativeRefs = [];
    document.body.innerHTML = '<div id="workspace-fixture"></div>';
    root = createRoot(document.getElementById('workspace-fixture'));
    preferences = createStore({ features: { workspaces: true, sessions: false } });
    preferences.appearance = () => undefined;
    workspaceList = createStore({ items: [{ workspaceId: 'w1' }, { workspaceId: 'w2' }] });
    render(); startAdapter();
  },
  configure(options) { config = { ...config, ...options }; render(); },
  toggle(enabled) { preferences.set({ features: { workspaces: enabled, sessions: false } }); },
  setWorkspaces(ids) { workspaceList.set({ items: ids.map(workspaceId => ({ workspaceId })) }); },
  cancel(id = 'w1') { controls[id].close(); },
  latePopup(id = 'w1') { controls[id].open(); }, // Adversarial late native popup after cancellation, counter-only.
  captureNative() {
    nativeContent = document.querySelector('[role="menu"] [data-slot="contextMenu.content"]');
    nativeRefs = [...document.querySelectorAll('[role="menu"] button[role="menuitem"]')].filter(button => !button.hasAttribute('data-wsp-owned'))
      .map(button => ({ button, wrapper: button.parentElement, label: button.textContent,
        icon: button.firstElementChild, outlet: button.firstElementChild.firstElementChild,
        glyph: button.firstElementChild.querySelector('svg') }));
  },
  nativeIdentity() { return nativeRefs.map(({ button, wrapper, label }) => ({ label, connected: button.isConnected, sameWrapper: button.parentElement === wrapper })); },
  nativeContentIdentity() { return { same: document.querySelector('[role="menu"] [data-slot="contextMenu.content"]') === nativeContent,
    connected: nativeContent?.isConnected, children: nativeContent?.childNodes.length }; },
  nativeIconIdentity() { return nativeRefs.map(({ button, label, icon, outlet, glyph }) => ({ label,
    sameIcon: button.firstElementChild === icon, sameOutlet: icon.firstElementChild === outlet,
    sameGlyph: outlet.firstElementChild === glyph, connected: icon.isConnected && outlet.isConnected && glyph.isConnected })); },
  snapshot() { return { calls: { ...calls }, edits: [...edits], items: [...document.querySelectorAll('[role="menu"] button[role="menuitem"]')].map(button => button.textContent) }; },
  dispose() { adapter.dispose(); },
  restart() { adapter.dispose(); startAdapter(); },
};
