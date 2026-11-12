import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createUnreadStore, UNREAD_STORAGE_KEY } from '../src/unread.js';
import { createUnreadShortcut, registerUnreadShortcuts, UNREAD_COMMAND_ID, UNREAD_DEFAULT_PROFILES } from '../src/unread-shortcuts.js';
import { nativeSDK, nativeCordis } from './unread-shortcut-native.mjs';
const { ShortcutRegistry, initialShortcutConfig, parseShortcutDefinitions } = await nativeSDK();
const input = { code:'KeyU', control:true, alt:true, shift:false, meta:false, repeat:false, composing:false, defaultPrevented:false };
const context = { region:'editable', modal:null, target:null };
function fixture(runtime='desktop', platform='windows') {
  const prefs=createStore({features:{unread:true},error:null}), reminderState=createStore({unread:{},error:null,lastError:null});
  const sessions=createStore({phase:'ready',byId:{main:{id:'main',blank:false,retainedBy:{mainView:1}},menu:{id:'menu',blank:false,retainedBy:{}},running:{id:'running',blank:false,running:true,retainedBy:{}}}});
  const panelInfo=createStore({activePanelId:null}), calls=[], errors=[];
  const reminders={...reminderState,markUnread:async id=>{calls.push(id);},reportError:error=>errors.push(error.message)};
  const registry=new ShortcutRegistry(runtime,platform), config=registry.config;
  const effects=[];let childEffects=[],waiting;
  const services={shortcuts:registry,layout:{panelInfo}};
  const ctx={...services,sessions:{list:sessions},effect(fn){const off=fn();if(off)effects.push(off);},inject(deps,callback){waiting=()=>{
    for(const off of childEffects.splice(0).reverse())off();
    if(deps.every(name=>services[name]))callback({...ctx,...services,effect(fn){const off=fn();if(off)childEffects.push(off);}});
  };waiting();}};
  const options={prefs,reminders,t:key=>key};
  return {ctx,options,prefs,reminders,sessions,panelInfo,calls,errors,registry,config,
    install:()=>registerUnreadShortcuts(ctx,options),
    dispose(){for(const off of childEffects.splice(0).reverse())off();for(const off of effects.splice(0).reverse())off();},
    service(name,value){services[name]=value;waiting();},
    dispatch(gesture={},owner={}){return registry.dispatch({...input,...gesture},{...context,...owner},()=>{});},
    configure(overrides={},status='ready'){registry.configure({...initialShortcutConfig(),status,document:{schemaVersion:2,profiles:{[`${runtime}:${platform}`]:overrides}}});},
  };
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('actual client Cordis child injection waits, withdraws, reprovides and disposes with its parent',async()=>{
  const { Context }=await nativeCordis(),root=new Context(),f=fixture();
  const sessions=await root.plugin(ctx=>ctx.provide('sessions',f.ctx.sessions));
  let hint;
  const owner=await root.plugin({inject:['sessions'],apply(ctx){hint=registerUnreadShortcuts(ctx,f.options);}});
  assert.equal(f.registry.definitions().length,0);assert.equal(hint.getSnapshot(),undefined);
  const provide=()=>root.plugin(ctx=>{ctx.provide('shortcuts',f.registry);ctx.provide('layout',f.ctx.layout);});
  let services=await provide();await settle();assert.equal(f.registry.definitions().length,1);assert.equal(hint.getSnapshot().aria,'Control+Alt+U');
  await services.dispose();await settle();assert.equal(f.registry.definitions().length,0);assert.equal(hint.getSnapshot(),undefined);
  services=await provide();await settle();assert.equal(f.registry.definitions().length,1);
  await owner.dispose();await settle();assert.equal(f.registry.definitions().length,0);assert.equal(hint.getSnapshot(),undefined);
  await services.dispose();await sessions.dispose();await root.fiber.dispose();
});

test('stable command and defaults pass the real lower-bound SDK definition validator',()=>{
  const f=fixture(),command=createUnreadShortcut(f.ctx,f.options);
  assert.equal(command.id,'workspace-plus.session.mark-unread');assert.equal(UNREAD_COMMAND_ID,command.id);
  assert.deepEqual(Object.keys(command.defaults).sort(),['desktop:linux','desktop:windows','web:windows']);
  assert.deepEqual(Object.keys(UNREAD_DEFAULT_PROFILES).sort(),['desktop:linux','desktop:macos','desktop:windows','web:linux','web:macos','web:windows']);
  for(const profile of ['desktop:macos','web:linux','web:macos'])assert.equal(UNREAD_DEFAULT_PROFILES[profile],null);
  for(const binding of Object.values(command.defaults))assert.deepEqual(binding,{code:'KeyU',modifiers:['control','alt']});
  assert.equal(parseShortcutDefinitions([{id:command.id,defaults:command.defaults}]).length,1);
  assert.throws(()=>parseShortcutDefinitions([{id:command.id,defaults:{'web:linux':{code:'KeyU',modifiers:['control','alt']}}}]),/reserved/);
});
for(const runtime of ['desktop','web'])for(const platform of ['windows','linux','macos'])test(`actual registry default ${runtime}:${platform}`,async()=>{
  const f=fixture(runtime,platform),hint=f.install();const result=f.dispatch();await settle();
  const bound=platform==='windows'||platform==='linux'&&runtime==='desktop';
  assert.equal(result.status,bound?'handled':'pass');assert.deepEqual(f.calls,bound?['main']:[]);
  assert.equal(Boolean(hint.getSnapshot()),bound);f.dispose();assert.equal(f.registry.definitions().length,0);
});
test('resolve captures main ID before asynchronous action, not the menu/running row',async()=>{
  const f=fixture(),command=createUnreadShortcut(f.ctx,f.options),result=command.resolve(context);
  f.sessions.set({byId:{menu:{id:'menu',blank:false,retainedBy:{mainView:1}}}});result.run();await settle();assert.deepEqual(f.calls,['main']);
});
for(const guard of ['off','prefsError','unreadError','none','blank','modal','panel','terminal','unready'])test(`explicit resolve guard ${guard} on priority Desktop`,async()=>{
  const f=fixture();f.install();let owner={};
  if(guard==='off')f.prefs.set({features:{unread:false}});
  if(guard==='prefsError')f.prefs.set({features:{unread:true},error:'unreadable preferences'});
  if(guard==='unreadError')f.reminders.set({unread:{},error:'invalid unread map'});
  if(guard==='none')f.sessions.set({byId:{}});
  if(guard==='blank')f.sessions.set({byId:{main:{id:'main',blank:true,retainedBy:{mainView:1}}}});
  if(guard==='modal')owner.modal='other';
  if(guard==='panel')f.panelInfo.set({activePanelId:'settings'});
  if(guard==='terminal')owner.region='terminal';
  if(guard==='unready')f.configure({},'loading');
  f.dispatch({},owner);await settle();assert.deepEqual(f.calls,[]);f.dispose();
});
test('actual registry protects composition, consumed input and held repeats',async()=>{
  const f=fixture();f.install();for(const gesture of [{composing:true},{defaultPrevented:true},{repeat:true},{control:false},{shift:true}])f.dispatch(gesture);
  await settle();assert.deepEqual(f.calls,[]);f.dispatch();await settle();assert.deepEqual(f.calls,['main']);f.dispose();
});
test('live hint tracks accepted override/unbind/reset/conflict and loading with no fabricated keys',()=>{
  const f=fixture(),hint=f.install();assert.equal(hint.getSnapshot().aria,'Control+Alt+U');
  f.configure({[UNREAD_COMMAND_ID]:{code:'KeyY',modifiers:['control','alt']}});assert.equal(hint.getSnapshot().aria,'Control+Alt+Y');
  f.configure({[UNREAD_COMMAND_ID]:null});assert.equal(hint.getSnapshot(),undefined);
  f.configure();assert.equal(hint.getSnapshot().aria,'Control+Alt+U');
  f.registry.register({id:'other.action',label:()=>'',aliases:[],defaults:{'desktop:windows':{code:'KeyZ',modifiers:['control','alt']}},regions:['page'],modals:[],resolve:()=>({status:'pass'})});
  f.configure({[UNREAD_COMMAND_ID]:{code:'KeyZ',modifiers:['control','alt']},'other.action':{code:'KeyZ',modifiers:['control','alt']}});assert.equal(hint.getSnapshot(),undefined);
  f.configure();assert.equal(hint.getSnapshot().aria,'Control+Alt+U');f.configure({},'loading');assert.equal(hint.getSnapshot(),undefined);f.dispose();
});
test('feature off, child service loss and remount dispose exactly one command',()=>{
  const f=fixture(),hint=f.install();assert.equal(f.registry.definitions().length,1);
  f.prefs.set({features:{unread:false}});assert.equal(f.registry.definitions().length,0);assert.equal(hint.getSnapshot(),undefined);
  f.prefs.set({features:{unread:true}});assert.equal(f.registry.definitions().length,1);
  f.service('shortcuts',undefined);assert.equal(f.registry.definitions().length,0);assert.equal(hint.getSnapshot(),undefined);
  f.service('shortcuts',f.registry);assert.equal(f.registry.definitions().length,1);f.dispose();assert.equal(f.registry.definitions().length,0);
  f.install();assert.equal(f.registry.definitions().length,1);f.dispose();
});
test('conflicting registration and absent lifecycle capability leave existing features usable',()=>{
  const f=fixture();f.registry.register({id:'other.owner',label:()=>'',aliases:[],defaults:{'desktop:windows':{code:'KeyU',modifiers:['control','alt']}},regions:['page'],modals:[],resolve:()=>({status:'pass'})});
  const warn=console.warn;console.warn=()=>{};try{assert.equal(f.install().getSnapshot(),undefined);}finally{console.warn=warn;}
  assert.equal(f.registry.definitions().length,1);f.dispose();
  assert.equal(registerUnreadShortcuts({effect:fn=>fn()},f.options).getSnapshot(),undefined);
});
test('durable failure is reported, retry succeeds, already-unread is mark not toggle',async()=>{
  const f=fixture();let fail=true,events=0;const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem(key,value){if(fail)throw new Error('quota');data.set(key,value);events++;}};
  const durable=createUnreadStore(storage,{locks:{request:async(_key,run)=>run()}});f.options.reminders=durable;f.install();f.dispatch();await settle();assert.equal(durable.isUnread('main'),false);assert.equal(durable.getSnapshot().lastError,'quota');assert.equal(events,0);
  fail=false;f.dispatch();await settle();assert.equal(durable.isUnread('main'),true);assert.equal(events,1);assert.equal(JSON.parse(data.get(UNREAD_STORAGE_KEY)).unread.main,true);
  f.dispatch();await settle();assert.equal(durable.isUnread('main'),true);assert.equal(events,2);f.dispose();
});
