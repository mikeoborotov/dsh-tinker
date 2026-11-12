import * as k from "react";
import * as p from "react/jsx-runtime";
import * as Ln from "react-dom";
const de = (...values) => values.filter(Boolean).join(" ");
const Np = { bubble: "_bubble_44yfq_1", label: "_label_44yfq_30" };
const oo = { dot: "_dot_1i3xo_2", spinner: "_spinner_1i3xo_37", spinnerMotion: "_spinnerMotion_1i3xo_42", spinnerTrack: "_spinnerTrack_1i3xo_47", spinnerArc: "_spinnerArc_1i3xo_48", step: "_step_1i3xo_97" };
const UD = { right: "left", left: "right", top: "bottom", bottom: "top" };
const Qv = { "archive-outline": { size: 20, svg: (e) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="${e}"><path d="M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z" stroke="currentColor"></path><path d="M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5" stroke="currentColor"></path><path d="M6.5 9.5H9.5" stroke="currentColor"></path></svg>` }, "unarchive-outline": { size: 20, svg: (e) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke-width="${e}"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.8659 2.05975C17.2603 2.05995 18.3913 3.19096 18.3914 4.58527V5.4874C18.3914 6.02747 18.2192 6.52672 17.9303 6.93735C17.9336 6.96524 17.9388 6.99318 17.9388 7.02195V12.8884C17.9388 13.6345 17.9395 14.2379 17.8996 14.7254C17.8642 15.1593 17.7936 15.5499 17.6373 15.9141L17.5654 16.0685C17.278 16.6328 16.8405 17.1046 16.3038 17.434L16.0679 17.5661C15.66 17.7739 15.2196 17.8598 14.7237 17.9003C14.2362 17.9401 13.6327 17.9405 12.8867 17.9405H7.11122C6.36511 17.9405 5.76171 17.9401 5.27418 17.9003C4.84051 17.8649 4.44949 17.7952 4.08545 17.6391L3.93104 17.5661C3.36673 17.2785 2.89392 16.8414 2.56465 16.3044L2.43245 16.0685C2.22473 15.6608 2.13878 15.2211 2.09825 14.7254C2.05841 14.2379 2.05912 13.6345 2.05912 12.8884V7.02195C2.05912 6.99284 2.06422 6.96449 2.06758 6.93629C1.77931 6.52592 1.60858 6.02687 1.60858 5.4874V4.58527C1.60876 3.19084 2.73962 2.05975 4.1341 2.05975H15.8659ZM16.4984 7.92936C16.296 7.98169 16.0847 8.01288 15.8659 8.01291H4.1341C3.91478 8.01291 3.70246 7.98194 3.49955 7.92936V12.8884C3.49955 13.6582 3.50053 14.1927 3.53445 14.608C3.56769 15.0146 3.62923 15.244 3.71635 15.415L3.7925 15.5514C3.98339 15.8627 4.25749 16.1165 4.58464 16.2833L4.72529 16.3435C4.88095 16.3993 5.08638 16.4402 5.39158 16.4651C5.80685 16.4991 6.34138 16.5001 7.11122 16.5001H12.8867C13.6564 16.5001 14.1911 16.499 14.6063 16.4651C15.0128 16.432 15.2423 16.3703 15.4133 16.2833L15.5508 16.2061C15.8618 16.0152 16.116 15.7419 16.2827 15.415L16.3429 15.2732C16.3985 15.1177 16.4396 14.9128 16.4645 14.608C16.4985 14.1927 16.4984 13.6583 16.4984 12.8884V7.92936ZM4.1341 3.50019C3.53511 3.50019 3.0492 3.98631 3.04902 4.58527V5.4874C3.04902 6.08649 3.535 6.57248 4.1341 6.57248H15.8659C16.4648 6.57228 16.951 6.08638 16.951 5.4874V4.58527C16.9509 3.98644 16.4647 3.50038 15.8659 3.50019H4.1341Z" fill="currentColor"></path><path d="M10 14.1V10.1M7.85 12.05L10 9.9L12.15 12.05" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>` }, "pin-outline": { size: 16, svg: (e) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="${e}"><path d="M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z" stroke="currentColor" stroke-linejoin="round"></path><path d="M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z" fill="currentColor"></path></svg>` }, "pin-fill": { size: 16, svg: (e) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="${e}"><path d="M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"></path><path d="M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z" fill="currentColor"></path></svg>` }, "ellipsis-outline": { size: 16, svg: (e) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="${e}"><path d="M3 9C3.55228 9 4 8.55228 4 8C4 7.44772 3.55228 7 3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9Z" fill="currentColor"></path><path d="M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z" fill="currentColor"></path><path d="M13 9C13.5523 9 14 8.55228 14 8C14 7.44772 13.5523 7 13 7C12.4477 7 12 7.44772 12 8C12 8.55228 12.4477 9 13 9Z" fill="currentColor"></path></svg>` } };
const ey = (e, t) => `dsw-icon-${e}-${t}`;
function M(e, t) {
  const { size: r, aspect: [i, n] = [1, 1] } = Qv[e], s = ey(e, t);
  return ({ size: l = r, className: u }) => p.jsx("svg", { width: l * i / n, height: l, className: u, "data-icon": s, "aria-hidden": "true", children: p.jsx("use", { href: `#${s}` }) });
}
export const ICON_SYMBOLS = Object.fromEntries(Object.entries(Qv).map(([key, value]) => [ey(key, "regular"), value.svg(1)]));
export const IconArchiveOutlineRegular = M("archive-outline", "regular");
export const IconUnarchiveOutlineRegular = M("unarchive-outline", "regular");
export const IconPinOutlineRegular = M("pin-outline", "regular");
export const IconPinFillRegular = M("pin-fill", "regular");
export const IconEllipsisOutlineRegular = M("ellipsis-outline", "regular");
function HD(e) {
  const { anchor: t, viewportWidth: r, viewportHeight: i, side: n, align: s, gap: l } = e;
  let { width: u, height: f } = e;
  const h = 12, g = Math.max(0, r - h * 2), y = Math.max(0, i - h * 2);
  u = Math.min(u, g), f = Math.min(f, y);
  const _ = (z) => Math.max(h, Math.min(z, r - h - u)), w = (z) => Math.max(h, Math.min(z, i - h - f)), b = n === "right" || n === "left", I = [n, UD[n], ...b ? ["bottom", "top"] : ["right", "left"]], C = { right: { left: t.right + 10, top: w((t.top + t.bottom - f) / 2) }, left: { left: t.left - 10 - u, top: w((t.top + t.bottom - f) / 2) }, bottom: { left: _(s === "end" ? t.right - u : (t.left + t.right - u) / 2), top: t.bottom + l }, top: { left: _(s === "end" ? t.right - u : (t.left + t.right - u) / 2), top: t.top - l - f } };
  for (const z of I) {
    const P = C[z];
    if (P.left >= h && P.top >= h && P.left + u <= r - h && P.top + f <= i - h) return { ...P, side: z, width: u, height: f, overflow: false };
  }
  const E = C[n];
  return { left: _(E.left), top: w(E.top), side: n, width: u, height: f, overflow: true };
}
function vy(e, t, r, i) {
  k.useEffect(() => {
    if (!t) return;
    const n = (s) => {
      s.target instanceof Node && e.current?.contains(s.target) !== true && i?.current?.contains(s.target) !== true && r(false);
    };
    return document.addEventListener("pointerdown", n), () => {
      document.removeEventListener("pointerdown", n);
    };
  }, [e, t, r, i]);
}
const Gp = { pointer: "pointer", keyboard: "keyboard" }, ZD = "data-input-modality", VD = /* @__PURE__ */ new Set(["Tab", "Home", "End", "PageUp", "PageDown"]);
let $2 = false, Vs = false, ai;
function B0() {
  document.documentElement.setAttribute(ZD, Vs ? Gp.pointer : Gp.keyboard);
}
function yy() {
  return $2;
}
typeof window < "u" && (window.addEventListener("pointerdown", () => {
  $2 = true, Vs = true, ai = void 0, B0();
}, true), window.addEventListener("keydown", (e) => {
  if ($2 = false, e.isComposing) {
    ai = void 0;
    return;
  }
  ai = e.composedPath()[0], !(!VD.has(e.key) && !e.key.startsWith("Arrow")) && (Vs = false, B0());
}, true), window.addEventListener("focusin", (e) => {
  ai === void 0 || e.composedPath()[0] === ai || (ai = void 0, Vs && (Vs = false, B0()));
}, true), window.addEventListener("blur", () => {
  ai = void 0;
}));
const Yp = k.createContext(null);
function BD(e) {
  return [e, ...e.querySelectorAll("*")].some((t) => t instanceof HTMLElement && t.scrollWidth > t.clientWidth);
}
function Mn({ label: e, shortcutKeys: t, side: r = "right", align: i = "center", delayMs: n = 0, focusDelayMs: s = 0, gap: l = 8, disabled: u = false, portal: f = false, maxWidth: h, openOnClick: g = false, onlyWhenClipped: y = false, children: _ }) {
  const w = k.useId(), [b, I] = k.useState(false), C = k.useRef(null), E = _.ref, z = k.useCallback((S) => {
    C.current = S, typeof E == "function" ? E(S) : E != null && (E.current = S);
  }, [E]), [P, O] = k.useState(null), L = k.useRef(null), F = P === null ? null : typeof e == "function" ? e() : e, B = k.useRef(null), X = k.useRef({ hover: false, focus: false }), R = k.useContext(Yp), [Z, K] = k.useState(false), V = k.useCallback((S) => {
    R?.(S);
  }, [R]), ee = P !== null && !u;
  k.useEffect(() => {
    const S = L.current;
    if (P === null || !ee || Z || S === null) return;
    let H, Se = P;
    const Ie = () => {
      if (H === void 0) return;
      const Ee = HD({ anchor: Se, width: H.inlineSize, height: H.blockSize, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, side: r, align: i, gap: l }), ce = Ee.side === "right" || Ee.side === "left", Le = ce ? 0 : i === "end" ? Ee.width : Ee.width / 2, Je = ce ? Ee.height / 2 : Ee.side === "top" ? Ee.height : 0;
      S.style.left = `${Ee.left + Le}px`, S.style.top = `${Ee.top + Je}px`, S.dataset.side = Ee.side, S.style.visibility = "visible";
    }, ze = () => {
      C.current !== null && (Se = C.current.getBoundingClientRect()), Ie();
    }, Te = new ResizeObserver((Ee) => {
      H = Ee[0]?.borderBoxSize[0], Ie();
    });
    return Te.observe(S, { box: "border-box" }), window.addEventListener("resize", ze), () => {
      Te.disconnect(), window.removeEventListener("resize", ze);
    };
  }, [i, l, P, r, Z, ee]), k.useEffect(() => (V(ee), () => {
    V(false);
  }), [V, ee]);
  const ae = k.useCallback(() => {
    B.current !== null && (clearTimeout(B.current), B.current = null);
  }, []);
  k.useEffect(() => (b && (u || !g) && I(false), u && (ae(), X.current = { hover: false, focus: false }, O(null)), ae), [ae, u, g, b]);
  const se = () => {
    if (u) return;
    const S = C.current;
    S !== null && (y && !BD(S) || (O(S.getBoundingClientRect()), V(true)));
  }, me = (S) => {
    if (ae(), S <= 0) {
      se();
      return;
    }
    B.current = setTimeout(() => {
      B.current = null, se();
    }, S);
  }, he = k.useCallback(() => {
    I(false), O(null), V(false);
  }, [V]), J = () => {
    ae(), !X.current.hover && !X.current.focus && !b && he();
  }, le = k.useCallback(() => {
    ae(), X.current = { hover: false, focus: false }, he();
  }, [ae, he]);
  vy(C, g && ee, le, L), k.useEffect(() => {
    if (!g || !ee) return;
    const S = (H) => {
      H.key !== "Escape" && H.key !== "Tab" || (H.key === "Escape" && (H.preventDefault(), H.stopPropagation()), le());
    };
    return document.addEventListener("keydown", S, true), () => {
      document.removeEventListener("keydown", S, true);
    };
  }, [le, g, ee]);
  const te = ee && !Z && p.jsxs("span", { ref: L, id: g ? w : void 0, className: Np.bubble, "data-side": r, "data-portal": f || void 0, "data-pinned": b || void 0, "data-align": i, "data-has-shortcut": t?.length ? true : void 0, style: { left: P.left, top: P.top, visibility: "hidden", ...h === void 0 ? {} : { maxWidth: `min(${h}px, calc(100vw - 24px))` } }, role: "tooltip", "aria-label": t?.length ? [F, t.join(" ")].filter(Boolean).join(" ") : void 0, children: [F && p.jsx("span", { className: Np.label, children: F }), t !== void 0 && t.length > 0 && p.jsx(la, { keys: t, variant: "tooltip" })] });
  return p.jsxs(Yp.Provider, { value: K, children: [k.cloneElement(_, { ref: z, "aria-describedby": g && ee ? [_.props["aria-describedby"], w].filter(Boolean).join(" ") : _.props["aria-describedby"], onPointerEnter: (S) => {
    _.props.onPointerEnter?.(S), S.pointerType !== "touch" && (S.pointerType === "mouse" && !window.matchMedia("(any-hover: hover)").matches || (X.current.hover = true, me(n)));
  }, onPointerLeave: (S) => {
    _.props.onPointerLeave?.(S), X.current.hover = false, ae(), b || he();
  }, onPointerDown: (S) => {
    _.props.onPointerDown?.(S), S.pointerType === "touch" && !b && le();
  }, onClick: (S) => {
    _.props.onClick?.(S), X.current.focus = false, ae(), g && !u && !b ? (I(true), se()) : he();
  }, onFocus: (S) => {
    _.props.onFocus?.(S), !yy() && (X.current.focus = true, me(s));
  }, onBlur: (S) => {
    _.props.onBlur?.(S), X.current.focus = false, J();
  } }), f ? te !== false && Ln.createPortal(te, document.body) : te] });
}
function TD(e) {
  e !== null && (Bp(e), e.addEventListener("animationstart", () => {
    Bp(e);
  }));
}
function Bp(e) {
  const t = e;
  for (const r of t.getAnimations?.({ subtree: true }) ?? []) r.startTime = 0;
}
function Cu({ state: e, size: t, className: r, appearance: i = "dot" }) {
  const n = t ?? (e === "ongoing" ? 14 : 10);
  return e === "ongoing" ? p.jsx("svg", { ref: TD, className: de(oo.spinner, r), "data-state": "ongoing", width: n, height: n, viewBox: "0 0 24 24", "aria-hidden": "true", children: p.jsxs("g", { className: oo.spinnerMotion, children: [p.jsx("circle", { className: oo.spinnerTrack, cx: "12", cy: "12", r: "9.5" }), p.jsx("circle", { className: oo.spinnerArc, cx: "12", cy: "12", r: "9.5" })] }) }) : p.jsx("span", { className: de(i === "step" ? oo.step : oo.dot, r), "data-state": e, style: { width: n, height: n }, "aria-hidden": "true", children: i === "step" && e === "done" && p.jsx(Bo, { size: n - 2 }) });
}
export { Mn as Tooltip, Cu as StateDot };
const _deepseek_ai_dsh_client_ui_primitives = { ICON_SYMBOLS };
const SVG_NS$1 = "http://www.w3.org/2000/svg";
const DROPPED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "width",
  "height",
  "xmlns",
  "class",
  "aria-hidden"
]);
function toSymbol(id, markup) {
  const root = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
  const symbol = document.createElementNS(SVG_NS$1, "symbol");
  for (const { name, value } of root.attributes) if (!DROPPED_ATTRIBUTES.has(name)) symbol.setAttribute(name, value);
  symbol.id = id;
  symbol.append(...[...root.childNodes].map((node) => document.importNode(node, true)));
  return symbol;
}
function installIconSprite(ctx, icons) {
  if (typeof document === "undefined") return;
  const sprite = document.createElementNS(SVG_NS$1, "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute("data-dsh-icon-sprite", "");
  sprite.style.cssText = "position: absolute; width: 0; height: 0; overflow: hidden";
  const rendered = /* @__PURE__ */ new Map();
  const markups = /* @__PURE__ */ new Map();
  const apply = (replacements = {}) => {
    for (const [id, fallback] of Object.entries(_deepseek_ai_dsh_client_ui_primitives.ICON_SYMBOLS)) {
      const markup = replacements[id] ?? fallback;
      if (markups.get(id) === markup) continue;
      const symbol = toSymbol(id, markup);
      const previous = rendered.get(id);
      if (previous === void 0) sprite.append(symbol);
      else previous.replaceWith(symbol);
      rendered.set(id, symbol);
      markups.set(id, markup);
    }
  };
  apply(icons);
  ctx.effect(() => {
    document.body.prepend(sprite);
    return () => {
      sprite.remove();
    };
  }, "ui-theme: icon sprite");
  ctx.on("theme/change", (snapshot) => {
    apply(snapshot.active.icons);
  });
}
export { installIconSprite };
export const HoverCard = ({ anchor }) => anchor;
export const useRowDragPreview = () => ({ start() {
}, clear() {
  return false;
} });
export const relativeTime = () => ({ unit: "minute", n: 1 });
export { MenuItemButton, Toast } from "../native-primitives.js";
const la = () => null;
