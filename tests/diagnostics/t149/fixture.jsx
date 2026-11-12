import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSidebarFeatures, SESSION_ACTION_CSS } from '../../../src/session-actions.jsx';
import { SessionNodeItem, ArchiveSessionRowButton, PinSessionRowButton, Rows_module_css_default as css } from 't149-workspace';
import { installIconSprite } from 't149-primitives';

const counters={opens:0,marks:0,archives:0,pins:0,model:0,account:0};
const settings={features:{unread:true,branding:false}};
const remindersSnapshot={unread:{},error:null,lastError:null,errorSequence:0};
const prefs={getSnapshot:()=>settings,subscribe:()=>()=>{}};
const reminders={getSnapshot:()=>remindersSnapshot,subscribe:()=>()=>{},markUnread:async()=>{counters.marks++;},reportError(){}};
const entries=new Map();
registerSidebarFeatures({slots:{inject(_name,fn){fn();},register(options,Component){entries.set(options.name,{options,Component});return()=>{};}}},{prefs,reminders,namespace:'t149'});
const Unread=entries.get('sidebar.workspaces.session.row.action').Component;
const style=document.createElement('style');style.textContent=SESSION_ACTION_CSS;document.head.appendChild(style);
installIconSprite({effect(fn){fn();},on(){return()=>{};}},{});
const t=(key)=>({'markUnread':'Mark as unread','menu.archiveSession':'Archive','menu.pinSession':'Pin','actions.session.aria':'Session menu','status.running':'Running'}[key]??key);
const useEmpty=selector=>selector(new Set());
const actionProps={sessionId:'fake-session',useArchived:useEmpty,usePinned:useEmpty,useSessionAccess:()=>true,t,archiveSession(){counters.archives++;},unarchiveSession(){counters.archives++;},pinSession(){counters.pins++;},unpinSession(){counters.pins++;}};
function Slot({kind,children}){return <span data-slot={kind} style={{display:'contents'}}>{children}</span>;}
let root;
function render(options={}) {
  const {running=true,title=true,ellipsis=true,onlyActions=false,removePin=false}=options;
  const actions=<>
    <Slot kind="unread"><Unread sessionId="fake-session" t={t}/></Slot>
    <Slot kind="archive"><ArchiveSessionRowButton {...actionProps}/></Slot>
    {!removePin&&<Slot kind="pin"><PinSessionRowButton {...actionProps}/></Slot>}
  </>;
  const rowProps={node:{id:'fake-session',title:title?'DSH Tinker':'',running,runningSubagentCount:0,completed:false,blank:false,archived:false,pinned:false,updatedAt:1730000000000},currentId:null,now:1730000010000,onOpen(){counters.opens++;},onRenameRequest(){},openSessionMenu(){},useContextMenuTarget:selector=>selector(null),useContextMenu:()=>({getTriggerProps:()=>({})}),useSessionAccess:()=>true,t,
    renderSlot(name){return name==='sidebar.workspaces.session.row.action'?actions:null;}};
  root??=createRoot(document.getElementById('app'));
  root.render(<div className="wtg9ga_root" style={{height:'100%',width:'100%'}}>
    {onlyActions?<span className={css.rowActions} data-minimal-actions="" style={{display:'inline-flex'}}>{actions}</span>:<SessionNodeItem {...rowProps}/>}
    {!ellipsis&&<style>{`.${css.rowActions}>button[data-context-menu-trigger]{display:none}`}</style>}
  </div>);
}
window.t149={render,counters:()=>({...counters})};
render();
