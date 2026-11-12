import { insertAppearanceItem, workspaceMenuParts } from '../src/appearance-menu.js';
// Controlled DOM for the legacy inline/no-separator callee contracts. Not React-owned.
window.appearanceCallee = {
  mount({ inline = false, separator = true } = {}) {
    const menu=document.createElement('div');menu.setAttribute('role','menu');
    const viewport=document.createElement('div');viewport.setAttribute('role','presentation');menu.append(viewport);
    const calls={rename:0,delete:0,appearance:0};
    const action=(caption,key)=>{const wrapper=document.createElement('div'),button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.innerHTML=`<span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M2 2h12v12H2z"/></svg></span><span>${caption}</span>`;button.addEventListener('click',()=>calls[key]++);wrapper.append(button);viewport.append(wrapper);return button;};
    const rename=action('Rename','rename');let sep;
    if(separator){sep=document.createElement('div');sep.setAttribute('role','separator');viewport.append(sep);}
    const remove=action('Delete workspace','delete');if(inline&&sep)remove.parentElement.prepend(sep);
    document.body.append(menu);
    const original={rename,remove,wrapper:remove.parentElement,icon:remove.firstElementChild,glyph:remove.querySelector('svg'),sep,sepParent:sep?.parentElement,sepHTML:sep?.outerHTML};
    const own=insertAppearanceItem(menu,'w1','Appearance',()=>calls.appearance++);
    const order=()=>[...viewport.children].map(node=>node.getAttribute('role')==='separator'?'separator':node.querySelector('button')?.textContent);
    window.appearanceCallee.check=()=>({order:order(),owned:workspaceMenuParts(menu,undefined,own)!==null,
      same:remove===original.remove&&remove.parentElement===original.wrapper&&remove.firstElementChild===original.icon&&remove.querySelector('svg')===original.glyph,
      separatorSame:!sep||sep.isConnected&&sep.parentElement===original.sepParent&&sep.outerHTML===original.sepHTML,
      inlineOrder:inline?[...remove.parentElement.children].map(node=>node.getAttribute('role')??node.tagName):null,calls:{...calls}});
  },
};
