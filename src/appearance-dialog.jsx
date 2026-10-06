import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, observeComposition } from '@deepseek-ai/dsh-client-ui-primitives';
import { ICONS, ICON_IDS, PALETTE, fillAppearance } from './icons.js';
import { validateAppearance } from './store.js';
import { useStore } from './use-store.js';
import { EMOJI_GROUPS, normalizeSearch, searchEmoji } from './emoji-catalog.js';
import { IMAGE_ACCEPT, imageData } from './image-upload.js';

const DEFAULT_ICON = { kind: 'icon', icon: 'folder', color: PALETTE[0] };
const PAGE_SIZE = 120;
const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files');

function Preview({ appearance }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) fillAppearance(ref.current, appearance); }, [appearance]);
  return <span ref={ref} className="wsp-icon" aria-hidden="true" />;
}

export function AppearanceDialog({ target, prefs, ui, workspaces, t, lang }) {
  const settings = useStore(prefs), list = useStore(workspaces.list);
  const workspace = list.items.find(item => item.workspaceId === target.id);
  const initial = useRef(prefs.appearance(target.id) ?? DEFAULT_ICON).current;
  const [kind, setKind] = useState(initial.kind);
  const [drafts, setDrafts] = useState(() => ({
    icon: DEFAULT_ICON, emoji: { kind: 'emoji', emoji: '💻' }, image: { kind: 'image', data: '' }, [initial.kind]: initial,
  }));
  const appearance = drafts[kind];
  const [alias, setAlias] = useState(() => settings.bindings[target.id] ?? (workspace?.title || target.id).slice(0, 80));
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [iconQuery, setIconQuery] = useState(''), [emojiQuery, setEmojiQuery] = useState('');
  const [emojiGroup, setEmojiGroup] = useState('all'), [emojiLimit, setEmojiLimit] = useState(PAGE_SIZE);
  const [dragging, setDragging] = useState(false);
  const uploadGeneration = useRef(0), dragDepth = useRef(0), uploadInput = useRef(null), compositionObserver = useRef(null);
  const russian = String(lang ?? t('language')).startsWith('ru');
  const close = () => { uploadGeneration.current++; ui.set({ target: null }); };
  function setAppearance(next) {
    setKind(next.kind); setDrafts(previous => ({ ...previous, [next.kind]: next }));
  }
  function selectKind(next) {
    uploadGeneration.current++; setLoading(false); setError(''); setDragging(false); dragDepth.current = 0; setKind(next);
  }
  useLayoutEffect(() => {
    const observer = observeComposition(document);
    compositionObserver.current = observer;
    return () => { observer.dispose(); compositionObserver.current = null; };
  }, []);
  useEffect(() => {
    // Drops outside the designated Image area are ignored, never navigated to or uploaded.
    const ignoreOutsideDrop = event => { if (hasFiles(event) || Array.from(event.dataTransfer?.types ?? []).includes('text/uri-list')) { event.preventDefault(); if (event.type === 'dragover') event.dataTransfer.dropEffect = 'none'; } };
    document.addEventListener('dragover', ignoreOutsideDrop, true);
    document.addEventListener('drop', ignoreOutsideDrop, true);
    return () => {
      uploadGeneration.current++;
      document.removeEventListener('dragover', ignoreOutsideDrop, true);
      document.removeEventListener('drop', ignoreOutsideDrop, true);
      // Native Modal restores focus; only supply a fallback if its captured anchor disappeared.
      queueMicrotask(() => { if (document.activeElement === document.body && target.anchor?.isConnected) target.anchor.focus(); });
    };
  }, []);
  useEffect(() => { if (list.phase === 'ready' && !workspace) close(); }, [workspace, list.phase]);
  useEffect(() => { setEmojiLimit(PAGE_SIZE); }, [emojiQuery, emojiGroup]);
  const matchingIcons = useMemo(() => {
    const terms = normalizeSearch(iconQuery).split(' ').filter(Boolean);
    return ICONS.filter(icon => terms.every(term => normalizeSearch(`${icon.id} ${icon.en} ${icon.ru}`).includes(term)));
  }, [iconQuery]);
  const matchingEmoji = useMemo(() => searchEmoji(emojiQuery, emojiGroup), [emojiQuery, emojiGroup]);
  let valid = true;
  try { validateAppearance(appearance, ICON_IDS); } catch { valid = false; }
  const canSave = !loading && Boolean(alias.trim()) && valid;
  function run(fn) { try { fn(); close(); } catch (reason) { setError(reason.message); } }
  const save = () => { if (canSave) run(() => prefs.save(target.id, alias.trim(), appearance)); };
  async function upload(files) {
    if (!files?.length) return;
    const generation = ++uploadGeneration.current; setDragging(false); dragDepth.current = 0;
    if (files.length !== 1) { setLoading(false); setError(t('imageOneFile')); return; }
    setLoading(true); setError('');
    try {
      const data = await imageData(files[0]);
      if (generation === uploadGeneration.current) setAppearance({ kind: 'image', data });
    } catch (reason) { if (generation === uploadGeneration.current) setError(t(reason.message) ?? reason.message); }
    finally { if (generation === uploadGeneration.current) setLoading(false); }
  }
  return <Modal open title={t('changeAppearance')} closeLabel={t('close')} onClose={close}
    className="wsp-appearance-dialog" contentClassName="wsp-appearance-content"
    onKeyDownCapture={event => {
      if (compositionObserver.current?.guards(event.nativeEvent)) return;
      if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type === 'text') {
        event.preventDefault(); event.stopPropagation(); save();
      }
    }}
    footer={<>
      <Button className="wsp-reset-action" variant="ghost" onClick={() => run(() => prefs.resetWorkspace(target.id))}>{t('reset')}</Button>
      <Button variant="outline" onClick={close}>{t('cancel')}</Button>
      <Button variant="primary" disabled={!canSave} onClick={save}>{loading ? t('loading') : t('save')}</Button>
    </>}>
    <div className="wsp-appearance-body">
      <div className="wsp-kind-tabs" role="group" aria-label={t('kind')}>
        {['icon', 'emoji', 'image'].map(value => <Button key={value} size="sm" aria-pressed={kind === value} onClick={() => selectKind(value)}>{t(value)}</Button>)}
      </div>
      {kind === 'icon' && <>
        <div className="wsp-color-section">
          <span className="wsp-field-label">{t('color')}</span>
          <div className="wsp-appearance-palette" role="group" aria-label={t('color')}>
            {PALETTE.map(color => <Button key={color} className="wsp-color-swatch" title={color} aria-label={color}
              aria-pressed={color === appearance.color} style={{ '--wsp-art-color': color }} onClick={() => setAppearance({ ...appearance, color })} />)}
            <input className="wsp-custom-color" type="color" aria-label={t('customColor')} title={t('customColor')} value={appearance.color} onChange={event => setAppearance({ ...appearance, color: event.target.value })} />
          </div>
        </div>
        <input className="wsp-appearance-input" type="search" data-modal-autofocus aria-label={t('searchIcons')} placeholder={t('searchIcons')}
          value={iconQuery} onChange={event => setIconQuery(event.target.value)} />
        <div className="wsp-choice-grid" role="group" aria-label={t('icon')}>
          {matchingIcons.map(icon => <Button key={icon.id} className="wsp-choice" title={t('icon.' + icon.id)} aria-label={t('icon.' + icon.id)}
            aria-pressed={appearance.icon === icon.id} onClick={() => setAppearance({ ...appearance, icon: icon.id })}>
            <span className="wsp-icon" style={{ color: appearance.color }} dangerouslySetInnerHTML={{ __html: icon.svg }} />
          </Button>)}
        </div>
        {matchingIcons.length === 0 && <p className="wsp-help" role="status">{t('noResults')}</p>}
      </>}
      {kind === 'emoji' && <>
        <input className="wsp-appearance-input" type="search" data-modal-autofocus aria-label={t('searchEmoji')} placeholder={t('searchEmoji')}
          value={emojiQuery} onChange={event => setEmojiQuery(event.target.value)} />
        <select className="wsp-appearance-input" aria-label={t('emojiCategory')} value={emojiGroup} onChange={event => setEmojiGroup(event.target.value)}>
          <option value="all">{t('allEmoji')}</option>
          {EMOJI_GROUPS.map(group => <option key={group.id} value={group.id}>{russian ? group.ru : group.en}</option>)}
        </select>
        <div className="wsp-choice-grid wsp-emoji-grid" role="group" aria-label={t('emojiCatalog')}>
          {matchingEmoji.slice(0, emojiLimit).map(item => <Button key={item.emoji} className="wsp-choice wsp-emoji-choice" title={russian ? item.ru : item.en}
            aria-label={russian ? item.ru : item.en} aria-pressed={appearance.emoji === item.emoji} onClick={() => setAppearance({ kind: 'emoji', emoji: item.emoji })}>{item.emoji}</Button>)}
        </div>
        {matchingEmoji.length === 0 ? <p className="wsp-help" role="status">{t('noResults')}</p> : <div className="wsp-results-row">
          <span className="wsp-help">{Math.min(emojiLimit, matchingEmoji.length)} / {matchingEmoji.length}</span>
          {emojiLimit < matchingEmoji.length && <Button size="sm" onClick={() => setEmojiLimit(value => value + PAGE_SIZE)}>{t('showMore')}</Button>}
        </div>}
        <label className="wsp-field-label" htmlFor="wsp-emoji">{t('customEmoji')}</label>
        <input id="wsp-emoji" className="wsp-appearance-input" type="text" maxLength={32} value={appearance.emoji} onChange={event => setAppearance({ kind: 'emoji', emoji: event.target.value })} />
      </>}
      {kind === 'image' && <>
        <div className={'wsp-image-dropzone' + (dragging ? ' wsp-is-dragging' : '')} aria-label={t('imageDropArea')}
          onDragEnter={event => { if (hasFiles(event)) { event.preventDefault(); dragDepth.current++; setDragging(true); } }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = hasFiles(event) ? 'copy' : 'none'; }}
          onDragLeave={event => { if (hasFiles(event)) { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); } }}
          onDrop={event => { event.preventDefault(); event.stopPropagation(); setDragging(false); dragDepth.current = 0;
            if (event.dataTransfer.files.length) upload(event.dataTransfer.files); else { uploadGeneration.current++; setLoading(false); setError(t('imageDropFiles')); }
          }}>
          <span className="wsp-drop-title">{t('dropImage')}</span>
          <span className="wsp-help">{t('orChooseImage')}</span>
          <Button variant="outline" data-modal-autofocus onClick={() => uploadInput.current?.click()}>{t('upload')}</Button>
          <input ref={uploadInput} id="wsp-upload" className="wsp-hidden-file" tabIndex={-1} type="file" accept={IMAGE_ACCEPT} aria-label={t('upload')}
            onChange={event => { upload(event.target.files); event.target.value = ''; }} />
          <span className="wsp-help">{t('imageHint')}</span>
        </div>
      </>}
      <div className="wsp-preview-section">
        <span id="wsp-preview-label" className="wsp-field-label">{t('previewLabel')}</span>
        <div className="wsp-list-preview" role="group" aria-labelledby="wsp-preview-label"><Preview appearance={appearance} /><span>{workspace?.title}</span></div>
      </div>
      <details className="wsp-advanced">
        <summary>{t('advanced')}</summary>
        <label className="wsp-field-label" htmlFor="wsp-alias">{t('profileName')}</label>
        <input id="wsp-alias" className="wsp-appearance-input" type="text" maxLength={80} value={alias} onChange={event => setAlias(event.target.value)} />
        <p className="wsp-help">{t('profileHint')}</p>
        {Object.keys(settings.profiles).length > 0 && <>
          <label className="wsp-field-label" htmlFor="wsp-saved">{t('savedProfiles')}</label>
          <select id="wsp-saved" className="wsp-appearance-input" value="" onChange={event => {
            if (event.target.value) { uploadGeneration.current++; setLoading(false); setError(''); setAlias(event.target.value); setAppearance(settings.profiles[event.target.value]); }
          }}>
            <option value="">{t('chooseProfile')}</option>{Object.keys(settings.profiles).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </>}
      </details>
      {error && <div role="alert" className="wsp-error">{error}</div>}
    </div>
  </Modal>;
}
