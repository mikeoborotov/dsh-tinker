import { createPreferences, createStore } from '../src/store.js';
import { ICON_IDS } from '../src/icons.js';
import { CSS } from '../src/styles.js';
import { createWorkspacePickerAdapter } from '../src/workspace-picker.js';
const items = [
 {workspaceId:'w1',title:'Duplicate',sessionIds:['s1']},
 {workspaceId:'w2',title:'Duplicate',sessionIds:[]},
 {workspaceId:'w3',title:'default-workspace',sessionIds:[]},
];
const list=createStore({items,phase:'ready'}),prefs=createPreferences(localStorage,ICON_IDS);
let adapter;
const defaultName=()=> 'Default project';
function title(w){return w.title==='default-workspace'?defaultName():w.title;}
function closeMenu(){document.querySelector('#pick-menu')?.remove();document.querySelector('#chip').setAttribute('aria-expanded','false');}
function openMenu(){
 if(document.querySelector('#pick-menu')){closeMenu();return;}
 const menu=document.createElement('div');menu.id='pick-menu';menu.setAttribute('role','menu');menu.innerHTML='<div aria-hidden="true"></div><div role="presentation"></div><div role="presentation"><div><button role="menuitem"><span><svg/></span><span>Add workspace</span></button></div></div>';
 for(const w of list.getSnapshot().items){const row=document.createElement('div');row.innerHTML='<button role="menuitem"><span class="native-icon"><svg class="folder"/></span><span class="native-label"></span><svg class="check"/></button>';row.querySelector('.native-label').textContent=title(w);row.querySelector('button').addEventListener('click',()=>{document.querySelector('#chip-label').textContent=title(w);closeMenu();});menu.children[1].append(row);}
 document.querySelector('#chip').setAttribute('aria-expanded','true');document.body.append(menu);
}
window.fixture={
 mount(){const style=document.createElement('style');style.textContent=CSS;document.head.append(style);adapter=createWorkspacePickerAdapter({document,preferences:prefs,workspaces:{list},defaultName});document.querySelector('#chip').addEventListener('click',openMenu);},
 requestWorkspace:openMenu,
 prefs, list, closeMenu,
 confirm(id,sessionId='s1'){const state=list.getSnapshot();list.set({...state,items:state.items.map(w=>({...w,sessionIds:w.workspaceId===id?[sessionId]:[]}))});document.querySelector('[data-conversation-content]').setAttribute('data-conversation-session',sessionId);document.querySelector('#chip-label').textContent=title(state.items.find(w=>w.workspaceId===id));},
 dispose(){adapter.dispose();},
};
