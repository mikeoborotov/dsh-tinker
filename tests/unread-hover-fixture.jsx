import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { installIconSprite } from 't149-primitives';
import { SessionNodeItem, ArchiveSessionRowButton, PinSessionRowButton } from 't149-workspace';
import { createStore } from '../src/store.js';
import { createUnreadStore, UNREAD_CHANGE_EVENT, UNREAD_STORAGE_KEY } from '../src/unread.js';
import { registerSidebarFeatures, SESSION_ACTION_CSS } from '../src/session-actions.jsx';
import { useStore } from '../src/use-store.js';

// Real current native row/buttons/Tooltip and their CSS are pinned in native-hover-rc1/.
// Only stores, sessions and non-layout services are fake; no shell/model/account owner is started.
const prefs=createStore({features:{unread:true,branding:false}}),runtime=createStore({running:false}),slotsVersion=createStore(0);
const core=createUnreadStore(localStorage),counters={opens:0,marks:0,archives:0,pins:0,changes:0};
window.addEventListener(UNREAD_CHANGE_EVENT,()=>counters.changes++);
const reminders={...core,async markUnread(id){counters.marks++;await core.markUnread(id);}};
const fakeSession={id:'fake-current',running:false,retainedBy:{mainView:1},projectionValues:{modelSelection:{next:{provider:'fake',model:'fixed'}}}};
const entries=[],effects=[];
const t=key=>({markUnread:'Mark as unread',unreadLabel:'Unread reminder',unreadFailed:'Could not save reminder.','menu.archiveSession':'Archive','menu.pinSession':'Pin','actions.session.aria':'Session menu','status.running':'Running'}[key]??key);
const ctx={slots:{inject(_name,fn){const cleanup=fn();if(typeof cleanup==='function')effects.push(cleanup);},register(options,Component){const entry={options,Component};entries.push(entry);slotsVersion.set(n=>n+1);return()=>{const index=entries.indexOf(entry);if(index>=0)entries.splice(index,1);slotsVersion.set(n=>n+1);};}}};
function slot(name,extra={}){return <span data-slot={name} style={{display:'contents'}}>{entries.filter(entry=>entry.options.name===name).map(({options,Component})=><Component key={options.id} sessionId={fakeSession.id} t={t} {...extra}/>)}</span>;}
const emptySelector=selector=>selector(new Set());
const nativeProps={sessionId:fakeSession.id,useArchived:emptySelector,usePinned:emptySelector,useSessionAccess:()=>true,t,archiveSession(){counters.archives++;},unarchiveSession(){counters.archives++;},pinSession(){counters.pins++;},unpinSession(){counters.pins++;}};
function renderSlot(name){
  if(name==='sidebar.workspaces.session.row.action')return <>{slot(name)}<span data-slot="native-archive" style={{display:'contents'}}><ArchiveSessionRowButton {...nativeProps}/></span><span data-slot="native-pin" style={{display:'contents'}}><PinSessionRowButton {...nativeProps}/></span></>;
  return slot(name);
}
function Frame(){
  useSyncExternalStore(slotsVersion.subscribe,slotsVersion.getSnapshot);const state=useStore(runtime);
  const node={...fakeSession,title:'DSH Tinker',running:state.running,runningSubagentCount:0,completed:false,blank:false,archived:false,pinned:false,updatedAt:1730000000000};
  return <div className="wtg9ga_root" style={{height:'100%',width:'100%'}}>
    <SessionNodeItem node={node} currentId={fakeSession.id} now={1730000010000} onOpen={()=>counters.opens++} onRenameRequest={()=>{}} openSessionMenu={()=>{}} useContextMenuTarget={selector=>selector(null)} useContextMenu={()=>({getTriggerProps:()=>({})})} useSessionAccess={()=>true} t={t} renderSlot={renderSlot}/>
    <div role="menu" aria-label="Unread menu" style={{marginTop:24}}>{slot('sidebar.workspaces.session.menu.item',{useMenuOpenState:()=>[true,()=>{}]})}</div>
    {slot('shell.overlay')}
  </div>;
}
const style=document.createElement('style');style.textContent=SESSION_ACTION_CSS;document.head.appendChild(style);
// A deterministic active-theme focus color, independent of user theme preferences.
document.documentElement.style.setProperty('--dsw-focus-ring-color','#4176e6');
installIconSprite({effect(fn){fn();},on(){return()=>{};}},{});
let root;
function mount(){registerSidebarFeatures(ctx,{prefs,reminders,namespace:'unread-hover-test'});root=createRoot(document.getElementById('app'));root.render(<Frame/>);}
function dispose(){root.unmount();root=null;for(const cleanup of effects.reverse())cleanup();effects.length=0;entries.length=0;}
window.unreadHoverFixture={mount,dispose,restart(){dispose();mount();},toggle(enabled){prefs.set(state=>({...state,features:{...state.features,unread:enabled}}));},running(value){runtime.set({running:value});},snapshot:()=>({counters:{...counters},session:fakeSession,unread:core.getSnapshot().unread,stored:localStorage.getItem(UNREAD_STORAGE_KEY)})};
