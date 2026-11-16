import { createStore } from './store.js';

// Keep this historical namespace stable: user overrides belong to the command ID.
export const UNREAD_COMMAND_ID = 'workspace-plus.session.mark-unread';
const binding = Object.freeze({ code: 'KeyU', modifiers: Object.freeze(['control', 'alt']) });
// Null means deliberately unbound. The public SDK represents that by omitting the profile.
export const UNREAD_DEFAULT_PROFILES = Object.freeze({
  'desktop:windows': binding,
  'desktop:linux': binding,
  'desktop:macos': null,
  'web:windows': binding,
  'web:linux': null,
  'web:macos': null,
});

export function createUnreadShortcut(ctx, { prefs, reminders, t }) {
  return {
    id: UNREAD_COMMAND_ID,
    label: () => t('markUnread'),
    aliases: ['mark session unread'],
    defaults: Object.fromEntries(Object.entries(UNREAD_DEFAULT_PROFILES).filter(([, value]) => value !== null)),
    regions: ['page', 'editable'],
    modals: ['sidebar'],
    resolve(context) {
      const settings = prefs.getSnapshot(), state = reminders.getSnapshot();
      const current = Object.values(ctx.sessions.list.getSnapshot().byId ?? {}).find(row => (row.retainedBy?.mainView ?? 0) > 0);
      // Windows/macOS Desktop ignore declarative regions/modals. Guard the real
      // main Conversation here, while allowing its composer to retain its draft/focus.
      if (!settings.features.unread || settings.error || state.error
        || ctx.shortcuts.config.getSnapshot().status !== 'ready'
        || !current || current.blank || typeof current.id !== 'string' || !current.id
        || !['page', 'editable'].includes(context.region)
        || context.modal !== null && context.modal !== 'sidebar'
        || ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return { status: 'blocked', reason: 'unavailable' };
      const sessionId = current.id;
      return { status: 'handled', run() {
        // Capture the ID at dispatch; never open/retain a Session to obtain it.
        try { void Promise.resolve(reminders.markUnread(sessionId)).catch(reason => reminders.reportError(reason)); }
        catch (reason) { reminders.reportError(reason); }
      } };
    },
  };
}

/** An optional child fiber keeps other features alive when the SDK service is absent. */
export function registerUnreadShortcuts(ctx, options) {
  const hint = createStore(undefined);
  if (typeof ctx.inject !== 'function') return hint;
  ctx.inject(['shortcuts', 'layout'], function unreadShortcuts(scope) {
    scope.effect(() => {
      const api = scope.shortcuts;
      let remove;
      const publish = () => {
        const row = api.catalog.getSnapshot().find(entry => entry.id === UNREAD_COMMAND_ID);
        const active = remove && api.config.getSnapshot().status === 'ready'
          && row?.binding && row.issue === null && row.conflicts.length === 0 && row.keys.length > 0;
        hint.set(active ? row : undefined);
      };
      const sync = () => {
        if (options.prefs.getSnapshot().features.unread) {
          if (!remove) {
            try { remove = api.register(createUnreadShortcut(scope, options)); }
            catch (reason) {
              hint.set(undefined);
              console.warn('Unread shortcut registration unavailable:', reason);
              return;
            }
          }
        } else {
          const off = remove;
          remove = undefined;
          off?.();
        }
        publish();
      };
      const offCatalog = api.catalog.subscribe(publish), offConfig = api.config.subscribe(publish);
      const offPrefs = options.prefs.subscribe(sync);
      sync();
      return () => {
        offPrefs(); offCatalog(); offConfig();
        const off = remove;
        remove = undefined;
        off?.();
        hint.set(undefined);
      };
    }, 'workspace-plus: unread shortcut');
  });
  return hint;
}
