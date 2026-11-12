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
.wsp-settings-description{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin:0 0 20px}
.wsp-settings-group{margin:0 0 15px}
.wsp-settings-group>h3{font-size:12px;line-height:17px;font-weight:600;margin:0 0 7px}
.wsp-settings-card{border:1px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l4));border-radius:var(--dsw-radius-md);background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2));overflow:hidden}
.wsp-settings-feature{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:53px;padding:10px 13px}
.wsp-settings-feature+.wsp-settings-feature{border-top:1px solid var(--dsw-alias-border-l3)}
.wsp-settings-feature-copy{min-width:0}
.wsp-settings-feature-label{font-size:12px;line-height:17px}
.wsp-settings-feature-description{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);margin-top:1px}
.wsp-settings-recovery{border-top:1px solid var(--dsw-alias-border-l3);margin-top:20px;padding-top:12px}
.wsp-settings-recovery>summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-secondary)}
.wsp-settings-recovery>summary:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color);outline-offset:3px}
.wsp-settings-recovery-body{margin:12px 0 0 14px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.wsp-settings-recovery-body>p{margin:0 0 9px}
.wsp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
/* Modal, its header/X and footer Buttons come from the host's public native primitives.
   Never put wsp-panel on that shell: its broad settings selectors override native controls. */
.wsp-appearance-dialog{width:min(540px,100%);max-height:100%;font:inherit;color:var(--dsw-alias-label-primary)}
.wsp-appearance-content{min-height:0;overflow-y:auto;overscroll-behavior:contain}
.wsp-appearance-body{display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:22px}
.wsp-appearance-body *{box-sizing:border-box}
.wsp-kind-tabs{display:flex;gap:4px;align-self:flex-start;padding:3px;background:var(--dsw-alias-bg-layer-1);border-radius:var(--dsw-radius-md)}
.wsp-kind-tabs button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l4)}
/* Native Workspace Rename uses this raw-input shape, not the smaller public Input. */
.wsp-appearance-input{width:100%;height:44px;padding:7px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;outline:none}
.wsp-appearance-input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.wsp-appearance-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.wsp-appearance-input option{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wsp-field-label{display:block;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.wsp-color-section{display:flex;flex-direction:column;gap:6px}
.wsp-appearance-palette{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:4px 2px}
.wsp-appearance-palette .wsp-color-swatch{width:28px;height:28px;padding:0;border-radius:50%;corner-shape:round;background:var(--wsp-art-color)}
.wsp-appearance-palette .wsp-color-swatch:hover:not(:disabled){background:var(--wsp-art-color)}
.wsp-color-swatch[aria-pressed=true]{outline:2px solid var(--dsw-alias-label-primary);outline-offset:3px}
.wsp-custom-color{width:28px;height:28px;padding:0;border:1px solid var(--dsw-alias-border-l4);border-radius:50%;corner-shape:round;background:transparent;cursor:pointer;overflow:hidden}
.wsp-custom-color::-webkit-color-swatch-wrapper{padding:0}
.wsp-custom-color::-webkit-color-swatch{border:0;border-radius:50%}
.wsp-custom-color::-moz-color-swatch{border:0;border-radius:50%}
.wsp-choice-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:6px;max-height:226px;overflow-y:auto;overscroll-behavior:contain;padding:2px}
.wsp-choice-grid .wsp-choice{height:40px;min-width:0;width:100%;padding:0}
.wsp-choice[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l4)}
.wsp-choice .wsp-icon{width:22px;height:22px;flex-basis:22px}
.wsp-emoji-choice{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;font-size:25px}
.wsp-results-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wsp-help{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.wsp-preview-section{display:flex;flex-direction:column;gap:6px}
.wsp-list-preview{display:flex;align-items:center;height:34px;gap:6px;padding:0 8px;border-radius:var(--dsw-radius-md);background:var(--dsw-specific-sidebar-fill);font-size:14px;line-height:20px}
.wsp-list-preview>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wsp-list-preview .wsp-icon{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif}
.wsp-list-preview .wsp-native-folder{width:16px;height:16px;flex-basis:16px;color:var(--dsw-alias-label-secondary)}
.wsp-reset-action{margin-right:auto}
.wsp-image-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px 16px;min-height:188px;border:1px dashed var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);text-align:center}
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
@media(max-width:480px){.wsp-choice-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.wsp-appearance-palette{gap:10px}.wsp-reset-action{font-size:12px;padding:0 8px}}
`;
