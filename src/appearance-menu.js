// Heroicons paint-brush, 24px Outline. MIT, Tailwind Labs. See THIRD_PARTY_NOTICES.md.
const BRUSH = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"/></svg>';

const ENGLISH_LABELS = { rename: 'Rename', remove: 'Delete workspace', reveal: ['Show in folder', 'Show in Finder'] };

export function nativeWorkspaceMenuLabels(locale) {
  const native = locale.bind('workspace');
  let reveal = [];
  // Older Hosts may lack this contribution; their two-action menu needs no reveal label.
  try { const open = locale.bind('open-in-app'); reveal = [open('menu.reveal'), open('menu.finder')]; } catch { /* optional namespace */ }
  const rename = native('rename'), remove = native('delete.workspace');
  // Unresolved namespace keys are not captions; retain only the strict known English pattern.
  return rename === 'rename' || remove === 'delete.workspace' ? undefined : { rename, remove, reveal };
}

function knownMenuIcon(icon) {
  if (icon?.tagName !== 'SPAN' || icon.children.length !== 1) return false;
  let glyph = icon.firstElementChild;
  if (glyph.tagName === 'SPAN') {
    // RC.1 contextMenu.icon is inline:true: exactly one display:contents SPAN outlet.
    const outlet = glyph;
    if (outlet.getAttribute('data-slot') !== 'contextMenu.icon' || outlet.style.display !== 'contents'
      || outlet.matches('[data-slot-error], [tabindex], [contenteditable], [role]') || outlet.children.length !== 1) return false;
    glyph = outlet.firstElementChild;
    if ([...outlet.childNodes].some(node => node !== glyph && (node.nodeType !== 3 || node.textContent.trim()))) return false;
  }
  const unsafe = 'a, button, input, select, textarea, foreignObject, script, iframe, [contenteditable], [tabindex], [data-slot-error]';
  return glyph.tagName.toLowerCase() === 'svg' && glyph.namespaceURI === 'http://www.w3.org/2000/svg'
    && !glyph.matches(unsafe) && !glyph.querySelector(unsafe);
}

// Shared by discovery and insertion: only the known native two/three-action shapes.
// Caption identities come from the owner's locale namespace, never item positions.
export function workspaceMenuParts(menu, labels = ENGLISH_LABELS, ownedButton) {
  const owned = [...menu.querySelectorAll('[data-wsp-menu]')];
  if (menu.getAttribute('role') !== 'menu' || menu.querySelector('[role="menu"]')
    || (ownedButton ? owned.length !== 1 || owned[0] !== ownedButton : owned.length !== 0)) return null;
  const viewports = [...menu.children].filter(el => el.tagName === 'DIV' && el.getAttribute('role') === 'presentation');
  if (viewports.length !== 1) return null;
  const viewport = viewports[0];
  // MenuSurface's empty, non-interactive material is the only other known child.
  if ([...menu.children].some(el => el !== viewport && !(el.tagName === 'DIV' && el.getAttribute('aria-hidden') === 'true' && !el.children.length))) return null;
  const entries = [];
  for (const wrapper of viewport.children) {
    if (ownedButton && wrapper === ownedButton.parentElement && wrapper.hasAttribute('data-wsp-menu-wrapper') && wrapper.hasAttribute('data-wsp-owned') && wrapper.children.length === 1) continue;
    if (wrapper.tagName !== 'DIV') return null;
    if (wrapper.hasAttribute('data-slot')) {
      // MenuOverlay always renders its keyed content outlet, even without a contribution.
      // Only its single empty terminal anchor is known; populated/foreign outlets fail closed.
      if (wrapper !== viewport.lastChild || wrapper.dataset.slot !== 'contextMenu.content'
        || wrapper.style.display !== 'contents' || wrapper.style.length !== 1
        || wrapper.attributes.length !== 2 || wrapper.childNodes.length !== 0) return null;
      continue;
    }
    if (wrapper.getAttribute('role') === 'separator' && !wrapper.children.length) continue;
    const children = [...wrapper.children];
    const button = children.at(-1);
    if (!button || button.tagName !== 'BUTTON' || button.getAttribute('role') !== 'menuitem' || button.hasAttribute('aria-haspopup') || button.hasAttribute('data-wsp-owned')) return null;
    if (children.length !== 1 && !(children.length === 2 && children[0].getAttribute('role') === 'separator' && !children[0].children.length)) return null;
    const [icon, text, shortcut] = button.children;
    if (button.children.length < 2 || button.children.length > 3 || !knownMenuIcon(icon) || text.tagName !== 'SPAN' || text.children.length) return null;
    if (shortcut && (shortcut.tagName !== 'SPAN' || shortcut.getAttribute('aria-hidden') !== 'true' || shortcut.querySelector('button, a, input'))) return null;
    entries.push({ button, wrapper, icon, text, caption: text.textContent.trim() });
  }
  if (entries.length !== 2 && entries.length !== 3) return null;
  if (!labels?.rename || !labels?.remove || labels.rename === labels.remove) return null;
  const rename = entries.filter(entry => entry.caption === labels.rename);
  const remove = entries.filter(entry => entry.caption === labels.remove);
  if (rename.length !== 1 || remove.length !== 1) return null;
  const others = entries.filter(entry => entry !== rename[0] && entry !== remove[0]);
  if (others.some(entry => !(labels.reveal ?? []).includes(entry.caption))) return null;
  return { rename: rename[0], remove: remove[0] };
}

export function insertAppearanceItem(menu, id, label, onClick, labels) {
  const parts = workspaceMenuParts(menu, labels);
  if (!parts) return null;
  const doc = menu.ownerDocument;
  const { button: rename, icon: iconTemplate, text: labelTemplate } = parts.rename;
  const remove = parts.remove.button;
  const wrapper = doc.createElement('div'); wrapper.className = rename.parentElement.className;
  wrapper.setAttribute('data-wsp-owned', ''); wrapper.dataset.wspMenuWrapper = id;
  const button = doc.createElement('button');
  button.type = 'button'; button.setAttribute('role', 'menuitem'); button.setAttribute('data-wsp-owned', ''); button.dataset.wspMenu = id;
  button.className = rename.className;
  const icon = doc.createElement('span'); icon.className = iconTemplate.className; icon.setAttribute('aria-hidden','true'); icon.innerHTML = BRUSH;
  const text = doc.createElement('span'); text.className = labelTemplate.className; text.textContent = label;
  button.append(icon, text); button.addEventListener('click', onClick); wrapper.append(button);
  remove.parentElement.before(wrapper);
  return button;
}
