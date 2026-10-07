import React, { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
import { SidebarRoot } from './native-rc2/packages/client/ui-sidebar/src/client/SidebarRoot.tsx';
import { createStore, createPreferences } from '../src/store.js';
import { UNREAD_STORAGE_KEY } from '../src/unread.js';
import { ICON_IDS } from '../src/icons.js';
import { apply } from '../src/client.jsx';
import { useStore } from '../src/use-store.js';
const selection = { provider: 'alibaba-token-plan', model: 'qwen3.8-max' };
const sessions = createStore({ phase: 'ready', ids: ['s1','s2'], byId: {
  s1: { id:'s1', displayTitle:'First', running:false, retainedBy:{mainView:1}, projectionValues:{modelSelection:{next:selection}} },
  s2: { id:'s2', displayTitle:'Second', running:false, retainedBy:{}, projectionValues:{modelSelection:{next:selection}} },
} });
const workspaceState = createStore({phase:'ready',items:[{workspaceId:'w1',title:'Infra',sessionIds:['s1','s2']}]});
const directory = createStore({current:selection, groups:[]});
const nativeStatus = createStore({s1:'idle',s2:'idle'}), slotChanges = createStore(0), entries = [];
let root, language = 'en', opens = 0, toggles = 0, starts = 0;
const effects = [], localeTables = {}, translate = key => localeTables.workspacePlus?.[language]?.[key] ?? key;
function openSession(id) {
  opens++;
  const snapshot = sessions.getSnapshot();
  const count = snapshot.byId[id].retainedBy.mainView ?? 0;
  sessions.set({ ...snapshot, byId:{...snapshot.byId,[id]:{...snapshot.byId[id],retainedBy:{mainView:count+1}}} });
  sessions.set({ ...snapshot, byId:Object.fromEntries(Object.entries(snapshot.byId).map(([key,row]) => [key,{...row,retainedBy:{mainView:key===id?1:0}}])) });
}
const ctx = {
  locale:{register(name,tables){localeTables[name]=tables;return()=>delete localeTables[name];},bind:()=>translate},
  effect(fn){const cleanup=fn();if(typeof cleanup==='function')effects.push(cleanup);},on(){return()=>{};},
  sessions:{list:sessions,refreshProjections:async()=>{}},workspaces:{list:workspaceState},modelDirectories:{directoryFor:()=>({store:directory})},
  slots:{inject(name,fn){ctx.effect(fn);},register(options,Component){
    const entry={options,Component}; entries.push(entry); slotChanges.set(n=>n+1);
    return()=>{const index=entries.indexOf(entry);if(index>=0)entries.splice(index,1);slotChanges.set(n=>n+1);};
  }},
};
function renderSlot(name, owner = {}, options = {}) {
  if (name==='sidebar.workspaces') return <div data-slot={name} style={{display:'contents'}}><Rows /></div>;
  if (name==='sidebar.settings') return <div data-slot={name} style={{display:'contents'}}>{renderSlot('settings.section')}</div>;
  const choices = entries.filter(entry=>entry.options.name===name).sort((a,b)=>(a.options.order??0)-(b.options.order??0));
  if (!choices.length) return <div data-slot={name} style={{display:'contents'}}>{options.fallback ?? null}</div>;
  const selected = name==='sidebar.brand.name' ? [choices.sort((a,b)=>(a.options.priority??0)-(b.options.priority??0))[0]] : choices;
  return <div data-slot={name} style={{display:'contents'}}>{selected.map(({options:entry,Component})=><Component key={entry.id??name} {...entry.inject?.('s1')} {...owner} t={translate} lang={language} />)}</div>;
}
function SessionRow({id}) {
  const [menuOpen,setMenuOpen] = useState(false);
  const status = useStore(nativeStatus)[id];
  const row = useStore(sessions).byId[id];
  return <div role="treeitem" data-row-key={'session:'+id} className="test-session-row" onClick={()=>openSession(id)}>
    <span className="test-status">{status==='idle'?renderSlot('sidebar.session.row.leading',{sessionId:id}):status==='archived'?null:<StateDot state={status} />}</span>
    <span>{row.displayTitle}</span><span className="test-time">1m</span>
    <span className="test-row-actions" onClick={event=>event.stopPropagation()}>
      <Menu open={menuOpen} anchor={<button type="button" aria-label={'Menu '+id} onClick={()=>setMenuOpen(value=>!value)}>...</button>} onClose={()=>setMenuOpen(false)} portal>
        {renderSlot('sidebar.workspaces.session.menu.item',{sessionId:id,displayTitle:row.displayTitle,useMenuOpenState:()=>[menuOpen,setMenuOpen]})}
      </Menu>
      {renderSlot('sidebar.workspaces.session.row.action',{sessionId:id,displayTitle:row.displayTitle})}
    </span>
  </div>;
}
function Rows() { return <div><SessionRow id="s1" /><SessionRow id="s2" /></div>; }
function Frame() {
  useSyncExternalStore(slotChanges.subscribe,slotChanges.getSnapshot);
  const [collapsed,setCollapsed] = useState(false);
  return <><SidebarRoot collapsed={collapsed} width={300} startSession={()=>starts++} toggleSidebar={()=>{toggles++;setCollapsed(value=>!value);}} selectPanel={()=>{}}
    usePanels={()=>[]} useShortcuts={()=>[]} usePanelInfo={()=>null}
    t={key=>({'session.new.label':'New Session','session.new':'New Session','toggle.open':'Expand sidebar','toggle.collapse':'Collapse sidebar','brand.localBuild':'DeepSeek Harness'}[key]??key)} renderSlot={renderSlot} />
    <div data-conversation-content="" data-conversation-session="s1"><div id="toolbar"><button aria-haspopup="menu" aria-busy="false"><svg/><span>Model</span></button><div id="marker">{renderSlot('conversation.input.right')}</div></div></div>
    {renderSlot('shell.overlay')}</>;
}
window.sidebarFixture = {
  mount(){ctx.slots.register({name:'sidebar.brand.name',priority:0},()=> <span data-native-official="">DeepSeek Harness</span>);apply(ctx);root=createRoot(document.getElementById('app'));root.render(<Frame />);},
  dispose(){root.unmount();for(const cleanup of effects.reverse())cleanup();},
  restartPlugin(){for(const cleanup of effects.reverse())cleanup();effects.length=0;apply(ctx);},
  open:openSession, opens:()=>opens, toggles:()=>toggles, starts:()=>starts,
  rows:()=>sessions.getSnapshot(), unread:()=>JSON.parse(localStorage.getItem(UNREAD_STORAGE_KEY)??'{"unread":{}}').unread,
  status(id,value){nativeStatus.set(state=>({...state,[id]:value}));},
  setLanguage(value){language=value;slotChanges.set(n=>n+1);},
  toggle(key,enabled){const prefs=createPreferences(localStorage,ICON_IDS);prefs.toggle(key,enabled);},
  failWrites(){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===UNREAD_STORAGE_KEY)throw new Error('QuotaExceededError');return original.call(this,key,value);};},
  corruptUnread(){localStorage.setItem(UNREAD_STORAGE_KEY,'{broken');},
};
