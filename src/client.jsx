import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPreferences, createStore } from './store.js';
import { ICONS, ICON_IDS, PALETTE, fillAppearance } from './icons.js';
import { createDOMAdapter, attachComposerIcon } from './adapters.js';
import { CSS } from './styles.js';
import { dictionaries } from './locales.js';

export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'modelDirectories', 'remote', 'remote.session'];
const NS = 'workspacePlus';
const DEFAULT_ICON = { kind: 'icon', icon: 'folder', color: PALETTE[0] };
const EMOJI = ['💻','🛠','🏠','💼','🚀','📚','💰','🎨','🧠','🌍','📦','🔬','⭐','🎵','📬','🗂'];
function useStore(store) { return useSyncExternalStore(useCallback(fn => store.subscribe(fn), [store]), useCallback(() => store.getSnapshot(), [store])); }
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Preview({ appearance }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) fillAppearance(ref.current, appearance); }, [appearance]);
  return <span ref={ref} className="wsp-icon" aria-hidden="true" />;
}
async function imageData(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('imageType');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 16000000) throw new Error('imageSize');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 128 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

function AppearanceDialog({ target, prefs, ui, workspaces, t, lang }) {
  const settings = useStore(prefs), list = useStore(workspaces.list);
  const workspace = list.items.find(w => w.workspaceId === target.id);
  const [appearance, setAppearance] = useState(() => prefs.appearance(target.id) ?? DEFAULT_ICON);
  const [alias, setAlias] = useState(() => settings.bindings[target.id] ?? workspace?.title ?? target.id);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const panel = useRef(null), uploadGeneration = useRef(0);
  const close = () => ui.set({ target: null });
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector('button')?.focus();
    const key = event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el => el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { uploadGeneration.current++; document.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); else target.anchor?.focus(); };
  }, []);
  useEffect(() => { if (list.phase === 'ready' && !workspace) close(); }, [workspace, list.phase]);
  function run(fn) { try { fn(); close(); } catch (e) { setError(e.message); } }
  async function upload(file) {
    if (!file) return;
    const generation = ++uploadGeneration.current; setLoading(true); setError('');
    try { const data = await imageData(file); if (generation === uploadGeneration.current) setAppearance({ kind: 'image', data }); }
    catch (e) { if (generation === uploadGeneration.current) setError(t(e.message) ?? e.message); }
    finally { if (generation === uploadGeneration.current) setLoading(false); }
  }
  return <div className="wsp-mask" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <section ref={panel} className="wsp-panel wsp-dialog" role="dialog" aria-modal="true" aria-labelledby="wsp-dialog-title">
      <h2 id="wsp-dialog-title">{t('appearance')}: {workspace?.title}</h2>
      <div className="wsp-row" role="group" aria-label={t('kind')}>
        {['icon','emoji','image'].map(kind => <button key={kind} aria-pressed={appearance.kind === kind} onClick={() => {
          uploadGeneration.current++; setLoading(false);
          setAppearance(kind === 'icon' ? DEFAULT_ICON : kind === 'emoji' ? { kind, emoji: '💻' } : { kind, data: '' });
        }}>{t(kind)}</button>)}
      </div>
      {appearance.kind === 'icon' && <>
        <div className="wsp-grid" role="group" aria-label={t('icon')}>
          {ICONS.map(icon => <button key={icon.id} title={t('icon.' + icon.id)} aria-label={t('icon.' + icon.id)} aria-pressed={appearance.icon === icon.id} onClick={() => setAppearance({ ...appearance, icon: icon.id })}>
            <span className="wsp-icon" style={{ color: appearance.color }} dangerouslySetInnerHTML={{ __html: icon.svg }} />
          </button>)}
        </div>
        <label>{t('color')}</label><div className="wsp-row wsp-palette">
          {PALETTE.map(color => <button key={color} title={color} aria-label={color} aria-pressed={color === appearance.color} style={{ '--wsp-art-color': color }} onClick={() => setAppearance({ ...appearance, color })} />)}
          <input type="color" aria-label={t('customColor')} value={appearance.color} onChange={e => setAppearance({ ...appearance, color: e.target.value })} />
        </div>
      </>}
      {appearance.kind === 'emoji' && <>
        <label htmlFor="wsp-emoji">{t('emoji')}</label><input id="wsp-emoji" type="text" maxLength={32} value={appearance.emoji} onChange={e => setAppearance({ kind: 'emoji', emoji: e.target.value })} />
        <div className="wsp-row" style={{ marginTop: 12 }}>{EMOJI.map(emoji => <button key={emoji} aria-label={emoji} onClick={() => setAppearance({ kind: 'emoji', emoji })}>{emoji}</button>)}</div>
      </>}
      {appearance.kind === 'image' && <>
        <label htmlFor="wsp-upload">{t('upload')}</label><input id="wsp-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => upload(e.target.files[0])} />
        <p>{t('imageHint')}</p>
      </>}
      <div className="wsp-preview"><Preview appearance={appearance} /><span>{workspace?.title}</span></div>
      <label htmlFor="wsp-alias">{t('profileName')}</label><input id="wsp-alias" type="text" maxLength={80} value={alias} onChange={e => setAlias(e.target.value)} />
      <p>{t('profileHint')}</p>
      {Object.keys(settings.profiles).length > 0 && <><label htmlFor="wsp-saved">{t('savedProfiles')}</label><select id="wsp-saved" value="" onChange={e => { if (e.target.value) { setAlias(e.target.value); setAppearance(settings.profiles[e.target.value]); } }}>
        <option value="">{t('chooseProfile')}</option>{Object.keys(settings.profiles).map(name => <option key={name} value={name}>{name}</option>)}
      </select></>}
      {error && <div role="alert" className="wsp-error">{error}</div>}
      <div className="wsp-actions">
        <button onClick={() => run(() => prefs.resetWorkspace(target.id))}>{t('reset')}</button><button onClick={close}>{t('cancel')}</button>
        <button disabled={loading || !alias.trim() || appearance.kind === 'image' && !appearance.data} onClick={() => run(() => prefs.save(target.id, alias.trim(), appearance))}>{loading ? t('loading') : t('save')}</button>
      </div>
    </section>
  </div>;
}

function Settings({ prefs, workspaces, ui, t, close }) {
  const state = useStore(prefs), list = useStore(workspaces.list), [error, setError] = useState('');
  function safe(fn) { try { fn(); setError(''); } catch (e) { setError(e.message); } }
  return <section className="wsp-panel">
    <h2>Workspace Plus</h2>
    <p>{t('adapterHint')}</p>
    {['workspaces','composer','sessions'].map(key => <div key={key} className="wsp-toggle"><span>{t(key)}</span><button role="switch" aria-label={t(key)} aria-checked={state.features[key]} onClick={() => safe(() => prefs.toggle(key, !state.features[key]))}>{t(state.features[key] ? 'on' : 'off')}</button></div>)}
    <label htmlFor="wsp-workspace">{t('editWorkspace')}</label><select id="wsp-workspace" value="" onChange={e => { if (e.target.value) { const id = e.target.value; close?.(); queueMicrotask(() => ui.set({ target: { id } })); } }}>
      <option value="">{t('chooseWorkspace')}</option>{list.items.map(w => <option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>)}
    </select>
    <p>{t('transferHint')}</p><div className="wsp-row"><button onClick={() => download(prefs.export(), 'dsh-workspace-plus.json')}>{t('export')}</button><label style={{ margin: 0 }}>{t('import')}<input type="file" accept="application/json,.json" aria-label={t('import')} onChange={async e => {
      const file = e.target.files[0]; if (!file) return;
      try { if (file.size > 2 * 1024 * 1024) throw new Error(t('fileSize')); prefs.import(await file.text()); setError(''); }
      catch (reason) { setError(reason.message); }
      e.target.value = '';
    }} /></label></div>
    {(state.error || error) && <div role="alert" className="wsp-error">{state.error || error}</div>}
    {state.error && <div className="wsp-row"><button onClick={() => download(prefs.backup(), 'workspace-plus-backup.json')}>{t('backup')}</button><button onClick={() => { if (window.confirm(t('resetConfirm'))) prefs.resetAll(); }}>{t('resetAll')}</button></div>}
  </section>;
}

export function apply(ctx) {
  const locale = ctx.locale, prefs = createPreferences(window.localStorage, ICON_IDS), ui = createStore({ target: null }), currentModels = createStore({});
  ctx.effect(() => locale.register(NS, dictionaries));
  const t = locale.bind(NS);
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.wspOwned = ''; style.textContent = CSS; document.head.append(style); return () => style.remove(); });
  ctx.effect(() => {
    const adapter = createDOMAdapter({ document, preferences: prefs, sessions: ctx.sessions, workspaces: ctx.workspaces, currentModels, onEdit: (id, anchor) => ui.set({ target: { id, anchor } }), translate: t });
    const unsubscribe = ctx.on('connection/reset', () => adapter.reconnect());
    return () => { unsubscribe(); adapter.dispose(); };
  });
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
    // The slot gives a scoped lifecycle and shared ModelDirectory. Discovery does not register a second picker.
    return <span ref={marker} data-wsp-owned="" style={{ display: 'none' }} />;
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'workspace-plus-dialog', order: 90, locale: NS }, Overlay));
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'workspace-plus', order: 80, label: 'Workspace Plus', locale: NS }, props => <Settings prefs={prefs} ui={ui} workspaces={ctx.workspaces} t={props.t} close={props.close} />));
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'workspace-plus-model', order: 10,
    inject: sessionId => ({ sessionId, directory: ctx.modelDirectories.directoryFor(sessionId).store }),
  }, Composer));
}
