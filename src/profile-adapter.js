import { APPEARANCE_BRUSH_SVG } from './appearance-icon.js';

// Compatibility adapter, not an account extension API. Guarded against the
// AccountMenu markup shipped in DSH 0.2.2-rc.1 (MIT):
// https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.1/packages/client/ui-settings-account
// Installed client.js source SHA256: 45fe700e38deef67063f677c446f2d59908278bee572a376d09ce9eb6bab7ec5.
// No account operations, React internals, foreign entry.inject, or identity keys.

export const PROFILE_ADAPTER_CSS = `
[data-slot="settings.launcher"] [data-wsp-profile-native-hidden]{display:none!important}
[data-slot="settings.launcher"] [data-wsp-profile-name]{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-slot="settings.launcher"] img[data-wsp-profile-avatar]{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none}
[data-wsp-profile-menu] [data-wsp-profile-icon]{display:inline-flex;align-items:center;justify-content:center}
[data-wsp-profile-menu] [data-wsp-profile-icon] svg{width:16px;height:16px}
`;

// Exact native account dictionaries, not guesses from the plugin's language.
// A native language pack or changed core contract that does not match declines.
const COPY = [
  ['Account menu', 'Settings', 'Feedback', 'Sign out', 'Signed in to DeepSeek'],
  ['账号菜单', '设置', '意见反馈', '退出登录', '已登录 DeepSeek'],
  ['アカウントメニュー', '設定', 'フィードバック', 'ログアウト', 'DeepSeek にログイン済み'],
  ['Menú de cuenta', 'Configuración', 'Comentarios', 'Cerrar sesión', 'Iniciado sesión en DeepSeek'],
  ['Menu du compte', 'Paramètres', 'Commentaires', 'Se déconnecter', 'Connecté à DeepSeek'],
  ['Kontomenü', 'Einstellungen', 'Rückmeldung', 'Abmelden', 'Angemeldet bei DeepSeek'],
  ['Меню аккаунта', 'Настройки', 'Обратная связь', 'Выйти', 'Вошёл в DeepSeek'],
  ['Menu da conta', 'Configurações', 'Comentários', 'Sair', 'Conectado em DeepSeek'],
];
const CLASSES = { trigger: '_5Qcc8a_trigger', anchor: '_5Qcc8a_anchor', root: '_5Qcc8a_root', avatar: '_5Qcc8a_avatar', label: '_5Qcc8a_label' };
const SLOT = '[data-slot="settings.launcher"]';
let nextOwner = 0;

/**
 * Decorate only the known native signed-in launcher and its own popup.
 * Native children stay mounted and keep receiving fresh account updates.
 * @param {object} options - document, local preferences, translation and UI callbacks.
 * @returns {{refresh: () => void, dispose: () => void}} owned adapter lifetime.
 */
export function createProfileAdapter({ document: doc, preferences, translate, onEdit, onUnavailable = () => {} }) {
  const win = doc.defaultView, owner = String(++nextOwner), ownedSelector = `[data-wsp-profile-owned="${owner}"]`;
  let disposed = false, frame = 0, timer = 0, generation = 0;
  let current = null, opening = null, menuRecord = null, blocked = null, pendingEdit = null, closing = false;
  let nameNode = null, imageNode = null, failedImage = null, unavailableNotified = false;
  const hidden = new Map();
  const ours = node => node instanceof win.Element && node.getAttribute('data-wsp-profile-owned') === owner;
  const nativeChildren = element => [...element.children].filter(node => !ours(node));
  const mark = element => { element.setAttribute('data-wsp-owned', ''); element.setAttribute('data-wsp-profile-owned', owner); return element; };
  const text = element => element?.textContent?.trim() ?? '';
  const visible = element => element.isConnected && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && win.getComputedStyle(element).visibility !== 'hidden' && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;

  function readPreferences() {
    const state = preferences.getSnapshot();
    if (!state || state.version !== 1 || typeof state.enabled !== 'boolean'
      || !(state.name === null || typeof state.name === 'string' && state.name.trim() && state.name.length <= 80)
      || !(state.image === null || typeof state.image === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(state.image))) return null;
    return state;
  }
  function discover() {
    const slots = [...doc.querySelectorAll(SLOT)];
    if (slots.length !== 1 || slots[0].querySelector('[data-slot-error]')) return null;
    const slot = slots[0], triggers = slot.querySelectorAll('button[aria-haspopup="menu"][data-signed-out][data-collapsed]');
    if (triggers.length !== 1) return null;
    const trigger = triggers[0], anchor = trigger.parentElement, root = anchor?.parentElement;
    const copy = COPY.find(row => row[0] === trigger.getAttribute('aria-label'));
    if (!copy || trigger.type !== 'button' || !trigger.classList.contains(CLASSES.trigger)
      || !anchor?.classList.contains(CLASSES.anchor) || !root?.classList.contains(CLASSES.root) || root.parentElement !== slot
      || !['true', 'false'].includes(trigger.getAttribute('aria-expanded'))
      || !['true', 'false'].includes(trigger.getAttribute('data-collapsed'))
      || !['true', 'false'].includes(trigger.getAttribute('data-signed-out'))) return null;
    const signedIn = trigger.getAttribute('data-signed-out') === 'false', collapsed = trigger.getAttribute('data-collapsed') === 'true';
    const children = nativeChildren(trigger), label = collapsed ? null : children[1];
    if (children.length !== (collapsed ? 1 : 2) || label && (label.tagName !== 'SPAN' || !label.classList.contains(CLASSES.label))) return null;
    if (!signedIn) return { trigger, signedIn, collapsed, copy };
    const avatar = children[0];
    if (avatar?.tagName !== 'SPAN' || !avatar.classList.contains(CLASSES.avatar)
      || ![null, 'loading', 'ready', 'failed'].includes(avatar.getAttribute('data-avatar-status'))) return null;
    const pictures = nativeChildren(avatar);
    if (pictures.length !== 1 || !['svg', 'img'].includes(pictures[0].tagName.toLowerCase())) return null;
    const picture = pictures[0];
    if (picture.tagName === 'IMG' && (picture.getAttribute('alt') !== '' || !picture.classList.contains('zSpNNG_image'))) return null;
    return { trigger, signedIn, collapsed, copy, label, avatar, picture };
  }
  function baseline(target) {
    const value = text(target.label);
    return { name: !value || value === target.copy[4] ? null : value, image: target.picture.tagName === 'IMG' ? target.picture.getAttribute('src') || null : null };
  }
  function restoreHidden(element, previous) {
    if (element.getAttribute('data-wsp-profile-native-hidden') !== owner) return;
    if (previous === null) element.removeAttribute('data-wsp-profile-native-hidden');
    else element.setAttribute('data-wsp-profile-native-hidden', previous);
  }
  function restoreProjection() {
    nameNode?.remove(); imageNode?.remove(); nameNode = imageNode = null;
    for (const [element, previous] of hidden) restoreHidden(element, previous);
    hidden.clear();
  }
  function project(target, state) {
    if (failedImage !== state.image) failedImage = null;
    const showImage = state.image !== null && failedImage !== state.image;
    const wanted = new Set();
    if (state.name !== null && !target.collapsed) wanted.add(target.label);
    if (showImage) wanted.add(target.picture);
    for (const [element, previous] of hidden) if (!wanted.has(element)) { restoreHidden(element, previous); hidden.delete(element); }
    for (const element of wanted) {
      if (!hidden.has(element)) hidden.set(element, element.getAttribute('data-wsp-profile-native-hidden'));
      element.setAttribute('data-wsp-profile-native-hidden', owner);
    }
    if (state.name !== null && !target.collapsed) {
      if (nameNode?.parentElement !== target.trigger) { nameNode?.remove(); nameNode = mark(doc.createElement('span')); nameNode.setAttribute('data-wsp-profile-name', ''); target.trigger.append(nameNode); }
      if (nameNode.className !== target.label.className) nameNode.className = target.label.className;
      if (nameNode.textContent !== state.name) nameNode.textContent = state.name;
    } else { nameNode?.remove(); nameNode = null; }
    if (showImage) {
      if (imageNode?.parentElement !== target.avatar) {
        imageNode?.remove(); imageNode = mark(doc.createElement('img')); imageNode.setAttribute('data-wsp-profile-avatar', ''); imageNode.alt = ''; imageNode.draggable = false;
        const node = imageNode;
        node.addEventListener('error', () => {
          if (disposed || imageNode !== node) return;
          // Native React may have replaced SVG with IMG since this listener mounted.
          // Reveal the current native child immediately; owned removals do not schedule scans.
          const latest = discover(), picture = latest?.avatar === node.parentElement ? latest.picture : null;
          failedImage = node.getAttribute('src'); node.remove(); imageNode = null;
          if (picture && hidden.has(picture)) { restoreHidden(picture, hidden.get(picture)); hidden.delete(picture); }
          schedule();
        });
        target.avatar.append(imageNode);
      }
      if (imageNode.getAttribute('src') !== state.image) imageNode.src = state.image;
    } else { imageNode?.remove(); imageNode = null; }
  }
  function removeMenu() {
    if (menuRecord?.wrapper.contains(doc.activeElement) && menuRecord.trigger.isConnected) menuRecord.trigger.focus({ preventScroll: true });
    menuRecord?.wrapper.remove(); menuRecord = null;
  }
  function clearTimer() { win.clearTimeout(timer); timer = 0; }
  function unavailable() {
    generation++; pendingEdit = null; opening = null; clearTimer(); removeMenu(); restoreProjection(); current = null;
    if (!unavailableNotified) { unavailableNotified = true; onUnavailable(); }
  }
  function stopOpening() { generation++; opening = null; pendingEdit = null; clearTimer(); removeMenu(); }
  function denyPopup(trigger) { blocked = trigger; unavailable(); }
  function menuShape(menu, target) {
    if (menu.querySelector('[role="menu"]')) return null;
    const buttons = [...menu.querySelectorAll('button[role="menuitem"]')].filter(button => !ours(button) && button.closest('[role="menu"]') === menu);
    if (buttons.length !== 3) return null;
    const viewport = buttons[0].parentElement?.parentElement;
    if (viewport?.parentElement !== menu || viewport.getAttribute('role') !== 'presentation' || nativeChildren(viewport).length !== 3) return null;
    const labels = target.copy.slice(1, 4);
    for (let index = 0; index < buttons.length; index++) {
      const button = buttons[index], wrapper = button.parentElement, children = nativeChildren(button);
      if (button.type !== 'button' || button.hasAttribute('aria-haspopup') || wrapper?.tagName !== 'DIV' || wrapper.parentElement !== viewport
        || nativeChildren(wrapper).length !== 1 || wrapper.firstElementChild !== button
        || !wrapper.className || !button.className || wrapper.className !== buttons[0].parentElement.className || button.className !== buttons[0].className
        || children.length < 2 || children.length > (index === 0 ? 3 : 2)
        || children[0].tagName !== 'SPAN' || children[0].querySelectorAll('svg').length !== 1 || children[1].tagName !== 'SPAN'
        || text(children[1]) !== labels[index] || (index < 2 && button.disabled)) return null;
    }
    return { buttons, viewport };
  }
  function finishEdit(token) {
    if (disposed || pendingEdit?.token !== token) return;
    const state = readPreferences(), target = discover(), pending = pendingEdit;
    if (!state?.enabled || !target?.signedIn || target.trigger !== pending.trigger || blocked === target.trigger) { unavailable(); return; }
    if (target.trigger.getAttribute('aria-expanded') !== 'false' || pending.menu.isConnected) return;
    pendingEdit = null; clearTimer(); opening = null; removeMenu();
    target.trigger.focus({ preventScroll: true });
    onEdit({ anchor: target.trigger, baseline: baseline(target) });
  }
  function insert(menu, target, shape) {
    const [settings, feedback, auth] = shape.buttons;
    const wrapper = mark(doc.createElement('div')); wrapper.className = settings.parentElement.className; wrapper.setAttribute('data-wsp-profile-menu', '');
    const button = mark(doc.createElement('button')); button.type = 'button'; button.className = settings.className; button.setAttribute('role', 'menuitem'); button.disabled = auth.disabled;
    const icon = mark(doc.createElement('span')); icon.className = settings.children[0].className; icon.setAttribute('data-wsp-profile-icon', ''); icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = APPEARANCE_BRUSH_SVG;
    const label = mark(doc.createElement('span')); label.className = settings.children[1].className; label.textContent = translate('profileCustomize');
    button.append(icon, label); wrapper.append(button); feedback.parentElement.before(wrapper);
    const record = { menu, wrapper, button, label, trigger: target.trigger };
    menuRecord = record;
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      const state = readPreferences(), fresh = discover(), freshShape = fresh?.signedIn ? menuShape(menu, fresh) : null;
      if (disposed || menuRecord !== record || !state?.enabled || !fresh?.signedIn || fresh.trigger !== target.trigger
        || !freshShape || freshShape.buttons[2].disabled || fresh.trigger.getAttribute('aria-expanded') !== 'true') return;
      const candidates = [...doc.querySelectorAll('[role="menu"]')].filter(visible);
      if (candidates.length !== 1 || candidates[0] !== menu) { denyPopup(fresh.trigger); return; }
      const token = ++generation;
      pendingEdit = { token, trigger: fresh.trigger, menu }; opening = null; clearTimer();
      closing = true;
      try { fresh.trigger.click(); fresh.trigger.focus({ preventScroll: true }); }
      finally { closing = false; }
      timer = win.setTimeout(() => { if (pendingEdit?.token === token) unavailable(); }, 1000);
      win.queueMicrotask(() => finishEdit(token));
      schedule();
    });
  }
  function scanMenu(target) {
    if (pendingEdit) { finishEdit(pendingEdit.token); return; }
    if (target.trigger.getAttribute('aria-expanded') !== 'true') { opening = null; blocked = null; clearTimer(); removeMenu(); return; }
    if (!opening || opening.trigger !== target.trigger) { removeMenu(); return; }
    const menus = [...doc.querySelectorAll('[role="menu"]')].filter(visible);
    const fresh = menus.filter(menu => !opening.existing.has(menu));
    if (menus.length > 1 || fresh.length > 1) { denyPopup(target.trigger); return; }
    if (fresh.length !== 1) { if (menuRecord) denyPopup(target.trigger); return; }
    const menu = fresh[0], shape = menuShape(menu, target);
    if (!shape) { denyPopup(target.trigger); return; }
    clearTimer();
    if (menuRecord && (menuRecord.menu !== menu || menuRecord.wrapper.parentElement !== shape.viewport || !menuRecord.button.isConnected)) removeMenu();
    if (!menuRecord) insert(menu, target, shape);
    // Do not open another editor while the native owner is preparing sign-out.
    menuRecord.button.disabled = shape.buttons[2].disabled;
    const label = translate('profileCustomize');
    if (menuRecord.label.textContent !== label) menuRecord.label.textContent = label;
  }
  function scan() {
    if (disposed) return;
    const state = readPreferences(), target = discover();
    if (blocked && (!blocked.isConnected || blocked.getAttribute('aria-expanded') !== 'true')) blocked = null;
    if (!state?.enabled || !target?.signedIn || blocked === target.trigger) { unavailable(); return; }
    if (current && current.trigger !== target.trigger) unavailable();
    current = target; unavailableNotified = false;
    project(target, state); scanMenu(target);
  }
  function schedule() { if (!disposed && !frame) frame = win.requestAnimationFrame(() => { frame = 0; scan(); }); }
  function onClick(event) {
    const button = event.target instanceof win.Element ? event.target.closest('button') : null;
    if (closing || !button?.matches('button[aria-haspopup="menu"][data-signed-out][data-collapsed]') || !button.closest(SLOT)) return;
    const state = readPreferences(), target = discover();
    stopOpening(); blocked = null;
    if (!state?.enabled || !target?.signedIn || target.trigger !== button) { unavailable(); return; }
    if (button.getAttribute('aria-expanded') === 'false') {
      const token = generation;
      opening = { trigger: button, existing: new Set(doc.querySelectorAll('[role="menu"]')) };
      timer = win.setTimeout(() => { if (opening && generation === token) denyPopup(button); }, 1000);
    }
    schedule();
  }
  const observer = new win.MutationObserver(records => {
    if (records.some(record => {
      const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (element?.closest(ownedSelector)) return false;
      if (record.type !== 'childList') return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => !ours(node));
    })) schedule();
  });
  observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-slot', 'data-signed-out', 'data-collapsed', 'data-avatar-status', 'aria-expanded', 'aria-label', 'src', 'class', 'style', 'disabled', 'hidden', 'inert', 'aria-hidden'] });
  const unsubscribe = preferences.subscribe(schedule);
  doc.addEventListener('click', onClick, true);
  scan();
  return {
    refresh: schedule,
    dispose() {
      if (disposed) return;
      disposed = true; observer.disconnect(); win.cancelAnimationFrame(frame); clearTimer(); unsubscribe(); doc.removeEventListener('click', onClick, true);
      unavailable(); blocked = null;
    },
  };
}
