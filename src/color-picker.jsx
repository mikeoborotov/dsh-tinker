import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, MenuSurface, useAnchoredPosition, useDismissOnOutsidePointer, useModalLayer } from '@deepseek-ai/dsh-client-ui-primitives';
import { hexToHsv, hsvToHex, normalizeHex } from './colors.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function ColorPicker({ anchorRef, dialogRef, color, onChange, onApply, onCancel, onDismiss, t }) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [text, setText] = useState(color), [invalid, setInvalid] = useState(false);
  const drag = useRef(null), id = 'wsp-color-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const position = useAnchoredPosition({ open: true, anchorRef, panelRef: dialogRef, side: 'bottom', align: 'start', gap: 8, margin: 12 });
  // Register only the visible placement commit, not the hidden measuring surface.
  useModalLayer(dialogRef, position !== null, onCancel);
  useDismissOnOutsidePointer(anchorRef, true, next => { if (!next) onDismiss(); }, dialogRef);
  useEffect(() => () => {
    const current = drag.current;
    if (current?.element.hasPointerCapture(current.id)) current.element.releasePointerCapture(current.id);
    drag.current = null;
  }, []);

  function update(next) {
    const value = hsvToHex(next);
    if (!value) return;
    setHsv(next); setText(value); setInvalid(false); onChange(value);
  }
  function commit() {
    const value = normalizeHex(text);
    if (!value) { setInvalid(true); return; }
    setText(value); setInvalid(false); onChange(value); onApply();
  }
  function movePointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    update({ ...hsv, s: clamp((event.clientX - rect.left) / rect.width * 100, 0, 100), v: clamp((1 - (event.clientY - rect.top) / rect.height) * 100, 0, 100) });
  }
  function endDrag(event) {
    const current = drag.current;
    if (current?.id !== event.pointerId) return;
    drag.current = null;
    if (current.element.hasPointerCapture(current.id)) current.element.releasePointerCapture(current.id);
  }
  const saturationStart = hsvToHex({ ...hsv, s: 0 }), saturationEnd = hsvToHex({ ...hsv, s: 100 });
  const brightnessEnd = hsvToHex({ ...hsv, v: 100 });
  return createPortal(<MenuSurface ref={dialogRef} className="wsp-color-picker" role="dialog" aria-modal="true" aria-labelledby={id + '-title'} tabIndex={-1}
    style={{ position: 'fixed', ...position, visibility: position ? 'visible' : 'hidden' }}>
    <div className="wsp-color-picker-header">
      <h3 id={id + '-title'}>{t('customColor')}</h3>
      <Button className="wsp-color-close" size="sm" aria-label={t('close')} onClick={onCancel}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></Button>
    </div>
    <div className="wsp-color-picker-content">
      <div className="wsp-color-plane" role="slider" tabIndex={0} aria-label={t('colorArea')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s)}
        aria-valuetext={`${t('colorSaturation')}: ${Math.round(hsv.s)}%, ${t('colorBrightness')}: ${Math.round(hsv.v)}%`}
        style={{ '--wsp-hue': `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={event => {
          if (event.button !== 0 || drag.current) return;
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
          drag.current = { id: event.pointerId, element: event.currentTarget };
          event.currentTarget.setPointerCapture(event.pointerId); movePointer(event);
        }}
        onPointerMove={event => { if (drag.current?.id === event.pointerId) movePointer(event); }}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
          update({ ...hsv, s: clamp(hsv.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), 0, 100),
            v: clamp(hsv.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0), 0, 100) });
        }}>
        <span className="wsp-color-handle" style={{ left: hsv.s + '%', top: (100 - hsv.v) + '%' }} />
      </div>
      <div className="wsp-color-controls">
        {[
          { key: 'h', label: 'colorHue', max: 359, track: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' },
          { key: 's', label: 'colorSaturation', max: 100, track: `linear-gradient(to right,${saturationStart},${saturationEnd})` },
          { key: 'v', label: 'colorBrightness', max: 100, track: `linear-gradient(to right,#000,${brightnessEnd})` },
        ].map(channel => <label className="wsp-color-channel" key={channel.key}>
          <span>{t(channel.label)}<output>{Math.round(hsv[channel.key])}{channel.key === 'h' ? '°' : '%'}</output></span>
          <input type="range" className="wsp-color-range" aria-label={t(channel.label)} min={0} max={channel.max} step={1} value={Math.round(hsv[channel.key])}
            style={{ backgroundImage: channel.track }} onChange={event => update({ ...hsv, [channel.key]: Number(event.target.value) })} />
        </label>)}
        <div className="wsp-color-hex-field">
          <label htmlFor={id + '-hex'}>HEX</label>
          <div className="wsp-color-hex-row"><span className="wsp-color-current" aria-hidden="true" style={{ backgroundColor: color }} />
            <input id={id + '-hex'} className="wsp-color-hex" type="text" aria-label="HEX" data-modal-autofocus autoComplete="off" spellCheck={false}
              value={text} aria-invalid={invalid} aria-describedby={invalid ? id + '-error' : undefined}
              onChange={event => {
                const raw = event.target.value, value = normalizeHex(raw); setText(raw); setInvalid(false);
                if (value) { setHsv(hexToHsv(value)); onChange(value); }
              }}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); } }} />
          </div>
          {invalid && <p id={id + '-error'} className="wsp-color-error" role="status">{t('colorHexError')}</p>}
        </div>
      </div>
    </div>
    <div className="wsp-color-picker-footer"><Button variant="outline" onClick={onCancel}>{t('cancel')}</Button><Button variant="primary" onClick={commit}>{t('applyColor')}</Button></div>
  </MenuSurface>, document.body);
}
