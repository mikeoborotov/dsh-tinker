import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
import { createPreferences, createStore } from './store.js';
import { ICON_IDS } from './icons.js';
import { createDOMAdapter, attachComposerIcon } from './adapters.js';
import { nativeWorkspaceMenuLabels } from './appearance-menu.js';
import { attachModelMenuIcons } from './model-menu.js';
import { createWorkspacePickerAdapter } from './workspace-picker.js';
import { CSS } from './styles.js';
import { dictionaries } from './locales.js';
import { AppearanceDialog } from './appearance-dialog.jsx';
import { useStore } from './use-store.js';
import { createUnreadStore, observeSessionOpenings, UNREAD_STORAGE_KEY, UNREAD_CHANGE_EVENT } from './unread.js';
import { registerSidebarFeatures, SESSION_ACTION_CSS } from './session-actions.jsx';
import { BRANDING_CSS } from './sidebar-branding.js';
import { createProfilePreferences, PROFILE_STORAGE_KEY } from './profile-store.js';
import { ProfileDialog } from './profile-dialog.jsx';
import { createProfileAdapter, PROFILE_ADAPTER_CSS } from './profile-adapter.js';
import { SettingsSectionIcon } from './settings-icon.jsx';

export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'modelDirectories', 'remote', 'remote.session'];
const NS = 'workspacePlus';
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SettingsFeature({ label, description, checked, onChange, disabled = false }) {
  return <div className="wsp-settings-feature">
    <div className="wsp-settings-feature-copy"><div className="wsp-settings-feature-label">{label}</div><div className="wsp-settings-feature-description">{description}</div></div>
    <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
  </div>;
}

function Settings({ prefs, profilePrefs, reminders, t }) {
  const state = useStore(prefs), profileState = useStore(profilePrefs), unreadState = useStore(reminders), [error, setError] = useState('');
  async function safe(fn) { try { await fn(); setError(''); } catch (e) { setError(String(e.code ?? '').startsWith('profile') ? t(e.code) : e.message); } }
  const feature = key => <SettingsFeature key={key} label={t(key)} description={t(key + 'Description')} checked={state.features[key]} onChange={next => safe(() => prefs.toggle(key, next))} />;
  return <section className="wsp-panel">
    <h2>Tinker</h2>
    <p className="wsp-settings-description">{t('settingsDescription')}</p>
    <section className="wsp-settings-group">
      <h3>{t('settingsAppearance')}</h3><div className="wsp-settings-card">
        {feature('workspaces')}
        <SettingsFeature label={t('profileFeature')} description={t('profileFeatureDescription')} checked={profileState.enabled} disabled={Boolean(profileState.error)} onChange={next => safe(() => profilePrefs.toggle(next))} />
        {feature('branding')}
      </div>
      {profileState.error && <div role="alert" className="wsp-error">{t(profileState.error)} <Button size="sm" onClick={() => safe(() => profilePrefs.retry())}>{t('retry')}</Button></div>}
    </section>
    <section className="wsp-settings-group"><h3>{t('settingsModelLogos')}</h3><div className="wsp-settings-card">{feature('composer')}{feature('sessions')}</div></section>
    <section className="wsp-settings-group"><h3>{t('settingsChats')}</h3><div className="wsp-settings-card">{feature('unread')}</div></section>
    {(state.error || error) && <div role="alert" className="wsp-error">{error || state.error}</div>}
    {(state.error || state.recoveryAvailable) && <details className="wsp-settings-recovery">
      <summary>{t('recoveryTitle')}</summary>
      <div className="wsp-settings-recovery-body"><p>{t('recoveryHint')}</p><p>{t('recoveryScope')}</p><p>{t('recoverySource')}</p>
        <div className="wsp-row"><Button size="sm" variant="outline" onClick={() => safe(() => download(prefs.backup(), 'tinker-recovery.json'))}>{t('backup')}</Button>
          {state.error && <><Button size="sm" onClick={() => safe(() => prefs.retry())}>{t('retry')}</Button><Button size="sm" onClick={() => safe(() => { if (window.confirm(t('resetConfirm'))) prefs.resetAll(); })}>{t('resetAll')}</Button></>}
        </div>
      </div>
    </details>}
    {(unreadState.error || unreadState.lastError) && <>
      <div role="alert" className="wsp-error">{t('unreadRecovery')} {unreadState.error || unreadState.lastError}</div>
      <div className="wsp-row"><Button size="sm" variant="outline" onClick={() => safe(() => download(reminders.backup(), 'tinker-unread-recovery.json'))}>{t('backup')}</Button>
        <Button size="sm" onClick={() => safe(() => reminders.refresh())}>{t('retry')}</Button>
        <Button size="sm" onClick={() => safe(() => { if (window.confirm(t('unreadResetConfirm'))) return reminders.resetAll(); })}>{t('resetAll')}</Button></div>
    </>}
  </section>;
}

export function apply(ctx) {
  const locale = ctx.locale, prefs = createPreferences(window.localStorage, ICON_IDS), ui = createStore({ target: null }), currentModels = createStore({});
  const reminders = createUnreadStore(window.localStorage), profilePrefs = createProfilePreferences(window.localStorage);
  const closeProfile = () => { if (ui.getSnapshot().profileTarget) ui.set({ target: null }); };
  ctx.effect(() => locale.register(NS, dictionaries));
  const t = locale.bind(NS);
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.wspOwned = ''; style.textContent = CSS + SESSION_ACTION_CSS + BRANDING_CSS + PROFILE_ADAPTER_CSS; document.head.append(style); return () => style.remove(); });
  ctx.effect(() => {
    const adapter = createDOMAdapter({ document, preferences: prefs, sessions: ctx.sessions, workspaces: ctx.workspaces, currentModels, onEdit: (id, anchor) => ui.set({ target: { id, anchor } }), translate: t, workspaceMenuLabels: () => nativeWorkspaceMenuLabels(locale) });
    const unsubscribe = ctx.on('connection/reset', () => adapter.reconnect());
    return () => { unsubscribe(); adapter.dispose(); };
  });
  ctx.effect(() => createWorkspacePickerAdapter({ document, preferences: prefs, workspaces: ctx.workspaces, defaultName: () => locale.bind('workspace')('workspace.defaultName') }).dispose);
  ctx.effect(() => observeSessionOpenings(ctx.sessions, reminders));
  ctx.effect(() => {
    const adapter = createProfileAdapter({ document, preferences: profilePrefs, translate: t,
      onEdit: profileTarget => { if (profilePrefs.getSnapshot().enabled) ui.set({ target: null, profileTarget }); },
      onUnavailable: closeProfile });
    const unsubscribe = profilePrefs.subscribe(() => { if (!profilePrefs.getSnapshot().enabled) closeProfile(); });
    const disconnect = ctx.on('connection/reset', () => { closeProfile(); adapter.refresh(); });
    return () => { disconnect(); unsubscribe(); adapter.dispose(); closeProfile(); };
  });
  ctx.effect(() => {
    const onStorage = event => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === UNREAD_STORAGE_KEY || event.key === null) reminders.refresh();
      if (event.key === PROFILE_STORAGE_KEY || event.key === null) profilePrefs.refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(UNREAD_CHANGE_EVENT, reminders.onChange);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(UNREAD_CHANGE_EVENT, reminders.onChange); };
  });
  registerSidebarFeatures(ctx, { prefs, reminders, namespace: NS });
  function Overlay(props) {
    const { target, profileTarget } = useStore(ui), profileState = useStore(profilePrefs);
    if (profileTarget && profileState.enabled) return <ProfileDialog prefs={profilePrefs} baseline={profileTarget.baseline} anchor={profileTarget.anchor} t={props.t} onClose={closeProfile} />;
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
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'workspace-plus', order: 80, label: 'Tinker', locale: NS }, props => <Settings prefs={prefs} profilePrefs={profilePrefs} reminders={reminders} t={props.t} />));
  // Older Hosts have no icon seat: public inject waits without registering an unknown slot.
  ctx.slots.inject('settings.section.icon', () => ctx.slots.register({ name: 'settings.section.icon', id: 'workspace-plus' }, SettingsSectionIcon));
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'workspace-plus-model', order: 10,
    inject: sessionId => ({ sessionId, directory: ctx.modelDirectories.directoryFor(sessionId).store }),
  }, Composer));
}
