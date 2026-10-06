import { fillAppearance, markSVG, selectionOf, vendorName } from './icons.js';
import { composerBoundary, findComposerTarget } from './composer-target.js';

const OWNED = 'data-wsp-owned';
const rows = '[data-row-key^="workspace:"], [data-row-key^="session:"]';
export function createDOMAdapter({ document: doc, preferences, sessions, workspaces, currentModels, onEdit, translate: t }) {
  const win = doc.defaultView;
  let disposed = false, frame = 0, pendingMenu = null, menuTimer = 0;
  const restorations = new Map(), sessionIcons = new Map(), requested = new Set(), queue = [];
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
  function scanMenu(state) {
    if (!pendingMenu || !state.features.workspaces) return;
    const { anchor, id, existing } = pendingMenu;
    if (!anchor.isConnected) { pendingMenu = null; return; }
    const candidates = [...doc.querySelectorAll('[role="menu"]')].filter(menu => !existing.has(menu));
    const menu = candidates.find(el => {
      const buttons = el.querySelectorAll('button[role="menuitem"]');
      return buttons.length === 2 && el.getBoundingClientRect().height > 0;
    });
    if (!menu || menu.querySelector('[data-wsp-menu]')) return;
    const button = doc.createElement('button');
    button.type = 'button'; button.setAttribute('role', 'menuitem'); button.setAttribute(OWNED, ''); button.dataset.wspMenu = id;
    button.className = 'wsp-menu-item'; button.textContent = t('appearance');
    button.addEventListener('click', e => {
      e.stopPropagation();
      // Let the native owner close its menu and restore focus first.
      if (anchor.isConnected) anchor.click();
      pendingMenu = null;
      win.queueMicrotask(() => { if (!disposed) onEdit(id, anchor); });
    });
    menu.append(button);
  }
  function scan() {
    const state = preferences.getSnapshot();
    stats.workspaceRows = stats.sessionRows = stats.incompatibleRows = 0;
    for (const [row, record] of restorations) if (!row.isConnected) { restore(record); restorations.delete(row); }
    for (const [row, icon] of sessionIcons) if (!row.isConnected) { icon.remove(); sessionIcons.delete(row); }
    for (const row of doc.querySelectorAll(rows)) {
      if (row.getAttribute('data-row-key').startsWith('workspace:')) scanWorkspace(row, state); else scanSession(row, state);
    }
    if (!state.features.workspaces) { for (const button of doc.querySelectorAll('[data-wsp-menu]')) button.remove(); }
    scanMenu(state);
  }
  function onClick(event) {
    const button = event.target instanceof win.Element ? event.target.closest('button') : null;
    const row = button?.closest('[data-row-key^="workspace:"]');
    if (!row || row.querySelector('button') !== button || !preferences.getSnapshot().features.workspaces) return;
    const id = row.getAttribute('data-row-key').slice('workspace:'.length);
    if (!workspaces.list.getSnapshot()?.items?.some(w => w.workspaceId === id)) return;
    pendingMenu = { id, anchor: button, existing: new Set(doc.querySelectorAll('[role="menu"]')) };
    win.clearTimeout(menuTimer);
    menuTimer = win.setTimeout(() => { scanMenu(preferences.getSnapshot()); pendingMenu = null; }, 300);
    schedule();
  }
  const observer = new win.MutationObserver(records => {
    if (records.some(r => {
      if (r.target instanceof win.Element && r.target.closest('[' + OWNED + ']')) return false;
      const changed = [...r.addedNodes, ...r.removedNodes];
      return r.type === 'attributes' || changed.some(n => !(n instanceof win.Element && n.hasAttribute(OWNED)));
    })) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-row-key'] });
  const unsub = [preferences.subscribe(schedule), sessions.list.subscribe(schedule), workspaces.list.subscribe(schedule), ...(currentModels ? [currentModels.subscribe(schedule)] : [])];
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('scroll', schedule, true);
  scan();
  return {
    stats,
    reconnect() { requested.clear(); schedule(); },
    dispose() {
      disposed = true; observer.disconnect(); win.cancelAnimationFrame(frame); win.clearTimeout(menuTimer);
      for (const fn of unsub) fn(); doc.removeEventListener('click', onClick, true); doc.removeEventListener('scroll', schedule, true);
      for (const record of restorations.values()) restore(record); restorations.clear();
      for (const icon of sessionIcons.values()) icon.remove(); sessionIcons.clear();
      for (const button of doc.querySelectorAll('[data-wsp-menu]')) button.remove();
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
