import { runtime } from 'captured-runtime';
import { loadCaptured } from 'captured-modules';
import { createDOMAdapter } from '../../../src/adapters.js';
import { insertAppearanceItem, nativeWorkspaceMenuLabels, workspaceMenuParts } from '../../../src/appearance-menu.js';

const factories = new Map(), modules = new Map();
loadCaptured({ load(definition) { factories.set(definition.id, definition.factory); } });
function requireNative(id) {
  if (runtime[id]) return runtime[id];
  if (modules.has(id)) return modules.get(id);
  const factory = factories.get(id);
  if (!factory) throw new Error('Unprovided captured module: ' + id);
  const value = factory(requireNative); modules.set(id, value); return value;
}
const React = runtime.react;
const { jsx, jsxs } = runtime['react/jsx-runtime'];
const { createRoot } = runtime['react-dom/client'];
const { Context } = runtime['@deepseek-ai/cordis'];
const { createSnapshotStore } = runtime['@deepseek-ai/dsh-client-store'];
const nativeRenderer = requireNative('@deepseek-ai/dsh-client-ui-renderer');
const nativeLocale = requireNative('@deepseek-ai/dsh-client-locale');
const nativeWorkspace = requireNative('@deepseek-ai/dsh-client-ui-workspace');
const nativeMenu = requireNative('@deepseek-ai/dsh-client-ui-context-menu');
const nativeOpen = requireNative('@deepseek-ai/dsh-client-ui-open-in-app');
const primitives = runtime['@deepseek-ai/dsh-client-ui-primitives'];
const dictionary = { en: { appearance: 'Appearance' }, ru: { appearance: 'Оформление' } };
let ctx, root, adapter, calls, edits, locale;

window.t148followup = {
  async mount({ lang = 'en', adapterEnabled = true } = {}) {
    calls = { rename: 0, delete: 0, reveal: 0, newSession: 0 }; edits = [];
    ctx = new Context();
    const slots = new nativeRenderer.SlotRegistry(ctx);
    slots.install(nativeRenderer.__createSlotRenderer());
    locale = new nativeLocale.LocaleRuntime(ctx, undefined, { languages: [lang], preference: lang });
    ctx.provide('locale', locale);
    slots.installLocale(locale);
    locale.register('workspace', nativeWorkspace.__dictionaries);
    locale.register('open-in-app', nativeOpen.__dictionaries);
    locale.register('workspacePlus', dictionary);
    const scope = createSnapshotStore({ key: undefined, hooks: {}, keyedHooks: {}, props: {} });
    slots.installScope('session', { current: scope });
    ctx.provide('shortcuts', { catalog: createSnapshotStore([]) });
    ctx.provide('remoteAccess', { source: () => createSnapshotStore(true) });
    const items = [{ workspaceId: 'w1', title: 'Fixture Workspace', path: 'C:/fixture/workspace', createdAt: '2026-01-01T00:00:00Z', sessionIds: [] }];
    const workspaceList = createSnapshotStore({ items });
    const list = { ids: [], byId: {}, mainView: null };
    const group = nativeWorkspace.__groupByWorkspace(list, items, new Set(), 'default', [])[0];
    const preferences = { ...createSnapshotStore({ features: { workspaces: true, sessions: false } }), appearance: () => undefined };
    function App(props) {
      return jsxs('main', { children: [jsx(nativeWorkspace.__ProjectRow, {
        group: { ...group, expanded: true, containsCurrent: false },
        onToggle() {}, onCreate() { calls.newSession++; }, access: { create: true, reorder: false },
        t: locale.bind('workspace'), openWorkspaceMenu: nativeWorkspace.__openWorkspaceMenu(ctx),
        useContextMenuTarget: props.useContextMenuTarget, useContextMenu: props.useContextMenu,
      }), props.renderSlot('shell.overlay', {})] });
    }
    slots.register({ name: 'root', children: { 'shell.overlay': { kind: 'list', scope: 'root' } } }, App);
    nativeMenu.apply(ctx);
    slots.provideRoot({ hooks: { contextMenuTarget: ctx.contextMenus.active } });
    nativeWorkspace.__registerWorkspace(ctx, (_id, _title, action) => { calls[action]++; });
    slots.inject('contextMenu.icon', () => slots.register({ name: 'contextMenu.icon', key: 'open-in-app.reveal' }, primitives.IconFolderOpenOutlineRegular));
    const directories = { apps: createSnapshotStore(['explorer']), async load() {}, async launch() { calls.reveal++; return { kind: 'opened' }; } };
    const forbiddenPathService = { async openPath() { throw new Error('Native shell/path service must never run'); } };
    nativeOpen.__registerContextMenus(ctx, forbiddenPathService, locale.bind('open-in-app'), directories, () => {});
    if (adapterEnabled) adapter = createDOMAdapter({ document, preferences,
      sessions: { list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} }, refreshProjections() { throw new Error('Unexpected Session read'); } },
      workspaces: { list: workspaceList }, translate: locale.bind('workspacePlus'),
      workspaceMenuLabels: () => nativeWorkspaceMenuLabels(locale),
      onEdit: (id, anchor) => edits.push({ id, anchor: anchor?.getAttribute('aria-label') }),
    });
    document.getElementById('root')?.remove();
    const element = document.createElement('div'); element.id = 'root'; document.body.append(element);
    root = createRoot(element);
    root.render(slots.renderSlot('root', {}));
  },
  snapshot() {
    const menu = document.querySelector('[role="menu"]');
    return { items: [...document.querySelectorAll('[role="menu"] button[role="menuitem"]')].map(button => button.textContent),
      appearance: document.querySelectorAll('[data-wsp-menu]').length,
      labels: nativeWorkspaceMenuLabels(locale), parts: menu ? Boolean(workspaceMenuParts(menu, nativeWorkspaceMenuLabels(locale))) : null,
      calls: { ...calls }, edits: [...edits],
      row: document.querySelector('[data-row-key^="workspace:"]')?.outerHTML,
      menu: menu?.outerHTML,
      errors: [...document.querySelectorAll('[data-slot-error]')].map(node => node.outerHTML),
    };
  },
  probeEmptyContentOutlet(change) {
    const menu = document.querySelector('[role="menu"]');
    const viewport = menu.querySelector(':scope > [role="presentation"]');
    const outlet = viewport.querySelector(':scope > div[data-slot="contextMenu.content"]');
    if (!outlet || outlet.children.length || outlet.textContent.trim()) throw new Error('Expected the exact empty native content outlet');
    const buttons = [...menu.querySelectorAll('button[role="menuitem"]')];
    const before = Boolean(workspaceMenuParts(menu, nativeWorkspaceMenuLabels(locale)));
    const observation = { tag: outlet.tagName, slot: outlet.dataset.slot, display: outlet.style.display,
      childCount: outlet.children.length, hasButton: Boolean(outlet.querySelector(':scope > button')) };
    if (change === 'remove-only-empty') outlet.remove();
    if (change === 'foreign-empty') outlet.dataset.slot = 'foreign.content';
    if (change === 'nonempty-exact') { const child = document.createElement('span'); child.textContent = 'Unknown contribution'; outlet.append(child); }
    if (change === 'extra-empty-exact') viewport.append(outlet.cloneNode(true));
    const after = Boolean(workspaceMenuParts(menu, nativeWorkspaceMenuLabels(locale)));
    const inserted = Boolean(insertAppearanceItem(menu, 'w1', locale.bind('workspacePlus')('appearance'), () => {}, nativeWorkspaceMenuLabels(locale)));
    return { change, before, after, inserted, observation, nativeButtonsUnchanged: buttons.every(button => button.isConnected && menu.contains(button)) };
  },
  tryProductionCallee() {
    return Boolean(insertAppearanceItem(document.querySelector('[role="menu"]'), 'w1', locale.bind('workspacePlus')('appearance'), () => {}, nativeWorkspaceMenuLabels(locale)));
  },
  dispose() { adapter?.dispose(); root?.unmount(); },
};
