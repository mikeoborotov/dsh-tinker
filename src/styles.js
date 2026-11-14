export const CSS = `
.wsp-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:0 0 18px;line-height:1;font-size:17px;pointer-events:none;color:inherit}
.wsp-icon svg,.wsp-icon img{width:100%;height:100%;display:block;object-fit:contain}
.wsp-composer-icon{width:16px;height:16px;flex-basis:16px}
.wsp-model-menu-icon{width:16px;height:16px;flex-basis:16px}
.wsp-workspace-picker-icon{width:16px;height:16px;flex-basis:16px;font-size:16px}
.wsp-workspace-picker-menu-icon{width:100%;height:100%;flex-basis:auto;font-size:14px}
/* RC.2 has no row gap; the title adds 4px after our 6px margin. Move only the glyph. */
.wsp-session-icon{margin-right:6px;transform:translateX(5px)}
.wsp-panel{color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.4;max-width:560px}
.wsp-panel>h2{font-size:24px;line-height:30px;font-weight:600;letter-spacing:-.45px;margin:0 0 7px}
.wsp-settings-tabs{display:flex;gap:18px;margin:0 0 18px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.wsp-settings-tabs>.wsp-settings-tab{box-sizing:border-box;flex:none;min-height:34px;padding:0 2px;margin:0 0 -1px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;box-shadow:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;line-height:20px;white-space:nowrap;cursor:pointer}
.wsp-settings-tabs>.wsp-settings-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-label-primary)}
.wsp-settings-tabs>.wsp-settings-tab:focus-visible,.wsp-settings-tabpanel:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}
.wsp-settings-tabpanel[hidden]{display:none}
.wsp-settings-group{margin:0 0 15px}
.wsp-settings-group>h3{font-size:12px;line-height:17px;font-weight:600;margin:0 0 7px}
.wsp-settings-card{border:1px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l4));border-radius:var(--dsw-radius-md);background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2));overflow:hidden}
.wsp-settings-feature{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:53px;padding:10px 13px}
.wsp-settings-feature+.wsp-settings-feature{border-top:1px solid var(--dsw-alias-border-l3)}
.wsp-settings-feature-copy{min-width:0}
.wsp-settings-feature-label{font-size:12px;line-height:17px}
.wsp-settings-feature-description{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);margin-top:1px}
.wsp-settings-recovery{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.wsp-settings-recovery>h3,.wsp-settings-unread-recovery>h3{margin:0 0 9px;font-size:12px;line-height:17px;font-weight:600;color:var(--dsw-alias-label-primary)}
.wsp-settings-recovery>p{margin:0 0 9px}
.wsp-settings-unread-recovery{margin-top:16px}
.wsp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
/* Modal, its header/X and footer Buttons come from the host's public native primitives.
   Never put wsp-panel on that shell: its broad settings selectors override native controls. */
.wsp-appearance-dialog{width:min(760px,100%);height:620px;max-height:100%;font:inherit;color:var(--dsw-alias-label-primary)}
.wsp-appearance-content{flex:1;min-height:0;overflow:hidden}
.wsp-appearance-content>:first-child{flex-shrink:0}
.wsp-appearance-content>:last-child{flex:1;min-height:0;overflow:hidden}
.wsp-appearance-body{display:grid;grid-template-columns:208px minmax(0,1fr);gap:24px;height:100%;min-height:0;font-size:14px;line-height:22px}
.wsp-appearance-body *{box-sizing:border-box}
.wsp-appearance-context{display:flex;flex-direction:column;gap:28px;min-width:0;min-height:0;padding-right:24px;border-right:1px solid var(--dsw-alias-border-l3);overflow-y:auto;overscroll-behavior:contain}
.wsp-preview-divider{width:100%;margin:0;border:0;border-top:1px solid var(--dsw-alias-border-l3);flex:none}
.wsp-kind-section>.wsp-field-label{margin-bottom:6px}
.wsp-kind-tabs{display:flex;flex-direction:column;gap:5px;width:100%}
.wsp-kind-tabs .wsp-kind-choice{justify-content:flex-start;gap:8px;width:100%;height:44px;padding:8px 12px;text-align:left}
.wsp-kind-choice>svg{flex:none}
.wsp-kind-choice>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wsp-kind-tabs button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l4)}
.wsp-appearance-editor{display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.wsp-mode-panel{display:flex;flex:1;flex-direction:column;gap:12px;min-width:0;min-height:0}
.wsp-mode-panel>*{flex-shrink:0}
.wsp-mode-panel>.wsp-field-label{margin-bottom:-6px}
.wsp-search-category{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.wsp-category-anchor{width:100%;min-width:0}
.wsp-category-anchor .wsp-category-trigger{width:100%;height:44px;justify-content:space-between;gap:8px;padding:7px 14px;border-radius:var(--dsw-radius-lg);text-align:left}
.wsp-category-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wsp-category-trigger>svg{flex:none}
/* Portal card sizing only. Menu owns material, rows, hover, checks and keyboard. */
.wsp-emoji-category-menu{min-width:0;max-width:calc(100vw - 24px)}
/* Native Workspace Rename uses this raw-input shape, not the smaller public Input. */
.wsp-appearance-input{width:100%;height:44px;padding:7px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;outline:none}
.wsp-appearance-input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.wsp-appearance-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.wsp-appearance-input option{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wsp-field-label{display:block;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.wsp-color-section{display:flex;flex-direction:column;gap:6px}
.wsp-appearance-palette{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:7px}
.wsp-appearance-palette .wsp-color-swatch{width:28px;height:28px;padding:0;border-radius:50%;corner-shape:round;background:var(--wsp-art-color)}
.wsp-appearance-palette .wsp-color-swatch:hover:not(:disabled){background:var(--wsp-art-color)}
.wsp-color-swatch[aria-pressed=true]{outline:2px solid var(--dsw-alias-label-primary);outline-offset:3px}
.wsp-appearance-palette .wsp-custom-color,.wsp-appearance-palette .wsp-custom-color:hover:not(:disabled),.wsp-appearance-palette .wsp-custom-color:active:not(:disabled){width:28px;height:28px;flex:none;padding:0;border:0;border-radius:50%;corner-shape:round;background:conic-gradient(#ff0000 0deg,#ffff00 60deg,#00ff00 120deg,#00ffff 180deg,#0000ff 240deg,#ff00ff 300deg,#ff0000 360deg);box-shadow:none;cursor:pointer}
.wsp-custom-color:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:3px}
.wsp-color-picker{z-index:1100;box-sizing:border-box;display:flex;flex-direction:column;width:510px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 12px - max(12px,var(--dsh-frame-overlay-top,12px)));overflow:hidden;border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;corner-shape:round;box-shadow:var(--dsw-elevation-prominent);font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);outline:none}
.wsp-color-picker *{box-sizing:border-box}
.wsp-color-picker-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 0;flex:none}
.wsp-color-picker-header h3{margin:0;font-size:14px;line-height:22px;font-weight:600}
.wsp-color-picker-header .wsp-color-close{width:28px;height:28px;padding:0;color:var(--dsw-alias-label-secondary)}
.wsp-color-picker-content{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);gap:20px;padding:14px 16px 16px;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.wsp-color-plane{position:relative;min-width:0;height:248px;border-radius:12px;corner-shape:round;background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),var(--wsp-hue);overflow:hidden;cursor:crosshair;touch-action:none;outline:none}
.wsp-color-handle{position:absolute;width:14px;height:14px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #0006;transform:translate(-50%,-50%);pointer-events:none}
.wsp-color-controls{display:flex;flex-direction:column;gap:13px;min-width:0}
.wsp-color-channel{display:flex;flex-direction:column;gap:7px;min-width:0}
.wsp-color-channel>span{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.wsp-color-channel output{font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.wsp-color-range{appearance:none;width:100%;height:16px;border:0;border-radius:12px;margin:0;cursor:pointer;touch-action:none;outline:none}
.wsp-color-range::-webkit-slider-thumb{appearance:none;width:16px;height:20px;border:2px solid #fff;border-radius:8px;background:transparent;box-shadow:0 1px 4px #0009}
.wsp-color-range::-moz-range-thumb{width:12px;height:16px;border:2px solid #fff;border-radius:8px;background:transparent;box-shadow:0 1px 4px #0009}
.wsp-color-hex-field{min-width:0}
.wsp-color-hex-field>label{display:block;margin-bottom:7px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.wsp-color-hex-row{display:flex;align-items:center;gap:10px;min-width:0}
.wsp-color-current{width:38px;height:38px;flex:none;border-radius:10px}
.wsp-color-hex{width:100%;min-width:0;height:40px;padding:8px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.wsp-color-plane:focus-visible,.wsp-color-range:focus-visible,.wsp-color-hex:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}
.wsp-color-error{margin:7px 0 0;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
.wsp-color-picker-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:.5px solid var(--dsw-alias-border-l3);flex:none}
@media(max-width:520px){.wsp-color-picker-content{gap:14px;padding-left:14px;padding-right:14px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.wsp-color-current{width:28px;height:34px}.wsp-color-hex-row{gap:6px}.wsp-color-hex{padding:7px 8px;font-size:12px}.wsp-color-channel>span{font-size:10px}}
.wsp-choice-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-auto-rows:40px;align-content:start;gap:6px;flex:1;min-height:80px;overflow-y:auto;overscroll-behavior:contain;padding:2px}
.wsp-choice-grid .wsp-choice{height:40px;min-width:0;width:100%;padding:0}
.wsp-choice[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l4)}
.wsp-choice .wsp-icon{width:22px;height:22px;flex-basis:22px}
.wsp-emoji-choice{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;font-size:25px}
.wsp-results-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wsp-help{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.wsp-preview-section{display:flex;flex-direction:column;gap:6px}
.wsp-list-preview{display:flex;align-items:center;min-width:0;height:34px;gap:6px;padding:0;border:0;border-radius:0;background:transparent;font-size:14px;line-height:20px}
.wsp-list-preview>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wsp-list-preview .wsp-icon{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif}
.wsp-list-preview .wsp-native-folder{width:16px;height:16px;flex-basis:16px;color:var(--dsw-alias-label-secondary)}
.wsp-reset-action{margin-right:auto}
.wsp-image-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px 16px;flex:1;min-height:220px;border:1px dashed var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);text-align:center}
.wsp-image-dropzone.wsp-is-dragging{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.wsp-drop-title{font-size:16px;line-height:24px}
.wsp-hidden-file{display:none}
.wsp-error{color:var(--dsw-alias-state-error-primary);margin:10px 0}
/* The profile editor uses the native Modal shell, not the broad wsp-panel settings rules. */
.wsp-profile-dialog{width:min(388px,100%);max-height:100%;font:inherit;color:var(--dsw-alias-label-primary)}
.wsp-profile-content{min-height:0;overflow-y:auto;overscroll-behavior:contain}
.wsp-profile-content>p{font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.wsp-profile-body{display:flex;flex-direction:column;align-items:center;gap:23px;font-size:14px;line-height:22px;min-width:0;padding:3px 0 0}
.wsp-profile-body *{box-sizing:border-box}
.wsp-profile-body .wsp-profile-portrait{position:relative;display:inline-flex;width:84px;height:84px;min-width:84px;flex:none;padding:0;border:0;border-radius:50%;corner-shape:round;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.wsp-profile-body .wsp-profile-portrait:hover:not(:disabled){background:transparent}
.wsp-profile-avatar{display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:hidden;border-radius:50%;corner-shape:round;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.wsp-profile-avatar>svg{width:65%;height:65%}
.wsp-profile-avatar>img{display:block;width:100%;height:100%;object-fit:cover}
.wsp-profile-camera{position:absolute;right:-1px;bottom:-1px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:3px solid var(--dsw-alias-bg-layer-2);border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-2);pointer-events:none}
.wsp-profile-camera>svg{width:13px;height:13px}
.wsp-profile-body .wsp-profile-dragging{outline:2px dashed var(--dsw-alias-label-primary);outline-offset:4px}
.wsp-profile-dragging .wsp-profile-avatar{opacity:.72}
.wsp-profile-name{width:100%;max-width:282px;height:44px;padding:7px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;text-align:center;outline:none}
.wsp-profile-name::placeholder{color:var(--dsw-alias-label-tertiary)}
.wsp-profile-name:focus-visible,.wsp-profile-portrait:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}
.wsp-profile-file{display:none}
.wsp-profile-body .wsp-profile-reset{display:inline-flex;gap:6px;max-width:100%;height:auto;min-height:28px;padding:3px 0;font-size:12px;line-height:18px;white-space:normal;text-align:center;color:var(--dsw-alias-label-secondary)}
.wsp-profile-reset>svg{width:14px;height:14px;flex:none}
.wsp-profile-error{display:flex;flex-direction:column;align-self:stretch;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}
.wsp-profile-error>button{align-self:center;max-width:100%;height:auto;min-height:28px;white-space:normal;text-align:center}
@media(max-width:430px){.wsp-profile-body{gap:20px}.wsp-profile-body .wsp-profile-reset{font-size:11px}}
@media(max-width:640px){.wsp-appearance-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:12px}.wsp-appearance-context{gap:8px;padding:0 0 12px;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l3);overflow:visible}.wsp-preview-section{flex-direction:row;align-items:center;justify-content:space-between;gap:12px}.wsp-preview-section>.wsp-field-label{max-width:55%}.wsp-preview-section>.wsp-list-preview{max-width:45%}.wsp-preview-divider{display:none}.wsp-kind-tabs{flex-direction:row;gap:4px}.wsp-kind-tabs .wsp-kind-choice{flex:1;min-width:0;height:36px;padding:4px 8px;gap:6px}.wsp-search-category{grid-template-columns:minmax(0,1fr);gap:8px}.wsp-choice-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media(max-width:480px){.wsp-kind-choice>svg{display:none}.wsp-appearance-palette{gap:10px}.wsp-reset-action{font-size:12px;padding:0 8px}}
`;
