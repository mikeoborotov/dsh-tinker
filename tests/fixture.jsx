import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, createPreferences } from '../src/store.js';
import { ICON_IDS, vendorOf } from '../src/icons.js';
import { apply } from '../src/client.jsx';
const selection = { provider:'deepseek-account',model:'deepseek-v4.1-flash' };
const sessions = createStore({byId:{s1:{projectionValues:{modelSelection:{next:selection}}}, s2:{} }});
const workspaceState = createStore({items:[{workspaceId:'w1',title:'Infra',sessionIds:['s1']}],phase:'ready'});
// Real DSH uses a class-backed snapshot; methods require their receiver.
const workspaces = new (class { constructor(){this.state=workspaceState;} getSnapshot(){return this.state.getSnapshot();} subscribe(fn){return this.state.subscribe(fn);} })();
const directory = createStore({current:selection,groups:[{id:'deepseek-account',name:'DeepSeek',models:[{id:selection.model,name:'Flash'}]},{id:'openai-codex',name:'ChatGPT',models:[{id:'sol',name:'Sol'}]}]});
const effects=[], roots=[];
const rendered = new Map();
let refreshes=0, language='legacy';
const localeTables={};
const translate=()=>key=>language==='legacy'?({appearance:'Appearance'}[key]??key):(localeTables.workspacePlus?.[language]?.[key]??key);
const ctx={
 locale:{register(name,tables){localeTables[name]=tables;return()=>{delete localeTables[name];};},bind:translate},
 effect(fn){const dispose=fn();if(typeof dispose==='function')effects.push(dispose);},
 on(){return ()=>{};},
 sessions:{list:sessions,refreshProjections:async id=>{refreshes++;sessions.set(s=>({...s,byId:{...s.byId,[id]:{projectionValues:{modelSelection:{next:{provider:'openai-codex',model:'sol'}}}}}}));}},
 workspaces:{list:workspaces}, modelDirectories:{directoryFor:()=>({store:directory})},
 slots:{inject(name,fn){fn();},register(options,Component){
    // Other host slots are exercised by dedicated fixtures, not this appearance shell.
    if (!['shell.overlay','conversation.input.right','settings.section'].includes(options.name) || options.id === 'workspace-plus-unread-error') return ()=>{};
   let place=options.name==='shell.overlay'?document.getElementById('overlay'):options.name==='conversation.input.right'?document.getElementById('marker'):document.getElementById('settings');
   const root=createRoot(place);roots.push(root);
   rendered.set(options.name,{root,Component,options});
   root.render(<Component {...options.inject?.('s1')} t={ctx.locale.bind()} />);return()=>root.unmount();
 }},
};
window.fixture={
 mount(){apply(ctx);},
 change(selection){ directory.set({...directory.getSnapshot(),current:selection});sessions.set(s=>({...s,byId:{...s.byId,s1:{projectionValues:{modelSelection:{next:selection}}}}}));},
 dispose(){for(const r of roots)r.unmount();for(const fn of effects.reverse())fn();},
 prefs:()=>createPreferences(localStorage,ICON_IDS), vendorOf,
 rerenderSettings(){const {root,Component}=rendered.get('settings.section');root.render(<Component t={ctx.locale.bind()} />);},
 refreshes:()=>refreshes,
 setLanguage(value){language=value;for(const {root,Component,options} of rendered.values())root.render(<Component {...options.inject?.('s1')} t={ctx.locale.bind()} lang={language} />);},
 setWorkspaces(items){workspaceState.set({items,phase:'ready'});},
};
