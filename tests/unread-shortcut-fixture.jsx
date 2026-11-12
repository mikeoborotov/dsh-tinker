import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives';
import { Context } from './native-shortcuts-rc2/runtime/cordis.js';
import { ShortcutRegistry } from './native-shortcuts-rc2/packages/client/shortcuts/src/client/registry.ts';
import { installKeyboard } from './native-shortcuts-rc2/packages/client/shortcuts/src/client/dom.ts';
import { initialShortcutConfig } from './native-shortcuts-rc2/packages/client/shortcuts/src/protocol.ts';
import { createStore } from '../src/store.js';
import { createUnreadStore, observeSessionOpenings, UNREAD_CHANGE_EVENT, UNREAD_STORAGE_KEY } from '../src/unread.js';
import { registerSidebarFeatures, SESSION_ACTION_CSS } from '../src/session-actions.jsx';
import { useStore } from '../src/use-store.js';

const entries=createStore([]),prefs=createStore({features:{unread:true,branding:false},error:null});
const sessions=createStore({phase:'ready',byId:{main:{id:'main',blank:false,retainedBy:{mainView:1},model:'unchanged'},other:{id:'other',blank:false,retainedBy:{},running:true,model:'other-model'}}});
const panelInfo=createStore({activePanelId:null});
let registry,host,feature,providers,root,reminders,keyboardOff,openingOff,runtime,platform,fail=false,writes=0,events=0;
const translate=key=>({markUnread:'Mark as unread',unreadFailed:'Could not save the reminder.',unreadLabel:'Unread reminder'}[key]??key);
const originalSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){if(key===UNREAD_STORAGE_KEY){if(fail)throw new Error('fixture quota');writes++;}return originalSet.call(this,key,value);};
window.addEventListener(UNREAD_CHANGE_EVENT,()=>events++);
function slot(name,owner={}) {
  return entries.getSnapshot().filter(row=>row.options.name===name).map(({options,Component})=><Component key={options.id} {...owner} t={translate}/>);
}
function Frame() {
  useStore(entries);const state=useStore(reminders);const [open,setOpen]=useState(false);
  return <><textarea id="draft" aria-label="Composer" defaultValue="Keep this unsent draft"/><div><button id="other" onClick={()=>setOpen(true)}>Menu other</button>
    <Menu open={open} anchor={<span/>} portal onClose={()=>setOpen(false)}>{slot('sidebar.workspaces.session.menu.item',{sessionId:'other',useMenuOpenState:()=>[open,setOpen]})}</Menu>
    <div id="hover">{slot('sidebar.workspaces.session.row.action',{sessionId:'other'})}</div></div>
    <output id="saved">{JSON.stringify(state.unread)}</output>{slot('shell.overlay')}</>;
}
function mountFeature() {
  return host.plugin({inject:['sessions'],apply(ctx){
    const owner=ctx.extend({locale:{bind:()=>translate},slots:{
      inject(_name,fn){ctx.effect(fn);},
      register(options,Component){const entry={options,Component};entries.set(rows=>[...rows,entry]);return()=>entries.set(rows=>rows.filter(row=>row!==entry));},
    }});
    registerSidebarFeatures(owner,{prefs,reminders,namespace:'workspacePlus'});
  }});
}
async function provide() {return host.plugin(ctx=>{ctx.provide('shortcuts',registry);ctx.provide('layout',{panelInfo});});}
window.unreadShortcutFixture={
  async mount(options={}){
    runtime=options.runtime??'web';platform=options.platform??'windows';
    registry=new ShortcutRegistry(runtime,platform);host=new Context();reminders=createUnreadStore(localStorage);
    await host.plugin(ctx=>ctx.provide('sessions',{list:sessions}));
    providers=options.withoutSDK?undefined:await provide();feature=await mountFeature();
    openingOff=observeSessionOpenings({list:sessions},reminders);
    // The actual DOM adapter delivers to the actual registry. Desktop priority
    // policy is exercised here, not Electron's physical native input interception.
    keyboardOff=installKeyboard(window,registry);
    const style=document.createElement('style');style.textContent=SESSION_ACTION_CSS;document.head.append(style);
    root=createRoot(document.getElementById('app'));root.render(<Frame/>);
  },
  stats:()=>({writes,events,sessions:sessions.getSnapshot(),unread:reminders.getSnapshot().unread,commands:registry.definitions().length}),
  failWrites(value){fail=value;},
  guard(value){
    if(value==='off')prefs.set({...prefs.getSnapshot(),features:{unread:false,branding:false}});
    if(value==='on')prefs.set({...prefs.getSnapshot(),features:{unread:true,branding:false}});
    if(value==='none')sessions.set({byId:{}});
    if(value==='blank')sessions.set({byId:{main:{id:'main',blank:true,retainedBy:{mainView:1}}}});
    if(value==='panel')panelInfo.set({activePanelId:'settings'});
    if(value==='prefsError')prefs.set({...prefs.getSnapshot(),error:'invalid preferences'});
    if(value==='unreadError'){localStorage.setItem(UNREAD_STORAGE_KEY,'{invalid');reminders.refresh();}
    if(value==='modal'){const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');document.body.append(dialog);}
    if(value==='terminal')document.getElementById('draft').className='xterm';
  },
  binding(mode){
    let overrides={};
    if(mode==='override')overrides={'workspace-plus.session.mark-unread':{code:'KeyY',modifiers:['control','alt']}};
    if(mode==='unbind')overrides={'workspace-plus.session.mark-unread':null};
    if(mode==='conflict'){
      registry.register({id:'other.command',label:()=>'',aliases:[],defaults:{},regions:['page'],modals:[],resolve:()=>({status:'pass'})});
      overrides={'workspace-plus.session.mark-unread':{code:'KeyY',modifiers:['control','alt']},'other.command':{code:'KeyY',modifiers:['control','alt']}};
    }
    registry.configure({...initialShortcutConfig(),status:'ready',document:{schemaVersion:2,profiles:{[`${runtime}:${platform}`]:overrides}}});
  },
  async remount(){await feature.dispose();feature=await mountFeature();},
  async withdraw(){await providers?.dispose();},async reprovide(){providers=await provide();},
  async dispose(){root.unmount();keyboardOff();openingOff();await feature.dispose();await providers?.dispose();await host.fiber.dispose();},
};
