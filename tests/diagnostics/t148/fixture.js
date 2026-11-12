import { createDOMAdapter } from '../../../src/adapters.js';
import { insertAppearanceItem } from '../../../src/appearance-menu.js';

// Source-shaped DOM, NOT a live capture or a running native Host.
// RC.1 ASAR ui-workspace/lib/client.js ProjectRow (2224-2300),
// ui-context-menu/lib/client.js MenuOverlay/menuEntries (1167-1205),
// web-frontend/dist/assets/index-BgUyXZcc.js Menu render (665319..668626).
// Two-item control preserves supported RC.2 Menu.tsx (439-475, 513-555) shape.
// All action handlers below are counters/noops. No native services are imported.
const nativeClasses = {
  list: '_list_1p5el_7', viewport: '_viewport_1p5el_19',
  itemWrap: '_itemWrap_1p5el_105', item: '_item_1p5el_105',
  itemIcon: '_itemIcon_1p5el_165', itemLabel: '_itemLabel_1p5el_208',
  danger: '_danger_1p5el_250', separator: '_separator_1p5el_89',
};
const glyph = '<svg width="16" height="16" aria-hidden="true"><path d="M2 2h12v12H2z"/></svg>';
let adapter;
let options;
let edits = [];
let calls;
const noopSubscribe = () => () => {};

function sourceShapedNativeWorkspaceMenu() {
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('data-context-menu', '');
  menu.className = nativeClasses.list;
  const viewport = document.createElement('div');
  viewport.setAttribute('role', 'presentation');
  viewport.className = nativeClasses.viewport;
  menu.append(viewport);
  const entries = [
    { id: 'rename', label: 'Rename' },
    ...(options.reveal ? [{ id: 'reveal', label: 'Show in folder' }] : []),
    { id: 'delete', label: 'Delete workspace', danger: true },
  ];
  for (const entry of entries) {
    if (entry.danger && options.separator) {
      const separator = document.createElement('div');
      separator.setAttribute('role', 'separator');
      separator.className = nativeClasses.separator;
      viewport.append(separator);
    }
    const wrap = document.createElement('div');
    wrap.className = nativeClasses.itemWrap;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.className = nativeClasses.item + (entry.danger ? ' ' + nativeClasses.danger : '');
    const menuGlyph = options.reveal ? '<span data-slot="contextMenu.icon" style="display:contents">' + glyph + '</span>' : glyph;
    button.innerHTML = '<span aria-hidden="true" class="' + nativeClasses.itemIcon + '">' + menuGlyph + '</span>'
      + '<span class="' + nativeClasses.itemLabel + '">' + entry.label + '</span>';
    button.addEventListener('click', () => { calls[entry.id]++; });
    wrap.append(button);
    viewport.append(wrap);
  }
  document.body.append(menu);
}

window.t148 = {
  mount(next = {}) {
    options = { reveal: true, separator: true, fullRow: true, classes: true, ...next };
    calls = { rename: 0, reveal: 0, delete: 0 };
    edits = [];
    document.body.innerHTML = options.fullRow
      ? '<div data-row-key="workspace:w1" role="treeitem" aria-expanded="true"><span>' + glyph
        + '</span><span>' + glyph + '</span><span><span>Fixture Workspace</span></span><span>'
        + '<button id="workspace-menu-anchor" data-context-menu-trigger aria-label="Workspace actions" aria-haspopup="menu" aria-expanded="false">...</button>'
        + '<button aria-label="New session">+</button></span></div>'
      : '<div data-row-key="workspace:w1"><button id="workspace-menu-anchor">...</button></div>';
    const anchor = document.getElementById('workspace-menu-anchor');
    anchor.addEventListener('click', () => {
      const current = document.querySelector('[role="menu"]');
      if (current) { current.remove(); anchor.setAttribute('aria-expanded', 'false'); }
      else { sourceShapedNativeWorkspaceMenu(); anchor.setAttribute('aria-expanded', 'true'); }
      if (!options.classes) for (const el of document.querySelectorAll('[class]')) el.removeAttribute('class');
    });
    adapter = createDOMAdapter({
      document,
      preferences: {
        getSnapshot: () => ({ features: { workspaces: true, sessions: false } }),
        appearance: () => undefined,
        subscribe: noopSubscribe,
      },
      sessions: { list: { getSnapshot: () => ({ byId: {} }), subscribe: noopSubscribe }, refreshProjections() { throw new Error('Unexpected session request'); } },
      workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1' }] }), subscribe: noopSubscribe } },
      onEdit: (id) => edits.push(id),
      translate: (key) => key === 'appearance' ? 'Appearance' : key,
    });
  },
  snapshot() {
    const menu = document.querySelector('[role="menu"]');
    return {
      items: [...(menu?.querySelectorAll('button[role="menuitem"]') ?? [])].map(button => button.textContent),
      appearance: menu?.querySelectorAll('[data-wsp-menu="w1"]').length ?? 0,
      menuHeight: menu?.getBoundingClientRect().height ?? 0,
      edits: [...edits], calls: { ...calls },
    };
  },
  direct(reveal, change = 'none') {
    // Final reduction removes the adapter caller, trigger, stores and timers.
    // This is the real production callee, not a reimplementation of its guards.
    calls = { rename: 0, reveal: 0, delete: 0 };
    edits = [];
    const menuGlyph = reveal ? '<span data-slot="contextMenu.icon" style="display:contents"><svg/></span>' : '<svg/>';
    document.body.innerHTML = '<div role="menu"><div role="presentation">'
      + '<div><button role="menuitem"><span>' + menuGlyph + '</span><span>Rename</span></button></div>'
      + (reveal ? '<div><button role="menuitem"><span>' + menuGlyph + '</span><span>Show in folder</span></button></div>' : '')
      + '<div><button role="menuitem"><span>' + menuGlyph + '</span><span>Delete workspace</span></button></div>'
      + '</div></div>';
    const menu = document.querySelector('[role="menu"]');
    const viewport = menu.firstElementChild;
    if (change === 'delete-old-position') viewport.insertBefore(viewport.lastElementChild, viewport.children[1]);
    if (change === 'third-label') viewport.children[1].querySelector('button').lastElementChild.textContent = 'Other command';
    if (change === 'third-role') viewport.children[1].querySelector('button').setAttribute('role', 'menuitemradio');
    const inputLabels = [...menu.querySelectorAll('button')].map(button => button.textContent);
    const matchedButtonCount = menu.querySelectorAll('button[role="menuitem"]').length;
    const inserted = insertAppearanceItem(menu, 'w1', 'Appearance', () => {});
    return { ...this.snapshot(), inputLabels, matchedButtonCount, returnedButton: inserted !== null };
  },
  dispose() { adapter?.dispose(); },
};
