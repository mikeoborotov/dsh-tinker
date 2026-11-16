import React, { useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as lowerNative from './native-primitives.js';
import { CSS } from '../src/styles.js';

// Deliberate contract facade, NOT an rc.3 native implementation. The CJS require
// boundary models the host's missing export without an ESM linking failure.
const primitives = Object.fromEntries(Object.entries(lowerNative).filter(([key]) => key !== 'useAnchoredPosition'));
const errors = [], events = [];
if (window.legacyPositioning) primitives.useAnchoredPosition = options => {
  events.push('legacy-position');
  return lowerNative.useAnchoredPosition(options);
};
const module = { exports: {} };
new Function('require', 'module', 'exports', window.colorPickerSource)(name => {
  if (name === 'react') return React;
  if (name === 'react-dom') return ReactDOM;
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
  throw new Error('Unexpected ColorPicker dependency: ' + name);
}, module, module.exports);
const { ColorPicker } = module.exports;
const labels = { customColor: 'Custom color', close: 'Close', cancel: 'Cancel', applyColor: 'Apply', colorArea: 'Color area', colorHue: 'Hue', colorSaturation: 'Saturation', colorBrightness: 'Brightness' };
class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { errors.push(error.message); }
  render() { return this.state.failed ? <p>ColorPicker failed</p> : this.props.children; }
}
function App() {
  const anchorRef = useRef(null), dialogRef = useRef(null);
  const [open, setOpen] = useState(false), [color, setColor] = useState('#336699');
  const close = action => { events.push(action); setOpen(false); };
  return <lowerNative.Modal open title="Parent dialog" onClose={() => events.push('parent-close')}>
    <div id="position-scroller" style={{ height: 180, overflow: 'auto' }}><div style={{ height: 600, paddingTop: 100 }}>
      <button id="color-anchor" ref={anchorRef} style={{ anchorName: '--preexisting-color-anchor' }} onClick={() => setOpen(true)}>Custom color</button>
    </div></div>
    <output id="draft-color">{color}</output>
    {open && <Boundary><ColorPicker anchorRef={anchorRef} dialogRef={dialogRef} color={color} onChange={setColor}
      onApply={() => close('apply')} onCancel={() => close('cancel')} onDismiss={() => close('dismiss')} t={key => labels[key] ?? key} /></Boundary>}
  </lowerNative.Modal>;
}
const sheet = document.createElement('style'); sheet.textContent = CSS; document.head.append(sheet);
const root = createRoot(document.getElementById('root'));
window.fixture = { errors, events, hasLegacyHook: 'useAnchoredPosition' in primitives, mount: () => root.render(<App />), dispose: () => root.unmount() };
