import { markSVG, vendorName, vendorOf } from './icons.js';
import { composerBoundary, findComposerTarget } from './composer-target.js';

function normalize(value) { return String(value ?? '').trim().replace(/\s+/g, ' '); }
function modelLabel(button, kind) {
  if (kind === 'codex') return normalize(button.querySelector('.codexModelSelectOptionName')?.textContent);
  return normalize(button.getAttribute('title'));
}
function matchingSelection(groups, label) {
  const matches = groups.flatMap(group => (group.models ?? [])
    .filter(model => normalize(model.name) === label)
    .map(model => ({ provider: group.id, model: model.id })));
  if (!matches.length) return null;
  // Different routes may share a display name. Only a unanimous laboratory is safe to show.
  const vendors = new Set(matches.map(vendorOf));
  return vendors.size === 1 ? matches[0] : null;
}
function providerGroups(section, menu, kind, groups) {
  const headingId = section.getAttribute('aria-labelledby');
  if (kind === 'codex') {
    // Legacy IDs are authoritative, including stale/empty IDs: never override them with a label.
    if (section.classList.contains('codexModelSelectGroup') || section.hasAttribute('aria-labelledby')) {
      if (!menu.id.endsWith('-menu')) return [];
      const ownerId = menu.id.slice(0, -5);
      return groups.filter(group => headingId === `${ownerId}-${group.id}`);
    }
    const name = normalize(section.getAttribute('aria-label'));
    const heading = section.querySelector(':scope > div.codexModelSelectGroupTitle');
    if (!name || normalize(heading?.textContent) !== name) return [];
    return groups.filter(group => normalize(group.name) === name);
  }
  const heading = section.querySelector(':scope > [data-menu-group-heading]');
  const name = normalize(heading?.textContent);
  const named = groups.filter(group => normalize(group.name) === name || group.id === name);
  // Native DeepSeek Account headings are localized; an unrecognized label falls back to catalog model identity.
  return named.length ? named : groups;
}
function ownedMutation(record, win) {
  if (record.target instanceof win.Element && record.target.closest('[data-wsp-owned]')) return true;
  if (record.type !== 'childList') return false;
  const changes = [...record.addedNodes, ...record.removedNodes];
  return changes.length > 0 && changes.every(node => node instanceof win.Element && node.hasAttribute('data-wsp-owned'));
}

/** Decorate only the model list belonging to this composer's existing trigger. */
export function attachModelMenuIcons(marker, directory) {
  const doc = marker.ownerDocument, win = doc.defaultView;
  const { scopes, boundary } = composerBoundary(marker), icons = new Map();
  let disposed = false, frame = 0, observedMenu = null;
  function schedule() {
    if (!disposed && !frame) frame = win.requestAnimationFrame(() => { frame = 0; update(); });
  }
  const menuObserver = new win.MutationObserver(records => { if (records.some(r => !ownedMutation(r, win))) schedule(); });
  const portalObserver = new win.MutationObserver(schedule);
  function update() {
    if (disposed) return;
    const owner = findComposerTarget(scopes);
    const open = owner?.trigger.getAttribute('aria-expanded') === 'true';
    const id = owner?.trigger.getAttribute('aria-controls');
    const menu = open && id ? doc.getElementById(id) : null;
    portalObserver.disconnect();
    if (open && id && !menu) portalObserver.observe(doc.body, { childList: true });
    if (menu !== observedMenu) {
      menuObserver.disconnect(); observedMenu = menu;
      if (menu) menuObserver.observe(menu, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-labelledby', 'aria-label', 'role', 'class', 'hidden'] });
    }
    const seen = new Set();
    if (menu && menu.getAttribute('role') && !menu.hidden) {
      const groups = directory.getSnapshot().groups ?? [];
      let selector = owner.kind === 'codex' ? 'section.codexModelSelectGroup[role="group"]' : 'section[data-menu-group][role="group"]';
      // Current Codex reuses option rows in other panes; only this direct model body owns groups.
      if (owner.kind === 'codex' && menu.matches('.codexModelSelectMenu[role="group"]')) {
        selector += ', :scope > div.codexModelSelectGroups[role="menu"] > section[role="group"][aria-label]';
      }
      for (const section of menu.querySelectorAll(selector)) {
        if (section.hidden) continue;
        if (owner.kind === 'codex' && !section.classList.contains('codexModelSelectGroup')
          && !section.querySelector(':scope > div.codexModelSelectGroupTitle')) continue;
        const candidates = providerGroups(section, menu, owner.kind, groups);
        const buttons = owner.kind === 'codex'
          ? section.querySelectorAll(':scope > button.codexModelSelectOption[role="menuitemradio"]')
          : section.querySelectorAll(':scope > button[role="menuitemradio"][title]');
        for (const button of buttons) {
          if (button.hidden) continue;
          const label = modelLabel(button, owner.kind);
          if (!label) continue;
          const selection = matchingSelection(candidates, label), signature = JSON.stringify(selection);
          let record = icons.get(button);
          if (!record || record.icon.parentElement !== button) {
            record?.icon.remove();
            const icon = doc.createElement('span'); icon.className = 'wsp-icon wsp-model-menu-icon';
            icon.setAttribute('data-wsp-owned', ''); icon.setAttribute('aria-hidden', 'true');
            button.insertBefore(icon, button.firstChild);
            record = { icon, signature: undefined }; icons.set(button, record);
          }
          if (record.signature !== signature) {
            record.icon.innerHTML = markSVG(selection); record.icon.dataset.vendor = vendorName(selection); record.signature = signature;
          }
          seen.add(button);
        }
      }
    }
    for (const [button, record] of icons) if (!seen.has(button)) { record.icon.remove(); icons.delete(button); }
  }
  const scopeObserver = new win.MutationObserver(records => { if (records.some(r => !ownedMutation(r, win))) schedule(); });
  if (boundary) scopeObserver.observe(boundary, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-controls'] });
  const unsubscribe = directory.subscribe(schedule);
  update();
  return () => {
    disposed = true; win.cancelAnimationFrame(frame); unsubscribe(); scopeObserver.disconnect(); menuObserver.disconnect(); portalObserver.disconnect();
    for (const record of icons.values()) record.icon.remove(); icons.clear(); observedMenu = null;
  };
}
