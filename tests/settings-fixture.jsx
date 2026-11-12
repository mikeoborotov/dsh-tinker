import './fixture.jsx';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives';
const originalSet = Storage.prototype.setItem;
function Reference() {
  const [checked, setChecked] = useState(true);
  return <Switch checked={checked} onChange={setChecked} label="Native reference" />;
}
window.settingsFixture = {
  mount(language = 'en') {
    window.fixture.mount(); window.fixture.setLanguage(language);
    createRoot(document.getElementById('reference')).render(<Reference />);
  },
  failWrites(key) { Storage.prototype.setItem = function(name,value) { if(name===key)throw new Error('fixture quota');return originalSet.call(this,name,value); }; },
  restoreWrites() { Storage.prototype.setItem = originalSet; },
};
