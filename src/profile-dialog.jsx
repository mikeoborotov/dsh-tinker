import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Modal, Button, observeComposition } from '@deepseek-ai/dsh-client-ui-primitives';
import { IMAGE_ACCEPT, imageData } from './image-upload.js';
import { MAX_IMAGE_LENGTH } from './store.js';
import { useStore } from './use-store.js';

const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files') || Boolean(event.dataTransfer?.files?.length);
const UPLOAD_ERRORS = { imageType: 'profileImageType', imageFileSize: 'profileImageFileSize', imageDecode: 'profileImageDecode', imageSize: 'profileImageSize' };
const SAVE_ERRORS = new Set(['profileReadError', 'profileWriteError', 'profileInvalidData', 'profileUnsupportedVersion', 'profileNameInvalid', 'profileImageInvalid', 'profileEnabledInvalid']);
const saveError = reason => SAVE_ERRORS.has(reason?.code ?? reason?.message) ? (reason.code ?? reason.message) : 'profileSaveError';

function ProfileIcon({ camera = false }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    {camera ? <><path d="M3 7h5l1.5-3h5L16 7h5v13H3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.7" /></>
      : <><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" fill="currentColor" /></>}
  </svg>;
}
function Avatar({ image }) {
  const [failed, setFailed] = useState(null);
  return <span className="wsp-profile-avatar" aria-hidden="true">
    {image && failed !== image ? <img src={image} alt="" referrerPolicy="no-referrer" onError={() => setFailed(image)} /> : <ProfileIcon />}
  </span>;
}

export function ProfileDialog({ prefs, baseline = { name: null, image: null }, t, anchor, onClose }) {
  const state = useStore(prefs), initial = useRef(state).current;
  const [draftName, setDraftName] = useState(initial.name);
  // Keep input text separate from the nullable override, so clearing a prefilled native name stays blank.
  const [inputName, setInputName] = useState(initial.name ?? baseline.name ?? '');
  const [draftImage, setDraftImage] = useState(initial.image);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploadInput = useRef(null), portrait = useRef(null), generation = useRef(0), dragDepth = useRef(0);
  const active = useRef(true), dirty = useRef({ name: false, image: false }), savingNow = useRef(false), uploadingNow = useRef(false), composition = useRef(null);
  const errorId = useId(), language = t('language');
  const errorCode = error || state.error;
  const validName = draftName === null || draftName.trim().length <= 80;
  const canSave = !loading && !saving && !state.error && validName;
  const customDraft = Boolean(draftName?.trim() || draftImage);

  function cancelUpload() {
    generation.current++; uploadingNow.current = false; dragDepth.current = 0; setLoading(false); setDragging(false);
  }
  function close() {
    if (!active.current) return;
    active.current = false; generation.current++;
    onClose();
  }
  function restore() {
    if (savingNow.current) return;
    cancelUpload(); dirty.current = { name: true, image: true };
    setDraftName(null); setInputName(baseline.name ?? ''); setDraftImage(null); setError('');
  }
  function syncUntouched(next) {
    if (next.error) return;
    if (!dirty.current.name) { setDraftName(next.name); setInputName(next.name ?? baseline.name ?? ''); }
    if (!dirty.current.image) setDraftImage(next.image);
  }
  function retry() {
    if (loading || savingNow.current) return;
    setError('');
    try { syncUntouched(prefs.retry()); } catch (reason) { setError(saveError(reason)); }
  }
  function save() {
    if (!active.current || savingNow.current || uploadingNow.current || !canSave) return;
    savingNow.current = true; setSaving(true); setError('');
    try {
      // A storage event may not have arrived yet. Merge only explicitly edited fields over a fresh valid read.
      const latest = prefs.refresh();
      if (latest.error) throw new Error(latest.error);
      prefs.save({ name: dirty.current.name ? draftName : latest.name, image: dirty.current.image ? draftImage : latest.image });
      close();
    } catch (reason) {
      if (active.current) { setError(saveError(reason)); setSaving(false); savingNow.current = false; }
    }
  }
  async function upload(files) {
    if (!active.current || savingNow.current || !files?.length) return;
    const current = ++generation.current;
    dragDepth.current = 0; setDragging(false); setError('');
    if (files.length !== 1) { uploadingNow.current = false; setLoading(false); setError('profileImageOneFile'); return; }
    uploadingNow.current = true; setLoading(true);
    try {
      const image = await imageData(files[0]);
      if (!active.current || current !== generation.current) return;
      if (!image.startsWith('data:image/png;base64,') || image.length > MAX_IMAGE_LENGTH) { setError('profileImageInvalid'); return; }
      dirty.current.image = true; setDraftImage(image);
    } catch (reason) {
      if (active.current && current === generation.current) setError(UPLOAD_ERRORS[reason?.message] ?? 'profileImageDecode');
    } finally { if (active.current && current === generation.current) { uploadingNow.current = false; setLoading(false); } }
  }

  useLayoutEffect(() => {
    const observer = observeComposition(document); composition.current = observer;
    return () => { observer.dispose(); composition.current = null; };
  }, []);
  useEffect(() => {
    active.current = true;
    // Stop navigation/file uploads everywhere else while this modal is open. The avatar handles its own drop.
    const ignoreDrop = event => {
      if (hasFiles(event) || [...(event.dataTransfer?.types ?? [])].includes('text/uri-list')) {
        event.preventDefault();
        if (!portrait.current?.contains(event.target)) event.stopPropagation();
        if (event.type === 'dragover') event.dataTransfer.dropEffect = 'none';
      }
      if (event.type === 'drop') { dragDepth.current = 0; setDragging(false); }
    };
    document.addEventListener('dragover', ignoreDrop, true);
    document.addEventListener('drop', ignoreDrop, true);
    return () => {
      active.current = false; generation.current++;
      document.removeEventListener('dragover', ignoreDrop, true);
      document.removeEventListener('drop', ignoreDrop, true);
      // Native Modal owns focus restoration. Supply only its existing anchor fallback.
      queueMicrotask(() => { if (document.activeElement === document.body && anchor?.isConnected) anchor.focus(); });
    };
  }, []);
  useLayoutEffect(() => { cancelUpload(); }, [language]);
  useEffect(() => { syncUntouched(state); }, [state, baseline.name]);

  return <Modal open title={t('profileDialogTitle')} description={t('profileDescription')} closeLabel={t('close')} onClose={close}
    className="wsp-profile-dialog" contentClassName="wsp-profile-content"
    onKeyDownCapture={event => {
      if (composition.current?.guards(event.nativeEvent)) return;
      if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type === 'text') {
        event.preventDefault(); event.stopPropagation(); save();
      }
    }}
    footer={<>
      <Button variant="outline" onClick={close}>{t('cancel')}</Button>
      <Button variant="primary" disabled={!canSave} onClick={save}>{loading ? t('loading') : saving ? t('profileSaving') : t('save')}</Button>
    </>}>
    <div className="wsp-profile-body" aria-busy={loading || saving}>
      <Button ref={portrait} className={'wsp-profile-portrait' + (dragging ? ' wsp-profile-dragging' : '')} variant="ghost"
        aria-label={t('profileChooseImage')} title={t('profileChooseImage')} disabled={saving}
        onClick={() => uploadInput.current?.click()}
        onDragEnter={event => { if (hasFiles(event) && !savingNow.current) { event.preventDefault(); dragDepth.current++; setDragging(true); } }}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = hasFiles(event) && !savingNow.current ? 'copy' : 'none'; }}
        onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
        onDrop={event => {
          event.preventDefault(); event.stopPropagation(); setDragging(false); dragDepth.current = 0;
          if (event.dataTransfer.files.length) upload(event.dataTransfer.files);
          else { cancelUpload(); setError('profileImageDropFiles'); }
        }}>
        <Avatar image={draftImage ?? baseline.image} />
        <span className="wsp-profile-camera" aria-hidden="true"><ProfileIcon camera /></span>
      </Button>
      <input ref={uploadInput} className="wsp-profile-file" type="file" tabIndex={-1} accept={IMAGE_ACCEPT} aria-label={t('profileChooseImage')}
        onChange={event => { upload(event.target.files); event.target.value = ''; }} />
      <input className="wsp-profile-name" type="text" maxLength={80} autoComplete="off" data-modal-autofocus
        aria-label={t('profileName')} placeholder={t('profileName')} value={inputName} disabled={saving}
        aria-invalid={!validName || errorCode === 'profileNameInvalid'} aria-describedby={errorCode ? errorId : undefined}
        onChange={event => {
          const value = event.target.value;
          dirty.current.name = true; setInputName(value);
          setDraftName(value.trim() === (baseline.name ?? '').trim() ? null : value); setError('');
        }} />
      {customDraft && <Button className="wsp-profile-reset" variant="ghost" size="sm" disabled={saving} onClick={restore}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
        <span>{t('profileReset')}</span>
      </Button>}
      {errorCode && <div className="wsp-profile-error">
        <div id={errorId} role="alert">{t(errorCode)}</div>
        {state.error && <Button variant="outline" size="sm" disabled={loading || saving} onClick={retry}>{t('profileRetry')}</Button>}
      </div>}
    </div>
  </Modal>;
}
