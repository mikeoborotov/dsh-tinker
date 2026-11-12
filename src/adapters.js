import { fillAppearance, markSVG, selectionOf, vendorName } from './icons.js';
import { composerBoundary, findComposerTarget } from './composer-target.js';
import { insertAppearanceItem, workspaceMenuParts } from './appearance-menu.js';

const OWNED = 'data-wsp-owned';
const rows = '[data-row-key^="workspace:"], [data-row-key^="session:"]';
// RC.1 prepares for up to 1000ms (20ms prepare overlaps resolution), then enters in 40ms.
// Keep a bounded 100ms render/frame grace only for its explicit trigger lifecycle.
const NATIVE_WORKSPACE_MENU_WAIT_MS = 1100;
export function createDOMAdapter({ document: doc, preferences, sessions, workspaces, currentModels, onEdit, translate: t, workspaceMenuLabels }) {
  const win = doc.defaultView;
  let disposed = false, frame = 0, pendingMenu = null, menuTimer = 0;
  const restorations = new Map(), sessionIcons = new Map(), ownedMenus = new Map(), requested = new Set(), queue = [];
  let inflight = 0;
  const stats = { workspaceRows: 0, sessionRows: 0, incompatibleRows: 0 };
  function schedule() {
    if (!disposed && !frame) frame = win.requestAnimationFrame(() => { frame = 0; scan(); });
  }
  function ownSpan(className) {
    const el = doc.createElement('span'); el.className = 'wsp-icon ' + className;
    el.setAttribute(OWNED, ''); el.setAttribute('aria-hidden', 'true'); return el;
  }
  function restore(record) {
    record.icon.remove();
    // Only undo our change, not a later change made by the application.
    if (record.original.style.display === 'none') record.original.style.display = record.display;
  }
  function ensureProjection(id) {
    const value = sessions.list.getSnapshot()?.byId?.[id];
    if (!value || value.projectionValues?.modelSelection !== undefined || requested.has(id)) return;
    requested.add(id); queue.push(id); pump();
  }
  function pump() {
    while (!disposed && inflight < 2 && queue.length) {
      const id = queue.shift(); inflight++;
      // No retain(), binding(), catalog or transcript reads for sidebar rows.
      Promise.resolve().then(() => sessions.refreshProjections(id)).catch(() => {
        // Retry on a fresh connection, never in a tight mutation loop.
      }).finally(() => { inflight--; if (!disposed) { schedule(); pump(); } });
    }
  }
  function scanWorkspace(row, state) {
    const id = row.getAttribute('data-row-key').slice('workspace:'.length);
    const appearance = state.features.workspaces ? preferences.appearance(id) : undefined;
    let record = restorations.get(row);
    if (record && (!record.original.isConnected || record.original.parentElement !== row.firstElementChild)) {
      restore(record); restorations.delete(row); record = undefined;
    }
    if (!appearance) { if (record) { restore(record); restorations.delete(row); } return; }
    // RC.2: folder slot, hover chevron slot, title, row actions. Shape mismatch leaves native UI alone.
    const slot = row.firstElementChild, original = slot?.querySelector(':scope > svg');
    if (row.getAttribute('role') !== 'treeitem' || row.children.length < 4 || !original || !slot || slot.tagName !== 'SPAN') { stats.incompatibleRows++; return; }
    const signature = JSON.stringify(appearance);
    if (!record) {
      const icon = ownSpan('wsp-workspace-icon');
      record = { original, display: original.style.display, icon, signature: '' };
      restorations.set(row, record); slot.append(icon);
    }
    original.style.display = 'none';
    if (record.signature !== signature) { fillAppearance(record.icon, appearance); record.signature = signature; }
    stats.workspaceRows++;
  }
  function scanSession(row, state) {
    const id = row.getAttribute('data-row-key').slice('session:'.length);
    let icon = sessionIcons.get(row);
    if (!state.features.sessions) { icon?.remove(); sessionIcons.delete(row); return; }
    if (row.getAttribute('role') !== 'treeitem' || row.children.length < 2 || row.firstElementChild?.tagName !== 'SPAN') { stats.incompatibleRows++; return; }
    // Preserve the first slot completely: it may contain native status dots or another plugin's contribution.
    if (!icon || !icon.isConnected) { icon = ownSpan('wsp-session-icon'); row.insertBefore(icon, row.children[1]); sessionIcons.set(row, icon); }
    const selection = (currentModels?.getSnapshot()?.[id] ?? selectionOf(sessions.list.getSnapshot(), id)), signature = JSON.stringify(selection);
    if (icon.dataset.signature !== signature) { icon.innerHTML = markSVG(selection); icon.dataset.signature = signature; icon.title = vendorName(selection); }
    const rect = row.getBoundingClientRect();
    if (rect.height && rect.bottom > 0 && rect.top < win.innerHeight) ensureProjection(id);
    stats.sessionRows++;
  }
  function cancelMenu() { pendingMenu = null; win.clearTimeout(menuTimer); }
  function knownWorkspace(anchor, id) {
    const row = anchor.closest('[data-row-key]');
    return anchor.isConnected && row?.getAttribute('data-row-key') === 'workspace:' + id && row.querySelector('button') === anchor
      && workspaces.list.getSnapshot()?.items?.some(workspace => workspace.workspaceId === id);
  }
  function menuLabels() {
    try { return workspaceMenuLabels?.(); } catch { return null; }
  }
  function scanMenu(state) {
    if (!pendingMenu && !ownedMenus.size) return;
    const labels = menuLabels();
    for (const [menu, record] of ownedMenus) {
      const parts = menu.isConnected && record.button.isConnected && workspaceMenuParts(menu, labels, record.button);
      if (!state.features.workspaces || !parts || !knownWorkspace(record.anchor, record.id) || record.anchor.getAttribute('aria-expanded') === 'false') {
        record.wrapper.remove(); ownedMenus.delete(menu);
      } else {
        // Native async/reordered known contributions keep their nodes and their order.
        if (record.button.parentElement.nextElementSibling !== parts.remove.wrapper) parts.remove.wrapper.before(record.button.parentElement);
        const caption = record.button.lastElementChild;
        if (caption.textContent !== t('appearance')) caption.textContent = t('appearance');
      }
    }
    if (!pendingMenu) return;
    const { anchor, id, existing, nativeLifecycle } = pendingMenu;
    if (!state.features.workspaces || !knownWorkspace(anchor, id) || anchor.getAttribute('aria-expanded') === 'false'
      || (nativeLifecycle && !anchor.matches('[data-context-menu-trigger][aria-haspopup="menu"][aria-expanded="true"]'))) { cancelMenu(); return; }
    const controlledId = anchor.getAttribute('aria-controls');
    const candidates = [...doc.querySelectorAll('[role="menu"]')].filter(menu => !existing.has(menu)
      && (!controlledId || menu.id === controlledId) && menu.getBoundingClientRect().height > 0 && win.getComputedStyle(menu).visibility !== 'hidden');
    // A click is not ownership of whichever compatible menu happens to appear first.
    if (candidates.length > 1) { cancelMenu(); return; }
    const menu = candidates[0];
    if (!menu || !workspaceMenuParts(menu, labels)) return;
    const button = insertAppearanceItem(menu, id, t('appearance'), event => {
      event.stopPropagation();
      if (disposed || !menu.isConnected || !button.isConnected || !preferences.getSnapshot().features.workspaces || !knownWorkspace(anchor, id)
        || anchor.getAttribute('aria-expanded') === 'false' || ownedMenus.get(menu)?.button !== button || !workspaceMenuParts(menu, menuLabels(), button)) return;
      cancelMenu();
      // The native owner closes its menu; restore the trigger before mounting our dialog.
      anchor.click();
      win.queueMicrotask(() => {
        if (!disposed && preferences.getSnapshot().features.workspaces && knownWorkspace(anchor, id)) {
          anchor.focus({ preventScroll: true }); onEdit(id, anchor);
        }
      });
    }, labels);
    if (button) { ownedMenus.set(menu, { button, wrapper: button.parentElement, anchor, id }); cancelMenu(); }
  }
  function scan() {
    const state = preferences.getSnapshot();
    stats.workspaceRows = stats.sessionRows = stats.incompatibleRows = 0;
    for (const [row, record] of restorations) if (!row.isConnected) { restore(record); restorations.delete(row); }
    for (const [row, icon] of sessionIcons) if (!row.isConnected) { icon.remove(); sessionIcons.delete(row); }
    for (const row of doc.querySelectorAll(rows)) {
      if (row.getAttribute('data-row-key').startsWith('workspace:')) scanWorkspace(row, state); else scanSession(row, state);
    }
    scanMenu(state);
  }
  function onClick(event) {
    const button = event.target instanceof win.Element ? event.target.closest('button') : null;
    const row = button?.closest('[data-row-key^="workspace:"]');
    if (!row || row.querySelector('button') !== button || !preferences.getSnapshot().features.workspaces || button.getAttribute('aria-expanded') === 'true') { cancelMenu(); return; }
    const id = row.getAttribute('data-row-key').slice('workspace:'.length);
    if (!knownWorkspace(button, id)) { cancelMenu(); return; }
    const nativeLifecycle = button.matches('[data-context-menu-trigger][aria-haspopup="menu"][aria-expanded]');
    const owner = pendingMenu = { id, anchor: button, existing: new Set(doc.querySelectorAll('[role="menu"]')), nativeLifecycle };
    win.clearTimeout(menuTimer);
    menuTimer = win.setTimeout(() => {
      if (pendingMenu !== owner) return;
      scanMenu(preferences.getSnapshot());
      if (pendingMenu === owner) pendingMenu = null;
    }, nativeLifecycle ? NATIVE_WORKSPACE_MENU_WAIT_MS : 300);
    schedule();
  }
  function onKeyDown(event) { if (event.key === 'Escape') cancelMenu(); }
  const observer = new win.MutationObserver(records => {
    if (records.some(r => {
      if (r.target instanceof win.Element && r.target.closest('[' + OWNED + ']')) return false;
      if (r.type === 'attributes' && r.attributeName === 'aria-expanded' && r.target.tagName !== 'BUTTON') return false;
      const changed = [...r.addedNodes, ...r.removedNodes];
      return r.type === 'attributes' || changed.some(n => !(n instanceof win.Element && n.hasAttribute(OWNED)));
    })) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-row-key', 'aria-expanded'] });
  const unsub = [preferences.subscribe(schedule), sessions.list.subscribe(schedule), workspaces.list.subscribe(schedule), ...(currentModels ? [currentModels.subscribe(schedule)] : [])];
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('scroll', schedule, true);
  scan();
  return {
    stats,
    reconnect() { requested.clear(); schedule(); },
    dispose() {
      disposed = true; observer.disconnect(); win.cancelAnimationFrame(frame); win.clearTimeout(menuTimer);
      for (const fn of unsub) fn(); doc.removeEventListener('click', onClick, true); doc.removeEventListener('keydown', onKeyDown, true); doc.removeEventListener('scroll', schedule, true);
      for (const record of restorations.values()) restore(record); restorations.clear();
      for (const icon of sessionIcons.values()) icon.remove(); sessionIcons.clear();
      for (const record of ownedMenus.values()) record.wrapper.remove(); ownedMenus.clear();
      queue.length = 0; pendingMenu = null;
    },
  };
}

export function attachComposerIcon(marker, selection) {
  const doc = marker.ownerDocument, win = doc.defaultView;
  // Both native RC.2 and Codex Subscription 2.5.2 use the same model slot.
  // Inspect only this composer toolbar; never match unrelated menu buttons by their caption.
  const { scopes, boundary } = composerBoundary(marker);
  let attached = null, disposed = false;
  function restore() {
    if (!attached) return;
    for (const icon of attached.icons) icon.remove();
    if (attached.original && attached.original.style.display === 'none') attached.original.style.display = attached.display;
    attached = null;
  }
  function update() {
    if (disposed) return;
    const target = findComposerTarget(scopes);
    if (!target) { restore(); return; }
    if (attached?.trigger === target.trigger && attached.icons.every(icon => icon.parentElement === target.trigger)
      && (!attached.original || attached.original.parentElement === target.trigger)) return;
    restore();
    const { trigger, kind } = target;
    const icon = doc.createElement('span'); icon.className = 'wsp-icon wsp-composer-icon'; icon.setAttribute(OWNED, ''); icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = markSVG(selection);
    if (kind === 'codex') {
      // This picker has no leading model glyph. Its first SVG is the CHEVRON (or optional fast-mode bolt).
      // Add a logo without hiding either existing indicator.
      icon.style.display = 'inline-flex'; trigger.insertBefore(icon, trigger.firstChild);
      attached = { trigger, original: null, icons: [icon] };
    } else {
      const original = trigger.querySelector(':scope > svg'), display = original.style.display;
      icon.style.display = 'var(--dsh-composer-model-icon-display, none)';
      const captionIcon = icon.cloneNode(true); captionIcon.style.display = 'var(--dsh-composer-model-text-display, inline-flex)';
      original.style.display = 'none'; trigger.insertBefore(icon, original); trigger.insertBefore(captionIcon, original);
      attached = { trigger, original, display, icons: [icon, captionIcon] };
    }
  }
  // A later slot occupant or React replacement can mount after our marker. Observe that lifecycle locally.
  const observer = new win.MutationObserver(update);
  if (boundary) observer.observe(boundary, { childList: true, subtree: true });
  update();
  return () => { disposed = true; observer.disconnect(); restore(); };
}
