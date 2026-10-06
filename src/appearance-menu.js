// Heroicons paint-brush, 24px Outline. MIT, Tailwind Labs. See THIRD_PARTY_NOTICES.md.
const BRUSH = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"/></svg>';

export function insertAppearanceItem(menu, id, label, onClick) {
  const doc = menu.ownerDocument;
  const buttons = [...menu.querySelectorAll('button[role="menuitem"]')].filter(b => b.closest('[role="menu"]') === menu);
  if (buttons.length !== 2) return null;
  const [rename, remove] = buttons;
  const iconTemplate = rename.querySelector(':scope > span:has(> svg)');
  const labelTemplate = [...rename.children].find(el => el.tagName === 'SPAN' && el !== iconTemplate);
  const wrapped = rename.parentElement !== menu && rename.parentElement?.parentElement === remove.parentElement?.parentElement;
  // Native RC.2 uses viewport > itemWrap > button > icon,label. Do not invent styling for an unknown menu.
  if (!iconTemplate || !labelTemplate || !wrapped || rename.parentElement === remove.parentElement) return null;
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
