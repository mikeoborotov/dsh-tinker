import { fillAppearance } from './icons.js';

const OWNED = 'data-wsp-owned';
// RC.2 renders a stable slot outlet beside the hero chip; its menu is portaled.
const SLOT = '[data-slot="conversation.hero.workspace"]';
export function createWorkspacePickerAdapter({ document: doc, preferences, workspaces, defaultName = () => 'Default workspace' }) {
  const displayTitle = workspace => workspace.title === 'default-workspace' ? defaultName() : workspace.title;
  const win = doc.defaultView, records = new Map(), pending = new Map(), expanded = new Map();
  let knownMenus = new Set(doc.querySelectorAll('[role="menu"]'));
  let disposed = false, frame = 0, opening = null, activeMenu = null;
  function schedule() { if (!disposed && !frame) frame = win.requestAnimationFrame(() => { frame = 0; scan(); }); }
  function restore(target) {
    const record = records.get(target); if (!record) return;
    record.icon.remove(); if (record.original.style.display === 'none') record.original.style.display = record.display;
    records.delete(target);
  }
  function decorate(target, original, id, menu = false) {
    const appearance = preferences.getSnapshot().features.workspaces && preferences.appearance(id);
    let record = records.get(target);
    if (record && (record.original !== original || record.icon.parentElement !== target)) { restore(target); record = null; }
    if (!appearance || !original) { restore(target); return; }
    if (!record) {
      const icon = doc.createElement('span'); icon.className = 'wsp-icon wsp-workspace-picker-icon' + (menu ? ' wsp-workspace-picker-menu-icon' : '');
      icon.setAttribute(OWNED, ''); icon.setAttribute('aria-hidden','true');
      record = { original, display: original.style.display, icon, signature: '' }; records.set(target,record);
      original.before(icon);
    }
    original.style.display = 'none';
    const signature = JSON.stringify(appearance);
    if (record.signature !== signature) { fillAppearance(record.icon,appearance); record.signature = signature; }
  }
  function owners() {
    return [...doc.querySelectorAll(SLOT)].map(slot => {
      const root = slot.closest('[data-conversation-content]');
      const trigger = slot.parentElement?.querySelector(':scope > button[aria-haspopup="menu"][aria-expanded]');
      const original = trigger?.querySelector(':scope > svg');
      const label = trigger?.querySelector(':scope > span:not([' + OWNED + '])');
      // Folder + label + chevron, outside the input card. Leave other slot occupants alone.
      if (!root || !trigger || !original || !label || trigger.querySelectorAll(':scope > svg').length !== 2) return null;
      return { root, trigger, original, label };
    }).filter(Boolean);
  }
  function menuRows(menu, items) {
    const viewport = menu.querySelector(':scope > div[role="presentation"]');
    if (!viewport) return null;
    const buttons = [...viewport.querySelectorAll('button[role="menuitem"]')].filter(b => b.closest('[role="menu"]') === menu);
    if (!items.length || buttons.length !== items.length) return null;
    // Native WorkspacePickFlow maps ALL snapshot items in order, no search/filter/sort.
    // Validate every label and shape before using that contract; never resolve an ID by a caption.
    const rows = buttons.map((button,index) => {
      const icon = button.querySelector(':scope > span:has(> svg)');
      const label = [...button.children].find(el => el.tagName === 'SPAN' && el !== icon);
      const original = icon?.querySelector(':scope > svg');
      if (!original || !label || label.textContent !== displayTitle(items[index])) return null;
      return {button, icon, original, id:items[index].workspaceId};
    });
    return rows.every(Boolean) ? rows : null;
  }
  function scan() {
    const snapshot = workspaces.list.getSnapshot();
    const items = snapshot?.phase === 'ready' ? snapshot.items : [], live = new Set();
    const currentOwners = owners();
    // The inert prompt can request this picker without clicking the chip.
    // Track the native closed->open signal, using the menu baseline from before that transition.
    const newlyOpened = currentOwners.filter(o => expanded.get(o.trigger) === false && o.trigger.getAttribute('aria-expanded') === 'true');
    if (!opening && newlyOpened.length === 1) opening = {owner:newlyOpened[0],existing:knownMenus};
    for (const owner of currentOwners) {
      expanded.set(owner.trigger,owner.trigger.getAttribute('aria-expanded') === 'true');
      const {root,trigger,original,label} = owner, sessionId = root.getAttribute('data-conversation-session');
      const matches = sessionId ? items.filter(w => w.sessionIds?.includes(sessionId)) : [];
      const workspace = matches.length === 1 ? matches[0] : null;
      const transition = pending.get(root);
      if (transition && (workspace?.workspaceId === transition.id || sessionId !== transition.sessionId)) pending.delete(root);
      // During owner-private pending selection show the native folder until the list confirms identity.
      const id = !pending.has(root) && workspace && label.textContent === displayTitle(workspace) ? workspace.workspaceId : null;
      decorate(trigger,original,id);live.add(trigger);
    }
    for (const root of pending.keys()) if (!root.isConnected) pending.delete(root);
    if (opening && (!opening.owner.trigger.isConnected || opening.owner.trigger.getAttribute('aria-expanded') === 'false')) opening = null;
    if (opening) {
      const candidates = [...doc.querySelectorAll('[role="menu"]')].filter(m => !opening.existing.has(m) && m.getBoundingClientRect().height > 0);
      const valid = candidates.map(menu => ({menu,rows:menuRows(menu,items)})).filter(m => m.rows);
      if (valid.length === 1) activeMenu = {...valid[0],owner:opening.owner};
    }
    if (activeMenu) {
      const {menu,owner} = activeMenu;
      const rows = menu.isConnected && owner.trigger.isConnected && owner.trigger.getAttribute('aria-expanded') === 'true' ? menuRows(menu,items) : null;
      if (!rows) activeMenu = null;
      else { activeMenu.rows = rows; for (const row of rows) {decorate(row.icon,row.original,row.id,true);live.add(row.icon);} }
    }
    for (const target of records.keys()) if (!live.has(target) || !target.isConnected) restore(target);
    for (const trigger of expanded.keys()) if (!trigger.isConnected) expanded.delete(trigger);
    knownMenus = new Set(doc.querySelectorAll('[role="menu"]'));
  }
  function onClick(event) {
    const button = event.target instanceof win.Element ? event.target.closest('button') : null;
    if (!button) return;
    const owner = owners().find(o => o.trigger === button);
    if (owner) {
      // Reopening is not evidence that an owner-private pending selection has settled.
      opening = {owner,existing:new Set(doc.querySelectorAll('[role="menu"]'))}; activeMenu = null;schedule();return;
    }
    // Revalidate the complete current vector at the click boundary, not a saved positional index.
    if (activeMenu) {
      const snapshot = workspaces.list.getSnapshot();
      const rows = snapshot?.phase === 'ready' ? menuRows(activeMenu.menu,snapshot.items) : null;
      const row = rows?.find(r => r.button === button);
      if (row && !button.disabled) {
        const {root,trigger} = activeMenu.owner;
        pending.set(root,{id:row.id,sessionId:root.getAttribute('data-conversation-session')});restore(trigger);
        opening = activeMenu = null;schedule();
      }
    }
  }
  const observer = new win.MutationObserver(changes => {
    if (changes.some(r => {
      const element = r.target instanceof win.Element ? r.target : r.target.parentElement;
      if (element?.closest('[' + OWNED + ']')) return false;
      return r.type !== 'childList' || [...r.addedNodes,...r.removedNodes].some(n => !(n instanceof win.Element && n.hasAttribute(OWNED)));
    })) schedule();
  });
  observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-expanded','data-conversation-session','data-slot']});
  const unsub = [preferences.subscribe(schedule),workspaces.list.subscribe(schedule)];
  doc.addEventListener('click',onClick,true);scan();
  return {dispose() {disposed=true;observer.disconnect();win.cancelAnimationFrame(frame);unsub.forEach(fn=>fn());doc.removeEventListener('click',onClick,true);for(const target of records.keys())restore(target);pending.clear();expanded.clear();knownMenus.clear();opening=activeMenu=null;}};
}
