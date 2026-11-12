import React, { useLayoutEffect, useRef, useState } from 'react';
import { MenuItemButton, StateDot, Tooltip, Toast } from '@deepseek-ai/dsh-client-ui-primitives';
import { useStore } from './use-store.js';
import { attachSidebarBranding } from './sidebar-branding.js';
import { registerUnreadShortcuts } from './unread-shortcuts.js';

export const SESSION_ACTION_CSS = `
.wsp-session-action-root{display:contents}
.wsp-session-action{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;margin:-4px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit}
.wsp-session-action:hover{color:var(--dsw-alias-label-primary)}
.wsp-session-action:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:-2px;border-radius:3px}
.wsp-session-action:disabled{opacity:.5;cursor:default}
.wsp-manual-unread{display:inline-flex;align-items:center;justify-content:center;line-height:1}
.wsp-unread-error{display:block;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;max-width:260px}
`;

function UnreadIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
    <path d="M12 3H2.5A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V7M1.5 4l6.5 5 4-3" />
    <circle cx="13.5" cy="3.5" r="2" fill="currentColor" stroke="none" />
  </svg>;
}

export function registerSidebarFeatures(ctx, { prefs, reminders, namespace }) {
  const unreadShortcut = registerUnreadShortcuts(ctx, { prefs, reminders, t: key => ctx.locale.bind(namespace)(key) });
  function MenuItem({ sessionId, useMenuOpenState, t }) {
    const settings = useStore(prefs), state = useStore(reminders), shortcut = useStore(unreadShortcut);
    const [, setOpen] = useMenuOpenState();
    if (!settings.features.unread) return null;
    return <div data-wsp-owned="">
      <MenuItemButton icon={<UnreadIcon />} shortcut={shortcut} onSelect={() => {
        // Native Menu returns keyboard focus only for a synchronous selection close.
        // Green state still publishes solely after the durable locked write; failure
        // uses a native Toast, not a success indicator or an unmounted menu message.
        setOpen(false);
        void reminders.markUnread(sessionId).catch(reason => reminders.reportError(reason));
      }}>{t('markUnread')}</MenuItemButton>
      {state.error && <span role="alert" className="wsp-unread-error">{state.error}</span>}
    </div>;
  }
  function RowAction({ sessionId, t }) {
    const settings = useStore(prefs), state = useStore(reminders), [error, setError] = useState('');
    if (!settings.features.unread) return null;
    // Keep the ownership wrapper out of row layout; Tooltip still anchors to the button.
    return <span data-wsp-owned="" className="wsp-session-action-root">
      <Tooltip label={t('markUnread')} side="bottom" align="end" delayMs={500}>
        <button type="button" className="wsp-session-action" aria-label={t('markUnread')} onClick={async event => {
          event.stopPropagation();
          try { await reminders.markUnread(sessionId); setError(''); }
          catch (reason) { setError(t('unreadFailed') + ' ' + reason.message); reminders.reportError(reason); }
        }}><UnreadIcon size={14} /></button>
      </Tooltip>
      {(error || state.error) && <span role="alert" className="wsp-unread-error">{error || state.error}</span>}
    </span>;
  }
  function Leading({ sessionId, t }) {
    const settings = useStore(prefs), state = useStore(reminders);
    if (!settings.features.unread || !Object.hasOwn(state.unread, sessionId)) return null;
    // Native RC.2 mounts this slot only for idle, non-archived rows. Its live
    // activity, child activity, completion and pending-interaction dots win.
    return <span className="wsp-manual-unread" data-wsp-owned="" role="img" aria-label={t('unreadLabel')} title={t('unreadLabel')}><StateDot state="done" /></span>;
  }
  function FailureNotice({ t }) {
    const state = useStore(reminders), [dismissed, setDismissed] = useState(0);
    if (!state.lastError || state.errorSequence === dismissed) return null;
    return <span data-wsp-owned=""><Toast key={state.errorSequence} text={t('unreadFailed') + ' ' + state.lastError} icon={<UnreadIcon />} holdMs={8000} onDone={() => setDismissed(state.errorSequence)} /></span>;
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'workspace-plus-unread-error', order: 95, locale: namespace,
  }, FailureNotice));
  function BrandName() {
    const marker = useRef(null);
    useLayoutEffect(() => marker.current ? attachSidebarBranding(marker.current) : undefined, []);
    // A failed shape guard leaves a readable fallback name and the original
    // mark intact instead of hiding unrelated navigation or model logos.
    return <span ref={marker} data-wsp-owned="">DeepSeek Harness</span>;
  }
  ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
    name: 'sidebar.workspaces.session.menu.item', id: 'workspace-plus-unread', order: 250, locale: namespace,
  }, MenuItem));
  ctx.slots.inject('sidebar.workspaces.session.row.action', () => ctx.slots.register({
    name: 'sidebar.workspaces.session.row.action', id: 'workspace-plus-unread', order: 50, locale: namespace,
  }, RowAction));
  ctx.slots.inject('sidebar.session.row.leading', () => ctx.slots.register({
    name: 'sidebar.session.row.leading', id: 'workspace-plus-unread', order: 0, locale: namespace,
  }, Leading));
  ctx.slots.inject('sidebar.brand.name', () => {
    let remove;
    function sync() {
      if (prefs.getSnapshot().features.branding && !remove) remove = ctx.slots.register({
        name: 'sidebar.brand.name', id: 'workspace-plus-brand-name', priority: -100,
      }, BrandName);
      else if (!prefs.getSnapshot().features.branding && remove) { remove(); remove = undefined; }
    }
    const unsubscribe = prefs.subscribe(sync);
    sync();
    return () => { unsubscribe(); remove?.(); };
  });
}
