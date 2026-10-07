import marks from './provider-marks.json';
import workspaceIcons from './workspace-icons.json';

export const ICONS = workspaceIcons;
export const ICON_IDS = ICONS.map(icon => icon.id);
export const PALETTE = ['#4176e6', '#22a06b', '#8b5cf6', '#d946a3', '#e5484d', '#e97924', '#d9a514', '#16a5a3', '#77808c'];
const names = { deepseek: 'DeepSeek', openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', moonshotai: 'Kimi', xai: 'xAI', mistral: 'Mistral', qwen: 'Qwen', zhipuai: 'Zhipu AI', minimax: 'MiniMax' };

export function vendorOf(selection) {
  if (!selection) return null;
  const model = String(selection.model ?? '').toLowerCase();
  const provider = String(selection.provider ?? '').toLowerCase();
  // A routed model's laboratory outranks the transport provider (e.g. DeepSeek via OpenRouter).
  const known = value => {
    if (/deepseek/.test(value)) return 'deepseek';
    if (/claude|anthropic/.test(value)) return 'anthropic';
    if (/gemini|google/.test(value)) return 'google';
    if (/kimi|moonshot/.test(value)) return 'moonshotai';
    if (/grok|(^|[-_/])xai($|[-_/])/.test(value)) return 'xai';
    if (/mistral|codestral|devstral/.test(value)) return 'mistral';
    // Match actual model families and lab aliases, not Alibaba/DashScope transports or display names.
    if (/(^|[-_/])qwen(?=\d|$|[-_/.])/.test(value)) return 'qwen';
    if (/(^|[-_/])(?:chatglm|glm)(?=\d|$|[-_/.])|(^|[-_/])(?:zhipu(?:ai)?|z[.-]?ai)(?=$|[-_/.])/.test(value)) return 'zhipuai';
    if (/(^|[-_/])minimax(?=$|[-_/.])/.test(value)) return 'minimax';
    if (/(^|[/_-])(gpt|o[134])[-_.\d]|codex|openai/.test(value)) return 'openai';
    return null;
  };
  return known(model) ?? known(provider);
}
export function vendorName(selection) { return names[vendorOf(selection)] ?? 'AI'; }
export function markSVG(selection) {
  const vendor = vendorOf(selection), mark = marks[vendor];
  if (!mark) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M9 9h6v6H9z"/></svg>';
  const paths = mark.paths.map(p => '<path d="' + p.d + '"' + (p.fillRule ? ' fill-rule="' + p.fillRule + '"' : '') + (p.clipRule ? ' clip-rule="' + p.clipRule + '"' : '') + (p.opacity ? ' opacity="' + p.opacity + '"' : '') + '/>').join('');
  return '<svg viewBox="' + mark.viewBox + '" fill="' + (vendor === 'deepseek' ? '#4176e6' : 'currentColor') + '">' + paths + '</svg>';
}
export function selectionOf(snapshot, id) { return snapshot?.byId?.[id]?.projectionValues?.modelSelection?.next ?? null; }
export function iconSVG(id) { return ICONS.find(icon => icon.id === id)?.svg ?? ICONS[0].svg; }
export function fillAppearance(element, appearance) {
  element.replaceChildren();
  element.style.color = '';
  if (appearance.kind === 'icon') { element.innerHTML = iconSVG(appearance.icon); element.style.color = appearance.color; }
  else if (appearance.kind === 'emoji') { element.textContent = appearance.emoji; }
  else if (appearance.kind === 'image' && appearance.data) {
    const img = element.ownerDocument.createElement('img');
    img.src = appearance.data; img.alt = ''; img.draggable = false; element.append(img);
  }
}
