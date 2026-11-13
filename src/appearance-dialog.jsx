import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Menu, IconChevronDownOutlineRegular, IconFolderCloseRegular, observeComposition } from '@deepseek-ai/dsh-client-ui-primitives';
import { ICONS, ICON_IDS, PALETTE, fillAppearance } from './icons.js';
import { validateAppearance } from './store.js';
import { useStore } from './use-store.js';
import { EMOJI_GROUPS, normalizeSearch, searchEmoji } from './emoji-catalog.js';
import { IMAGE_ACCEPT, imageData } from './image-upload.js';

const DEFAULT_ICON = { kind: 'icon', icon: 'folder', color: PALETTE[0] };
const PAGE_SIZE = 120;
const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files');

function Artwork({ appearance }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) fillAppearance(ref.current, appearance); }, [appearance]);
  return <span ref={ref} className="wsp-icon" aria-hidden="true" />;
}
function Preview({ appearance }) {
  return appearance ? <Artwork appearance={appearance} />
    : <span className="wsp-icon wsp-native-folder" aria-hidden="true"><IconFolderCloseRegular size={16} /></span>;
}

function KindGlyph({ kind }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'icon' ? <><path d="m7 3 4 7H3Z" /><rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17" cy="17" r="4" /></>
      : kind === 'emoji' ? <><circle cx="12" cy="12" r="9" /><path d="M8 14a4.5 4.5 0 0 0 8 0" /><circle cx="9" cy="9" r=".5" /><circle cx="15" cy="9" r=".5" /></>
        : <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>}
  </svg>;
}

export function AppearanceDialog({ target, prefs, ui, workspaces, t, lang }) {
  const list = useStore(workspaces.list);
  const workspace = list.items.find(item => item.workspaceId === target.id);
  const saved = useRef(prefs.appearance(target.id)).current;
  const initial = saved ?? DEFAULT_ICON;
  const [restoring, setRestoring] = useState(!saved);
  const [kind, setKind] = useState(initial.kind);
  const [drafts, setDrafts] = useState(() => ({
    icon: DEFAULT_ICON, emoji: { kind: 'emoji', emoji: '💻' }, image: { kind: 'image', data: '' }, [initial.kind]: initial,
  }));
  const appearance = drafts[kind];
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [iconQuery, setIconQuery] = useState(''), [emojiQuery, setEmojiQuery] = useState('');
  const [emojiGroup, setEmojiGroup] = useState('all'), [emojiLimit, setEmojiLimit] = useState(PAGE_SIZE);
  const [categoryOpen, setCategoryOpen] = useState(false), categoryTrigger = useRef(null);
  const [categoryAutoFocus, setCategoryAutoFocus] = useState(false);
  const categoryGeneration = useRef(0), categoryState = useRef(null);
  const [dragging, setDragging] = useState(false);
  const uploadGeneration = useRef(0), dragDepth = useRef(0), uploadInput = useRef(null), compositionObserver = useRef(null);
  const language = String(lang ?? t('language')), russian = language.startsWith('ru'), targetAvailable = Boolean(workspace);
  categoryState.current = { open: categoryOpen, kind, language, targetId: target.id, available: targetAvailable };
  const categoryItems = [{ id: 'all', label: t('allEmoji') }, ...EMOJI_GROUPS.map(group => ({ id: group.id, label: russian ? group.ru : group.en }))];
  function openCategory() {
    categoryGeneration.current++; setCategoryAutoFocus(false); setCategoryOpen(true);
  }
  function closeCategory(restoreFocus = false) {
    categoryGeneration.current++;
    categoryState.current = { ...categoryState.current, open: false };
    setCategoryAutoFocus(false); setCategoryOpen(false);
    if (restoreFocus) categoryTrigger.current?.focus({ preventScroll: true });
  }
  const close = () => { closeCategory(); uploadGeneration.current++; ui.set({ target: null }); };
  function setAppearance(next) {
    setRestoring(false); setKind(next.kind); setDrafts(previous => ({ ...previous, [next.kind]: next }));
  }
  function selectKind(next) {
    closeCategory();
    if (next === kind) return;
    uploadGeneration.current++; setLoading(false); setError(''); setDragging(false); dragDepth.current = 0; setRestoring(false); setKind(next);
  }
  function restoreDefault() {
    closeCategory();
    uploadGeneration.current++; setLoading(false); setError(''); setDragging(false); dragDepth.current = 0;
    setRestoring(true);
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
  useEffect(() => {
    // Locale changes withdraw the old popup; only return its own keyboard focus.
    closeCategory(categoryOpen && Boolean(document.activeElement?.closest('.wsp-emoji-category-menu')));
  }, [language]);
  useEffect(() => {
    if (!categoryOpen || kind !== 'emoji' || !targetAvailable || !categoryState.current.open) return;
    const generation = categoryGeneration.current, trigger = categoryTrigger.current, targetId = target.id;
    let active = true;
    // Legacy portals focus their hidden measurement list. With this connected
    // default anchor, arm public autoFocus after placement; current SDK already
    // guards readiness. Native Menu alone focuses rows, unless focus moved on.
    const frame = requestAnimationFrame(function enableCategoryAutoFocus() {
      const current = categoryState.current;
      if (active && generation === categoryGeneration.current && current.open && current.kind === 'emoji'
        && current.language === language && current.targetId === targetId && current.available
        && trigger?.isConnected && categoryTrigger.current === trigger && document.activeElement === trigger) setCategoryAutoFocus(true);
    });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [categoryOpen, kind, language, target.id, targetAvailable]);
  const matchingIcons = useMemo(() => {
    const terms = normalizeSearch(iconQuery).split(' ').filter(Boolean);
    return ICONS.filter(icon => terms.every(term => normalizeSearch(`${icon.id} ${icon.en} ${icon.ru}`).includes(term)));
  }, [iconQuery]);
  const matchingEmoji = useMemo(() => searchEmoji(emojiQuery, emojiGroup), [emojiQuery, emojiGroup]);
  let valid = true;
  if (!restoring) try { validateAppearance(appearance, ICON_IDS); } catch { valid = false; }
  const canSave = !loading && valid;
  function run(fn) { try { fn(); close(); } catch (reason) { setError(reason.message); } }
  const save = () => { if (canSave) run(() => restoring ? prefs.resetWorkspace(target.id) : prefs.save(target.id, appearance)); };
  async function upload(files) {
    if (!files?.length) return;
    const generation = ++uploadGeneration.current; setRestoring(false); setDragging(false); dragDepth.current = 0;
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
      const composing = compositionObserver.current?.guards(event.nativeEvent);
      if (composing) {
        // Ignoring a composing key alone still lets Enter click a native button.
        if (event.key === 'Enter' && event.target.tagName === 'BUTTON') event.preventDefault();
        return;
      }
      // The composition guard is consumptive: this owner must consult it once.
      if (!categoryOpen && event.key === 'ArrowDown' && event.target === categoryTrigger.current) {
        event.preventDefault(); event.stopPropagation(); openCategory(); return;
      }
      if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type === 'text') {
        event.preventDefault(); event.stopPropagation(); save();
      }
    }}
    footer={<>
      <Button className="wsp-reset-action" variant="ghost" onClick={restoreDefault}>{t('reset')}</Button>
      <Button variant="outline" onClick={close}>{t('cancel')}</Button>
      <Button variant="primary" disabled={!canSave} onClick={save}>{loading ? t('loading') : t('save')}</Button>
    </>}>
    <div className="wsp-appearance-body">
      <div className="wsp-appearance-context">
        <div className="wsp-preview-section">
          <span id="wsp-preview-label" className="wsp-field-label">{t('previewLabel')}</span>
          <div className="wsp-list-preview" role="group" aria-labelledby="wsp-preview-label"><Preview appearance={restoring ? null : appearance} /><span title={workspace?.title}>{workspace?.title}</span></div>
        </div>
        <hr className="wsp-preview-divider" />
        <div className="wsp-kind-section">
          <span id="wsp-kind-label" className="wsp-field-label">{t('selectIconType')}</span>
          <div className="wsp-kind-tabs" role="group" aria-labelledby="wsp-kind-label">
            {['icon', 'emoji', 'image'].map(value => <Button key={value} className="wsp-kind-choice" size="sm" aria-pressed={kind === value} onClick={() => selectKind(value)}><KindGlyph kind={value} /><span>{t(value)}</span></Button>)}
          </div>
        </div>
      </div>
      <div className="wsp-appearance-editor" onScrollCapture={event => {
        // A portaled menu scroll is not an editor scroll; its native viewport stays usable.
        if (categoryOpen && event.currentTarget.contains(event.target)) closeCategory(Boolean(document.activeElement?.closest('.wsp-emoji-category-menu')));
      }}>
        {kind === 'icon' && <div className="wsp-mode-panel">
          <div className="wsp-color-section">
            <span className="wsp-field-label">{t('selectIconColor')}</span>
            <div className="wsp-appearance-palette" role="group" aria-label={t('selectIconColor')}>
              {PALETTE.map(color => <Button key={color} className="wsp-color-swatch" title={color} aria-label={color}
                aria-pressed={color === appearance.color} style={{ '--wsp-art-color': color }} onClick={() => setAppearance({ ...appearance, color })} />)}
              <input className="wsp-custom-color" type="color" aria-label={t('customColor')} title={t('customColor')} value={appearance.color} onChange={event => setAppearance({ ...appearance, color: event.target.value })} />
            </div>
          </div>
          <label className="wsp-field-label" htmlFor="wsp-icon-search">{t('selectIcon')}</label>
          <input id="wsp-icon-search" className="wsp-appearance-input" type="search" data-modal-autofocus aria-label={t('searchIcons')} placeholder={t('searchIcons')}
            value={iconQuery} onChange={event => setIconQuery(event.target.value)} />
          <div className="wsp-choice-grid" role="group" aria-label={t('icon')}>
            {matchingIcons.map(icon => <Button key={icon.id} className="wsp-choice" title={t('icon.' + icon.id)} aria-label={t('icon.' + icon.id)}
              aria-pressed={appearance.icon === icon.id} onClick={() => setAppearance({ ...appearance, icon: icon.id })}>
              <span className="wsp-icon" style={{ color: appearance.color }} dangerouslySetInnerHTML={{ __html: icon.svg }} />
            </Button>)}
          </div>
          {matchingIcons.length === 0 && <p className="wsp-help" role="status">{t('noResults')}</p>}
        </div>}
        {kind === 'emoji' && <div className="wsp-mode-panel">
          <label className="wsp-field-label" htmlFor="wsp-emoji-search">{t('selectEmoji')}</label>
          <div className="wsp-search-category">
            <input id="wsp-emoji-search" className="wsp-appearance-input" type="search" data-modal-autofocus aria-label={t('searchEmoji')} placeholder={t('searchEmoji')}
              value={emojiQuery} onChange={event => setEmojiQuery(event.target.value)} />
            <Menu open={categoryOpen} portal align="start" side="bottom" autoFocus={categoryAutoFocus} selection="check"
              className="wsp-category-anchor" listClassName="wsp-emoji-category-menu" items={categoryItems} selectedId={emojiGroup}
              onSelect={id => { setEmojiGroup(id); closeCategory(); }} onClose={() => closeCategory()}
              anchor={<Button ref={categoryTrigger} className="wsp-category-trigger" variant="outline" aria-label={t('emojiCategory')} aria-describedby="wsp-category-value"
                aria-haspopup="menu" aria-expanded={categoryOpen} onClick={() => categoryOpen ? closeCategory() : openCategory()}>
                <span id="wsp-category-value" className="wsp-category-value">{categoryItems.find(item => item.id === emojiGroup)?.label}</span><IconChevronDownOutlineRegular size={16} />
              </Button>} />
          </div>
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
        </div>}
        {kind === 'image' && <div className="wsp-mode-panel">
          <span className="wsp-field-label">{t('uploadImage')}</span>
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
        </div>}
        {error && <div role="alert" className="wsp-error">{error}</div>}
      </div>
    </div>
  </Modal>;
}
