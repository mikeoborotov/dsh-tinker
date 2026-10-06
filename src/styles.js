export const CSS = `
.wsp-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:0 0 18px;line-height:1;font-size:17px;pointer-events:none;color:inherit}
.wsp-icon svg,.wsp-icon img{width:100%;height:100%;display:block;object-fit:contain}
.wsp-composer-icon{width:16px;height:16px;flex-basis:16px}
.wsp-session-icon{margin-right:6px}
.wsp-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;border-radius:6px;cursor:pointer}
.wsp-menu-item:hover,.wsp-menu-item:focus-visible{background:var(--dsw-alias-bg-overlay);outline:2px solid var(--dsw-alias-border-l4);outline-offset:-2px}
.wsp-panel{color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1.5;max-width:580px}
.wsp-panel *{box-sizing:border-box}
.wsp-panel h2{font-size:18px;font-weight:600;margin:0 0 16px}
.wsp-panel p{margin:8px 0;color:var(--dsw-alias-label-secondary)}
.wsp-panel button,.wsp-panel input,.wsp-panel select{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 12px}
.wsp-panel button{cursor:pointer}
.wsp-panel button:hover{background:var(--dsw-alias-bg-overlay)}
.wsp-panel button:focus-visible,.wsp-panel input:focus-visible,.wsp-panel select:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}
.wsp-panel button:disabled{opacity:.5;cursor:default}
.wsp-panel button[aria-pressed=true]{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay)}
.wsp-panel label{display:block;margin:12px 0 4px}
.wsp-panel input[type=text],.wsp-panel select{width:100%}
.wsp-panel input[type=color]{width:44px;height:36px;padding:3px;cursor:pointer}
.wsp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.wsp-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
.wsp-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:6px;margin:12px 0}
.wsp-grid button{padding:9px;display:flex;justify-content:center;align-items:center}
.wsp-palette button{width:28px;height:28px;padding:0;border-radius:50%;background:var(--wsp-art-color)}
.wsp-palette button:hover{background:var(--wsp-art-color)}
.wsp-panel .wsp-palette button[aria-pressed=true]{background:var(--wsp-art-color);outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}
.wsp-preview{display:flex;align-items:center;gap:12px;padding:12px 0}
.wsp-preview .wsp-icon{width:30px;height:30px;flex-basis:30px;font-size:28px}
.wsp-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:24px;z-index:100}
.wsp-dialog{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l3);border-radius:16px;padding:24px;width:540px;max-width:100%;max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 16px 48px var(--dsw-alias-bg-mask-2)}
.wsp-error{color:var(--dsw-alias-state-error-primary);margin:10px 0}
.wsp-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.wsp-toggle button{min-width:60px}
@media(max-width:480px){.wsp-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.wsp-mask{padding:12px}.wsp-dialog{padding:16px}}
`;
