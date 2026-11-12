// Test-authored model of the DSH 0.2.2-rc.1 AccountMenu DOM/Menu keyboard contract.
// NOT the installed account client, Cordis lifecycle, auth flow, or installed acceptance.
// Contract sources (DeepSeek, MIT; native license is retained in native-rc2/LICENSE):
// https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-settings-account/src/client/AccountMenu.tsx
// https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/client/ui-primitives/src/Menu.tsx
// Installed AccountMenu client.js SHA256: 45fe700e38deef67063f677c446f2d59908278bee572a376d09ce9eb6bab7ec5.
// Only Modal/Button/shared primitives use the existing exact 0.2.0-rc.2 fixture.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { apply } from '../src/client.jsx';
import { createStore } from '../src/store.js';
import { createProfilePreferences, PROFILE_STORAGE_KEY } from '../src/profile-store.js';
import { useStore } from '../src/use-store.js';

const nativeCopy = {
  en: { menu:'Account menu', settings:'Settings', contact:'Feedback', signout:'Sign out', signin:'Sign in', more:'More', generic:'Signed in to DeepSeek' },
  ru: { menu:'Меню аккаунта', settings:'Настройки', contact:'Обратная связь', signout:'Выйти', signin:'Войти', more:'Ещё', generic:'Вошёл в DeepSeek' },
};
const state = createStore({ language:'en', wide:true, signedIn:true, name:'Native Alice', image:null, generic:false, known:true, mounted:true, duplicate:false, menuKind:'native', competing:false, remount:0, menuRemount:0, delayClose:0, busy:false, settingsOpen:false });
const slots = [], effects = [], handlers = new Map(), tables = {}, slotVersion = createStore(0);
const workspaces = createStore({phase:'ready',items:[]}), sessions = createStore({phase:'ready',ids:[],byId:{}});
let root, savedNodes, originalWrite, originalDecode, decodeJobs = [];
const counts = { settings:0, feedback:0, signout:0, signin:0 };
const translate = key => tables.workspacePlus?.[state.getSnapshot().language]?.[key] ?? key;
function emit(name) { for (const listener of handlers.get(name) ?? []) listener(); }
const ctx = {
  locale: {
    register(namespace, dictionaries) { tables[namespace] = dictionaries; return () => { delete tables[namespace]; }; },
    bind(namespace) { return namespace === 'workspace' ? () => 'Workspace' : translate; },
    getSnapshot: () => ({active:state.getSnapshot().language}),
    subscribe(listener) { return state.subscribe(listener); },
  },
  effect(fn) { const dispose = fn(); if (typeof dispose === 'function') effects.push(dispose); },
  on(name, listener) { if (!handlers.has(name)) handlers.set(name,new Set()); handlers.get(name).add(listener); return () => handlers.get(name).delete(listener); },
  sessions: {list:sessions,refreshProjections:async()=>{}}, workspaces:{list:workspaces}, modelDirectories:{directoryFor:()=>({store:createStore({current:null})})},
  slots: {
    inject(name, fn) { ctx.effect(fn); },
    register(options, Component) { const entry={options,Component};slots.push(entry);slotVersion.set(value=>value+1);return()=>{const index=slots.indexOf(entry);if(index>=0)slots.splice(index,1);slotVersion.set(value=>value+1);}; },
  },
};
function renderSlot(name, owner = {}) {
  const entries=slots.filter(entry=>entry.options.name===name).sort((a,b)=>(a.options.order??0)-(b.options.order??0));
  return <div data-slot={name} style={{display:'contents'}}>{entries.map(({options,Component})=><Component key={options.id??name} {...options.inject?.()} {...owner} t={translate} lang={state.getSnapshot().language} />)}</div>;
}
function Glyph({ ellipsis = false }) {
  return <svg width={ellipsis?14:16} height={ellipsis?14:16} viewBox="0 0 16 16" aria-hidden="true"><path d={ellipsis?'M3 8h1m3 0h1m3 0h1':'M4 14v-2a4 4 0 0 1 8 0v2M5 5a3 3 0 1 0 6 0 3 3 0 0 0-6 0'} fill="none" stroke="currentColor" /></svg>;
}
function AccountSurface() {
  const native=useStore(state),copy=nativeCopy[native.language],anchor=useRef(null),menu=useRef(null);
  const [open,setOpen]=useState(false);
  const close=()=>setOpen(false);
  useLayoutEffect(()=>{if(open)menu.current?.querySelector('button:not(:disabled)')?.focus();},[open]);
  useEffect(()=>{
    if(!open)return;
    const refocus=()=>anchor.current?.focus();
    const keydown=event=>{
      if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.ctrlKey||event.altKey||event.metaKey||anchor.current?.closest('[inert]'))return;
      const focused=document.activeElement,inside=menu.current?.contains(focused),anchored=focused===anchor.current||inside;
      if(event.key==='Escape'&&!event.shiftKey){event.preventDefault();close();if(anchored)refocus();return;}
      if(!anchored)return;
      if(event.key==='Tab'){
        if(event.shiftKey){event.preventDefault();close();refocus();}
        else if(inside&&focused?.getAttribute('role')==='menuitem'){event.preventDefault();focused.click();}
        else {event.preventDefault();menu.current?.querySelector('button:not(:disabled)')?.focus();}
        return;
      }
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const buttons=[...menu.current.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(focused);
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      event.preventDefault();buttons[next]?.focus();
    };
    const escape=event=>{if(event.key==='Escape')keydown(event);},other=event=>{if(event.key!=='Escape')keydown(event);};
    const outside=event=>{if(!menu.current?.contains(event.target)&&!anchor.current?.parentElement.contains(event.target))close();};
    document.addEventListener('keydown',escape,true);document.addEventListener('keydown',other);document.addEventListener('pointerdown',outside);
    return()=>{document.removeEventListener('keydown',escape,true);document.removeEventListener('keydown',other);document.removeEventListener('pointerdown',outside);};
  },[open]);
  const onSelect=id=>{
    if(id==='settings'){counts.settings++;state.set(value=>({...value,settingsOpen:true}));}
    else if(id==='contact')counts.feedback++;
    else if(id==='signin')counts.signin++;
    else counts.signout++; // Deliberately mirrors the native unknown-id hazard.
    close();anchor.current?.focus();
  };
  const items=[['settings',copy.settings],['contact',native.menuKind==='wrong'?'Unrelated action':copy.contact],[native.signedIn?'signout':'signin',native.signedIn?copy.signout:copy.signin]];
  const list=open&&<div key={native.menuRemount} ref={menu} role="menu" className="fixture-menu" onClick={event=>{event.stopPropagation();queueMicrotask(()=>{if(!document.querySelector('[role="menu"]')&&document.activeElement===document.body)anchor.current?.focus();});}}>
    <div role="presentation" className="fixture-menu-viewport">{items.map(([id,label])=><div key={id} className="fixture-menu-wrap"><button type="button" role="menuitem" className="fixture-menu-item" disabled={id==='signout'&&native.busy} onClick={()=>onSelect(id)}><span className="fixture-menu-icon"><Glyph /></span><span className="fixture-menu-label">{label}</span>{id==='settings'&&<span className="fixture-shortcut" aria-hidden="true">Ctrl+,</span>}</button></div>)}</div>
  </div>;
  return <div data-slot="settings.launcher" style={{display:'contents'}}><div className="_5Qcc8a_root" data-inset={native.signedIn&&native.wide}>
    <span className="_5Qcc8a_anchor"><button ref={anchor} type="button" className={native.known?'_5Qcc8a_trigger':'changed-core-trigger'} aria-label={copy.menu} aria-haspopup="menu" aria-expanded={open} data-signed-out={!native.signedIn} data-collapsed={!native.wide} onClick={()=>{if(open&&native.delayClose)setTimeout(close,native.delayClose);else setOpen(value=>!value);}}>
      {native.signedIn?<span className="_5Qcc8a_avatar" data-avatar-status={native.image?'ready':undefined}>{native.image?<img className="zSpNNG_image" src={native.image} alt="" referrerPolicy="no-referrer" />:<Glyph />}</span>:<Glyph ellipsis />}
      {native.wide&&<span className="_5Qcc8a_label">{native.signedIn?(native.generic?copy.generic:native.name):copy.more}</span>}
    </button></span>{createPortal(list,document.body)}
    {open&&native.competing&&createPortal(<div role="menu" className="fixture-other-menu"><button role="menuitem">Another popup</button></div>,document.body)}
  </div></div>;
}
function Frame() {
  const native=useStore(state);useStore(slotVersion);
  return <><div id="root"><aside className="fixture-sidebar" data-collapsed={!native.wide}><h3>DeepSeek Harness</h3><p>Account contract fixture</p><div data-slot="sidebar.settings" style={{display:'contents'}}>{native.mounted&&<AccountSurface key={native.remount} />}{native.duplicate&&<AccountSurface key="duplicate" />}</div></aside>
    <main className="fixture-main"><h2>Fixture conversation</h2><p>No account connection or installed Harness is used.</p><button onClick={()=>state.set(value=>({...value,wide:!value.wide}))}>Toggle sidebar</button>
      {native.settingsOpen&&<div id="settings">{renderSlot('settings.section',{close:()=>state.set(value=>({...value,settingsOpen:false}))})}</div>}
    </main></div>{renderSlot('shell.overlay')}</>;
}
function notifyStorage() { window.dispatchEvent(new StorageEvent('storage',{key:PROFILE_STORAGE_KEY,newValue:localStorage.getItem(PROFILE_STORAGE_KEY),storageArea:localStorage})); }
window.profileFixture={
  mount(options={}) { state.set(value=>({...value,...options}));apply(ctx);root=createRoot(document.getElementById('app'));root.render(<Frame />); },
  update(change) { state.set(value=>({...value,...change})); },
  language(language) { state.set(value=>({...value,language}));slotVersion.set(value=>value+1);emit('locale/change'); },
  counters:()=>({...counts}),
  preferences:()=>createProfilePreferences(localStorage).getSnapshot(),
  save(name,image=null) { createProfilePreferences(localStorage).save({name,image});notifyStorage(); },
  toggle(enabled) { createProfilePreferences(localStorage).toggle(enabled);notifyStorage(); },
  reconnect:()=>emit('connection/reset'),
  disposePlugin() { for(const dispose of effects.splice(0).reverse())dispose(); },
  restartPlugin() { window.profileFixture.disposePlugin();apply(ctx); },
  captureNodes() { const trigger=document.querySelector('._5Qcc8a_trigger');savedNodes={trigger,label:trigger?.querySelector('._5Qcc8a_label'),picture:trigger?.querySelector('._5Qcc8a_avatar>:not([data-wsp-owned])'),actions:[...document.querySelectorAll('[role="menuitem"]')].filter(node=>!node.hasAttribute('data-wsp-owned'))}; },
  sameNodes() { const trigger=document.querySelector('._5Qcc8a_trigger');return Boolean(savedNodes&&trigger===savedNodes.trigger&&trigger?.querySelector('._5Qcc8a_label')===savedNodes.label&&trigger?.querySelector('._5Qcc8a_avatar>:not([data-wsp-owned])')===savedNodes.picture&&savedNodes.actions.every(node=>node.isConnected)); },
  failWrites(enabled=true) { if(!originalWrite)originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=enabled?function(key,value){if(key===PROFILE_STORAGE_KEY)throw new DOMException('Quota exceeded','QuotaExceededError');return originalWrite.call(this,key,value);}:originalWrite; },
  holdDecode() { originalDecode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){const image=this;return new Promise((resolve,reject)=>decodeJobs.push(()=>originalDecode.call(image).then(resolve,reject)));}; },
  releaseDecode() { HTMLImageElement.prototype.decode=originalDecode;for(const resume of decodeJobs.splice(0))resume(); },
  pendingDecodes:()=>decodeJobs.length,
};
