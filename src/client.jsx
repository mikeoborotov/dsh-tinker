import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPreferences, createStore } from './store.js';
import { ICON_IDS } from './icons.js';
import { createDOMAdapter, attachComposerIcon } from './adapters.js';
import { attachModelMenuIcons } from './model-menu.js';
import { createWorkspacePickerAdapter } from './workspace-picker.js';
import { CSS } from './styles.js';
import { dictionaries } from './locales.js';
import { AppearanceDialog } from './appearance-dialog.jsx';
import { useStore } from './use-store.js';
import { createUnreadStore, observeSessionOpenings, UNREAD_STORAGE_KEY, UNREAD_CHANGE_EVENT } from './unread.js';
import { registerSidebarFeatures, SESSION_ACTION_CSS } from './session-actions.jsx';
import { BRANDING_CSS } from './sidebar-branding.js';

export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'modelDirectories', 'remote', 'remote.session'];
const NS = 'workspacePlus';
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Settings({ prefs, reminders, workspaces, ui, t, close }) {
  const state = useStore(prefs), unreadState = useStore(reminders), list = useStore(workspaces.list), [error, setError] = useState('');
  async function safe(fn) { try { await fn(); setError(''); } catch (e) { setError(e.message); } }
  return <section className="wsp-panel">
    <h2>Workspace Plus</h2>
    <p>{t('adapterHint')}</p>
    {['workspaces','composer','sessions','unread','branding'].map(key => <div key={key} className="wsp-toggle"><span>{t(key)}</span><button role="switch" aria-label={t(key)} aria-checked={state.features[key]} onClick={() => safe(() => prefs.toggle(key, !state.features[key]))}>{t(state.features[key] ? 'on' : 'off')}</button></div>)}
    <label htmlFor="wsp-workspace">{t('editWorkspace')}</label><select id="wsp-workspace" value="" onChange={e => { if (e.target.value) { const id = e.target.value; close?.(); queueMicrotask(() => ui.set({ target: { id } })); } }}>
      <option value="">{t('chooseWorkspace')}</option>{list.items.map(w => <option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>)}</select>
    {(state.error || error) && <div role="alert" className="wsp-error">{error || state.error}</div>}
    {(state.error || state.recoveryAvailable) && <>
      <p>{t('recoveryHint')}</p>
      <div className="wsp-row"><button onClick={() => safe(() => download(prefs.backup(), 'workspace-plus-recovery.json'))}>{t('backup')}</button>
        {state.error && <><button onClick={() => safe(() => prefs.retry())}>{t('retry')}</button><button onClick={() => safe(() => { if (window.confirm(t('resetConfirm'))) prefs.resetAll(); })}>{t('resetAll')}</button></>}
      </div>
    </>}
    {(unreadState.error || unreadState.lastError) && <>
      <div role="alert" className="wsp-error">{t('unreadRecovery')} {unreadState.error || unreadState.lastError}</div>
      <div className="wsp-row"><button onClick={() => safe(() => download(reminders.backup(), 'workspace-plus-unread-recovery.json'))}>{t('backup')}</button>
        <button onClick={() => safe(() => reminders.refresh())}>{t('retry')}</button>
        <button onClick={() => safe(() => { if (window.confirm(t('unreadResetConfirm'))) return reminders.resetAll(); })}>{t('resetAll')}</button></div>
    </>}
  </section>;
}

export function apply(ctx) {
  const locale = ctx.locale, prefs = createPreferences(window.localStorage, ICON_IDS), ui = createStore({ target: null }), currentModels = createStore({});
  const reminders = createUnreadStore(window.localStorage);
  ctx.effect(() => locale.register(NS, dictionaries));
  const t = locale.bind(NS);
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.wspOwned = ''; style.textContent = CSS + SESSION_ACTION_CSS + BRANDING_CSS; document.head.append(style); return () => style.remove(); });
  ctx.effect(() => {
    const adapter = createDOMAdapter({ document, preferences: prefs, sessions: ctx.sessions, workspaces: ctx.workspaces, currentModels, onEdit: (id, anchor) => ui.set({ target: { id, anchor } }), translate: t });
    const unsubscribe = ctx.on('connection/reset', () => adapter.reconnect());
    return () => { unsubscribe(); adapter.dispose(); };
  });
  ctx.effect(() => createWorkspacePickerAdapter({ document, preferences: prefs, workspaces: ctx.workspaces, defaultName: () => locale.bind('workspace')('workspace.defaultName') }).dispose);
  ctx.effect(() => observeSessionOpenings(ctx.sessions, reminders));
  ctx.effect(() => {
    const onStorage = event => { if (event.storageArea === window.localStorage && (event.key === UNREAD_STORAGE_KEY || event.key === null)) reminders.refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(UNREAD_CHANGE_EVENT, reminders.onChange);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(UNREAD_CHANGE_EVENT, reminders.onChange); };
  });
  registerSidebarFeatures(ctx, { prefs, reminders, namespace: NS });
  function Overlay(props) {
    const { target } = useStore(ui);
    return target ? <AppearanceDialog key={target.id} target={target} prefs={prefs} ui={ui} workspaces={ctx.workspaces} t={props.t} lang={props.lang} /> : null;
  }
  function Composer({ directory, sessionId }) {
    const state = useStore(directory), settings = useStore(prefs), marker = useRef(null);
    useEffect(() => {
      currentModels.set(s => ({ ...s, [sessionId]: state.pending ?? state.current }));
      return () => currentModels.set(s => { const next = { ...s }; delete next[sessionId]; return next; });
    }, [sessionId, state.current, state.pending]);
    useLayoutEffect(() => {
      if (!marker.current || !settings.features.composer) return;
      return attachComposerIcon(marker.current, state.pending ?? state.current);
    }, [state.current, state.pending, settings.features.composer]);
    useLayoutEffect(() => {
      if (!marker.current || !settings.features.composer) return;
      return attachModelMenuIcons(marker.current, directory);
    }, [directory, settings.features.composer]);
    // The slot gives a scoped lifecycle and shared ModelDirectory. Discovery does not register a second picker.
    return <span ref={marker} data-wsp-owned="" style={{ display: 'none' }} />;
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'workspace-plus-dialog', order: 90, locale: NS }, Overlay));
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'workspace-plus', order: 80, label: 'Workspace Plus', locale: NS }, props => <Settings prefs={prefs} reminders={reminders} ui={ui} workspaces={ctx.workspaces} t={props.t} close={props.close} />));
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'workspace-plus-model', order: 10,
    inject: sessionId => ({ sessionId, directory: ctx.modelDirectories.directoryFor(sessionId).store }),
  }, Composer));
}
