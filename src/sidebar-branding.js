export const BRANDING_CSS = `
[data-wsp-brand-hidden]{display:none!important}
[data-wsp-brand-row]{height:0!important;min-height:0!important;padding:0!important;margin:0!important;flex-basis:0!important;overflow:visible!important}
html:not([data-windows-titlebar]) [data-wsp-brand-root]:has([data-wsp-brand-toggle]){position:relative}
html:not([data-windows-titlebar]) [data-wsp-brand-toggle]{position:absolute!important;right:12px;top:9px}
html:not([data-windows-titlebar]) [data-wsp-brand-root]:has([data-wsp-brand-toggle])>[data-wsp-brand-new]{width:calc(100% - 36px);margin-right:36px}
`;

/** The name slot identifies the one RC.2 brand row without guessing hashed classes or text. */
export function attachSidebarBranding(marker) {
  const anchor = marker.closest('[data-slot="sidebar.brand.name"]');
  if (!anchor || anchor.tagName !== 'DIV' || anchor.style.display !== 'contents') return () => {};
  const name = anchor.parentElement, identity = name?.parentElement, brand = identity?.parentElement;
  const row = brand?.parentElement, root = row?.parentElement, newSession = row?.nextElementSibling;
  if (name?.tagName !== 'SPAN' || identity?.tagName !== 'SPAN'
    || !['SPAN', 'BUTTON'].includes(brand?.tagName) || row?.tagName !== 'DIV'
    || !row.hasAttribute('data-window-drag') || root?.tagName !== 'DIV'
    || newSession?.tagName !== 'BUTTON' || !newSession.hasAttribute('aria-label')
    || identity.children.length !== 2 || !identity.firstElementChild.querySelector('svg')
    || (brand.tagName === 'BUTTON' && brand.getAttribute('aria-label') !== newSession.getAttribute('aria-label'))
    || (row.children.length !== 1 && row.children.length !== 2)
    || (row.children.length === 2 && row.lastElementChild.tagName !== 'BUTTON')) return () => {};
  const changes = [];
  function tag(element, attr) {
    const before = element.getAttribute(attr);
    element.setAttribute(attr, '');
    changes.push(() => {
      if (element.getAttribute(attr) !== '') return;
      if (before === null) element.removeAttribute(attr); else element.setAttribute(attr, before);
    });
  }
  tag(brand, 'data-wsp-brand-hidden'); tag(row, 'data-wsp-brand-row'); tag(root, 'data-wsp-brand-root');
  tag(newSession, 'data-wsp-brand-new');
  if (row.children.length === 2) tag(row.lastElementChild, 'data-wsp-brand-toggle');
  return () => { for (const undo of changes.reverse()) undo(); };
}
