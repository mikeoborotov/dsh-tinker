// Optional maintainer capture. Default tests consume only the adjacent committed slices.
// T149_NATIVE_EVIDENCE_DIR must contain public RC.1 software extracts, never a user profile.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';
const root=process.env.T149_NATIVE_EVIDENCE_DIR;
if(!root)throw new Error('Set T149_NATIVE_EVIDENCE_DIR to public RC.1 software extracts');
const sources={};
for(const [name,relative]of Object.entries({workspace:'dsh-client-ui-workspace/lib/client.js',sidebar:'dsh-client-ui-sidebar/lib/client.js',theme:'dsh-client-ui-theme/lib/client.js',frontend:'dsh-web-frontend/dist/assets/index-BgUyXZcc.js',webCss:'dsh-web-frontend/dist/assets/index-lh_YM6sT.css'}))sources[name]=await readFile(`${root}/dsh/node_modules/@deepseek-ai/${relative}`,'utf8');
const expected={workspace:'0180cefb85c1a71a1d441a8f9533663a8933d5e3f65f8dd23187c5f6147fe12f',sidebar:'1cc667401af9b64c5a90a5e10f8c085c2dad2852ebe4ed0e69dde5071f531653',theme:'1c8a1676576db8e94d0574f104f07a407d2328258d22d1b41a7584b276b81631',frontend:'c7e9821660f7e0f0524cc7cb1a375a5171eebbe68e167b80d290bd2ea391286d',webCss:'ac7c3d764558542be08b2da02e208c01bf2b9953a7a94bf1fd109bdc03e2d3a4'};
const sha=s=>createHash('sha256').update(s).digest('hex');
for(const[name,source]of Object.entries(sources))if(sha(source)!==expected[name])throw new Error(`RC.1 ${name} hash changed`);
const{workspace,sidebar,theme,frontend,webCss}=sources;
const literal='"(?:[^"\\\\]|\\\\.)*"';
function match(source,regex){const m=source.match(regex);if(!m)throw new Error(`Missing exact slice ${regex}`);return m[1];}
function between(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0)throw new Error(`Missing slice ${start}`);return source.slice(a,b);}
const minFunction=name=>between(frontend,`function ${name}(`,'}function ')+'}';
function workspaceFunction(name){const a=workspace.indexOf(`\t\tfunction ${name}(`);if(a<0)throw new Error(name);return workspace.slice(a,workspace.indexOf('\n\t\t}',a)+5);}
const iconKeys=['archive-outline','unarchive-outline','pin-outline','pin-fill','ellipsis-outline'];
const entries=iconKeys.map(key=>`"${key}":${match(frontend,new RegExp(`"${key}":(\\{size:[0-9]+,svg:e=>\x60[^\x60]*\x60\\})`))}`);
const constant=name=>match(frontend,new RegExp(`(?:^|[,;]|const )${name}=(${literal})`));
const maps=`const Np={bubble:${constant('kz')},label:${constant('Cz')}}; const oo={dot:${constant('DI')},spinner:${constant('RI')},spinnerMotion:${constant('AI')},spinnerTrack:${constant('FI')},spinnerArc:${constant('UI')},step:${constant('HI')}};`;
let primitives=`import * as k from 'react';import * as p from 'react/jsx-runtime';import * as Ln from 'react-dom';
const de=(...values)=>values.filter(Boolean).join(' ');${maps}
const UD=${match(frontend,/UD=(\{[^}]+\})/)};
const Qv={${entries.join(',')}}; const ey=(e,t)=>\x60dsw-icon-\${e}-\${t}\x60;${between(frontend,'function M(','const vL=')}
export const ICON_SYMBOLS=Object.fromEntries(Object.entries(Qv).map(([key,value])=>[ey(key,'regular'),value.svg(1)]));
${iconKeys.map((key,index)=>`export const ${['IconArchiveOutlineRegular','IconUnarchiveOutlineRegular','IconPinOutlineRegular','IconPinFillRegular','IconEllipsisOutlineRegular'][index]}=M('${key}','regular');`).join('\n')}
${between(frontend,'function HD(','const Gp=')+between(frontend,'const Gp=','function Mn(')+minFunction('Mn')}
${minFunction('TD')+minFunction('Bp')+between(frontend,'function Cu(','const O1=')}
export {Mn as Tooltip,Cu as StateDot};
const _deepseek_ai_dsh_client_ui_primitives={ICON_SYMBOLS};${between(theme,'\t\tconst SVG_NS$1 =','\t\t//#endregion\n\t\t//#region \\0dsh-inline-css:')}
export {installIconSprite};
// Non-layout transports intentionally unavailable in this isolated row seam.
export const HoverCard=({anchor})=>anchor;
export const useRowDragPreview=()=>({start(){},clear(){return false;}});
export const relativeTime=()=>({unit:'minute',n:1});
export { MenuItemButton,Toast } from '../native-primitives.js';
const la=()=>null;`;
const rowCss=between(workspace,'\t\tconst css$1 =','\t\t//#region lib/types/client/rows/Rows.js');
const rowConstants=match(workspace,/(const DRAG_PREVIEW_PROPERTIES = \[[\s\S]*?\];)/)+match(workspace,/(const MIN_TITLE_REVEAL_PX = [^;]+;)/)+match(workspace,/(const TITLE_MARQUEE_PX_PER_MS = [^;]+;)/);
const rows=`${rowConstants}\n${['displayTitle','placeTitle','restTitle','useTitleMarquee','timeLabel','hoverTimeLabel','rowHalf','assertNever','sessionStatuses','SessionStatusDots','PinnedIndicator','SessionHoverContent','SessionNodeItem'].map(workspaceFunction).join('\n')}`;
let rowModule=`import * as react from 'react';import * as react_jsx_runtime from 'react/jsx-runtime';import * as _deepseek_ai_dsh_client_ui_primitives from './primitives.js';
${workspaceFunction('r')+workspaceFunction('clsx')+workspaceFunction('isWindowsStylePath')+workspaceFunction('abbreviateHomePath')}
${rowCss}${rows}
${workspaceFunction('ArchiveSessionRowButton')+workspaceFunction('usePinState')+workspaceFunction('PinSessionRowButton')}
export {SessionNodeItem,ArchiveSessionRowButton,PinSessionRowButton,Rows_module_css_default};`;
// Retain complete top-level CSS blocks for reset, Tooltip and StateDot, including their media/keyframes.
function blocks(source){const result=[];let start=0,depth=0,quote=null;for(let i=0;i<source.length;i++){const c=source[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0){result.push(source.slice(start,i+1));start=i+1;}}return result;}
const classNames=[...maps.matchAll(/"(_[^"]+)"/g)].map(m=>m[1]);
const moduleIds=[...new Set(classNames.map(name=>name.split('_').at(-2)))];
const primitiveCss=blocks(webCss).filter(block=>classNames.some(name=>block.includes(name))||(block.startsWith('@keyframes')&&moduleIds.some(id=>block.includes(`_${id}_`)))||/^(?:html|body|:root|\*|button\b|input\b|textarea\b|select\b)/.test(block)).join('\n');
const themeCss=[...theme.matchAll(new RegExp(`var [a-z_]+_css_default = (${literal});`,'g'))].map(m=>JSON.parse(m[1])).join('\n');
const sidebarCss=JSON.parse(match(sidebar,new RegExp(`const css = (${literal});`)));
const outputs={'primitives.js':(await transform(primitives,{minify:false})).code,'workspace.js':(await transform(rowModule,{minify:false})).code,'baseline.css':[primitiveCss,themeCss,sidebarCss].join('\n')};
for(const[name,content]of Object.entries(outputs))await writeFile(new URL(name,import.meta.url),content);
await writeFile(new URL('provenance.json',import.meta.url),JSON.stringify({version:'0.2.2-rc.1',buildCommit:'c59d10aff167ad7eefead4b3a9082fb57c8fbfe8',source:'https://github.com/deepseek-ai/deepseek-harness',sourceHashes:expected,sliceHashes:Object.fromEntries(Object.entries(outputs).map(([name,content])=>[name,sha(content)])),omissions:['HoverCard overlay','drag transport','relative time formatting','shortcut label rendering'],compatibility:'MenuItemButton and Toast reuse the existing supported RC.2 public fixtures.'},null,2)+'\n');
console.log(Object.fromEntries(Object.entries(outputs).map(([name,content])=>[name,Buffer.byteLength(content)])));
