import * as react from "react";
import * as react_jsx_runtime from "react/jsx-runtime";
import * as _deepseek_ai_dsh_client_ui_primitives from "./primitives.js";
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
function isWindowsStylePath(value) {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}
function abbreviateHomePath(path, home) {
  if (home === void 0 || home === "") return path;
  if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
  const root = home.replace(/\/+$/, "");
  if (root === "" || root === "/") return path;
  if (path.replace(/\/+$/, "") === root) return "~";
  if (path.startsWith(`${root}/`)) return `~${path.slice(root.length)}`;
  return path;
}
const css$1 = '.wnFoaW_projectRow,.wnFoaW_sessionRow{align-items:center;gap:var(--dsh-sidebar-label-gap);border-radius:var(--dsw-radius-md);border-inline:var(--dsh-sidebar-paint-inset) solid transparent;box-sizing:border-box;padding:0 8px;cursor:pointer;-webkit-user-select:none;user-select:none;color:var(--dsw-alias-label-primary);background-clip:padding-box;padding-inline-start:calc(var(--dsh-sidebar-row-padding) - var(--dsh-sidebar-paint-inset) + var(--dsh-workspace-indent,0px));display:flex}@media (hover:hover){.wnFoaW_projectRow:hover{background-color:var(--dsw-alias-interactive-bg-hover)}}.wnFoaW_sessionRow.wnFoaW_selected{background-color:var(--dsw-alias-interactive-bg-hover)}.wnFoaW_dragPreview{background:var(--dsw-specific-sidebar-fill)}.wnFoaW_searchResultRow{box-sizing:border-box;border-radius:var(--dsw-radius-lg);width:100%;min-height:48px;padding:4px calc(var(--dsh-sidebar-row-padding) - var(--dsh-sidebar-paint-inset));border:none;border-inline:var(--dsh-sidebar-paint-inset) solid transparent;cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary);background:padding-box padding-box;flex-direction:column;align-items:stretch;display:flex}@media (hover:hover){.wnFoaW_searchResultRow:hover{background-color:var(--dsw-alias-interactive-bg-hover)}}.wnFoaW_searchResultRow.wnFoaW_selected{background-color:var(--dsw-alias-interactive-bg-hover)}.wnFoaW_searchResultHeading{align-items:center;min-width:0;display:flex}.wnFoaW_searchResultTitle{min-width:0;margin:0 var(--dsh-sidebar-label-gap);text-overflow:ellipsis;white-space:nowrap;flex:0 auto;font-size:14px;line-height:20px;overflow:hidden}.wnFoaW_searchResultMeta{min-width:0;margin-left:calc(16px + var(--dsh-sidebar-label-gap));align-items:center;gap:6px;display:flex}.wnFoaW_searchResultWorkspace,.wnFoaW_searchResultSnippet{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px;overflow:hidden}.wnFoaW_searchResultWorkspace{max-width:40%;color:var(--dsw-alias-label-tertiary);flex:none}.wnFoaW_searchResultWorkspace:only-child{max-width:100%}.wnFoaW_searchResultSnippet{min-width:0;color:var(--dsw-alias-label-secondary);flex:1}.wnFoaW_projectRow{box-sizing:border-box;align-items:center;height:34px}.wnFoaW_projectRow .wnFoaW_rowActions{height:20px}.wnFoaW_sessionRow{gap:0;height:32px}.wnFoaW_sessionRow .wnFoaW_title{margin:0 6px 0 var(--dsh-sidebar-label-gap)}.wnFoaW_slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.wnFoaW_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.wnFoaW_folderActive{color:var(--dsw-alias-state-business-primary)}.wnFoaW_projectRow .wnFoaW_chevron{display:none}@media (hover:hover){.wnFoaW_projectRow:hover .wnFoaW_chevron{display:inline-flex}.wnFoaW_projectRow:hover .wnFoaW_folder{display:none}}.wnFoaW_arrow{transition:transform .15s var(--ds-ease-in-out)}.wnFoaW_arrowOpen{transform:rotate(90deg)}.wnFoaW_projectText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.wnFoaW_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;line-height:20px;overflow:hidden}.wnFoaW_renameInput{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-button-elevated-fill);min-width:0;color:inherit;outline:none;padding:0 2px;font-size:14px;line-height:20px}.wnFoaW_sessionRow .wnFoaW_title{flex:1}.wnFoaW_sessionRow .wnFoaW_title[data-scrolled]{mask-image:linear-gradient(90deg,#0000,#000 12px)}.wnFoaW_sessionRow .wnFoaW_title[data-clipped]{mask-image:linear-gradient(270deg,#0000,#000 12px)}.wnFoaW_sessionRow .wnFoaW_title[data-scrolled][data-clipped]{mask-image:linear-gradient(90deg,#0000,#000 12px calc(100% - 12px),#0000)}.wnFoaW_meta{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;overflow:hidden}.wnFoaW_time{color:var(--dsw-alias-label-tertiary);flex:none;margin-inline-end:-1px;font-size:10px;line-height:16px}.wnFoaW_pinIndicator{width:16px;height:20px;color:var(--dsw-alias-label-caption);flex:none;justify-content:center;align-items:center;margin-left:6px;display:inline-flex}.wnFoaW_sessionRow.wnFoaW_archived .wnFoaW_title,.wnFoaW_searchResultRow.wnFoaW_archived .wnFoaW_searchResultTitle,.wnFoaW_searchResultRow.wnFoaW_archived .wnFoaW_searchResultWorkspace,.wnFoaW_searchResultRow.wnFoaW_archived .wnFoaW_searchResultSnippet{color:var(--dsw-alias-label-caption)}.wnFoaW_dot{flex:none}.wnFoaW_rowActions{flex:none;align-items:center;gap:13px;display:none}@media (hover:hover){.wnFoaW_projectRow:hover .wnFoaW_rowActions,.wnFoaW_searchResultRow:hover .wnFoaW_rowActions{display:inline-flex}}.wnFoaW_projectRow.wnFoaW_menuOpen .wnFoaW_rowActions{display:inline-flex}.wnFoaW_rowQuickActions{display:contents}.wnFoaW_searchResultHeading .wnFoaW_rowActions{margin-left:auto}.wnFoaW_rowResting{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:6px;display:inline-flex}.wnFoaW_rowResting .wnFoaW_pinIndicator{margin-left:0}@media (hover:hover){.wnFoaW_sessionRow:hover{background-color:var(--dsw-alias-interactive-bg-hover)}.wnFoaW_sessionRow:hover .wnFoaW_rowActions,.wnFoaW_sessionRow.wnFoaW_menuOpen .wnFoaW_rowActions,html[data-input-modality=keyboard] .wnFoaW_sessionRow:focus-within .wnFoaW_rowActions{display:inline-flex}.wnFoaW_sessionRow:hover .wnFoaW_rowResting,.wnFoaW_sessionRow.wnFoaW_menuOpen .wnFoaW_rowResting,html[data-input-modality=keyboard] .wnFoaW_sessionRow:focus-within .wnFoaW_rowResting{display:none}.wnFoaW_sessionRow:hover .wnFoaW_title,.wnFoaW_sessionRow.wnFoaW_menuOpen .wnFoaW_title{text-overflow:clip}}@media (hover:none){.wnFoaW_projectRow .wnFoaW_rowActions,.wnFoaW_searchResultRow .wnFoaW_rowActions,.wnFoaW_sessionRow .wnFoaW_rowActions{display:inline-flex}.wnFoaW_sessionRow .wnFoaW_timestamp,.wnFoaW_sessionRow:has(.wnFoaW_pinnedAction) .wnFoaW_pinIndicator,.wnFoaW_sessionRow .wnFoaW_rowQuickActions>[data-slot]>:not(.wnFoaW_pinnedAction),.wnFoaW_projectRow[aria-expanded=false] .wnFoaW_rowActions{display:none}.wnFoaW_sessionRow .wnFoaW_pinnedAction{order:-1}}.wnFoaW_projectRow.wnFoaW_menuOpen,.wnFoaW_sessionRow.wnFoaW_menuOpen{background-color:var(--dsw-alias-interactive-bg-hover)}.wnFoaW_sessionRow.wnFoaW_dropBefore,.wnFoaW_sessionRow.wnFoaW_dropAfter{position:relative}.wnFoaW_sessionRow.wnFoaW_dropBefore:before,.wnFoaW_sessionRow.wnFoaW_dropAfter:after{content:"";z-index:1;left:calc(-1 * var(--dsh-sidebar-paint-inset));right:calc(4px - var(--dsh-sidebar-paint-inset));background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute}.wnFoaW_sessionRow.wnFoaW_dropBefore:before{top:-7px}.wnFoaW_sessionRow.wnFoaW_dropAfter:after{bottom:-7px}.wnFoaW_hoverContent{flex-direction:column;gap:8px;display:flex}.wnFoaW_hoverTitle{color:#fff;overflow-wrap:break-word;font-size:14px;line-height:20px}.wnFoaW_hoverPath{color:#cfd3d6;word-break:break-all;font-size:12px;line-height:16px}.wnFoaW_hoverTime{color:#cfd3d6;font-size:12px;line-height:16px}.wnFoaW_hoverStatus{color:#adb2b8;align-items:center;gap:8px;font-size:12px;line-height:20px;display:flex}.wnFoaW_hoverArchived svg{flex-shrink:0;margin:0 -4px}.wnFoaW_iconButton{border-radius:var(--dsw-radius-xs);cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;margin:-4px;padding:0;display:inline-flex}.wnFoaW_iconButton:focus-visible{outline-offset:-2px}@media (hover:hover){.wnFoaW_iconButton:hover{color:var(--dsw-alias-label-primary)}}.wnFoaW_chevron{color:var(--dsw-alias-label-caption)}@media (prefers-reduced-motion:reduce){.wnFoaW_arrow{transition:none;animation:none}}';
const tagId$1 = "@deepseek-ai/dsh-client-ui-workspace/Rows.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
  tag.dataset.pluginCss = tagId$1;
  tag.textContent = css$1;
  document.head.appendChild(tag);
}
var Rows_module_css_default = {
  "archived": "wnFoaW_archived",
  "arrow": "wnFoaW_arrow",
  "arrowOpen": "wnFoaW_arrowOpen",
  "chevron": "wnFoaW_chevron",
  "dot": "wnFoaW_dot",
  "dragPreview": "wnFoaW_dragPreview",
  "dropAfter": "wnFoaW_dropAfter",
  "dropBefore": "wnFoaW_dropBefore",
  "folder": "wnFoaW_folder",
  "folderActive": "wnFoaW_folderActive",
  "hoverArchived": "wnFoaW_hoverArchived",
  "hoverContent": "wnFoaW_hoverContent",
  "hoverPath": "wnFoaW_hoverPath",
  "hoverStatus": "wnFoaW_hoverStatus",
  "hoverTime": "wnFoaW_hoverTime",
  "hoverTitle": "wnFoaW_hoverTitle",
  "iconButton": "wnFoaW_iconButton",
  "menuOpen": "wnFoaW_menuOpen",
  "meta": "wnFoaW_meta",
  "pinIndicator": "wnFoaW_pinIndicator",
  "pinnedAction": "wnFoaW_pinnedAction",
  "projectRow": "wnFoaW_projectRow",
  "projectText": "wnFoaW_projectText",
  "renameInput": "wnFoaW_renameInput",
  "rowActions": "wnFoaW_rowActions",
  "rowQuickActions": "wnFoaW_rowQuickActions",
  "rowResting": "wnFoaW_rowResting",
  "searchResultHeading": "wnFoaW_searchResultHeading",
  "searchResultMeta": "wnFoaW_searchResultMeta",
  "searchResultRow": "wnFoaW_searchResultRow",
  "searchResultSnippet": "wnFoaW_searchResultSnippet",
  "searchResultTitle": "wnFoaW_searchResultTitle",
  "searchResultWorkspace": "wnFoaW_searchResultWorkspace",
  "selected": "wnFoaW_selected",
  "sessionRow": "wnFoaW_sessionRow",
  "slot": "wnFoaW_slot",
  "time": "wnFoaW_time",
  "timestamp": "wnFoaW_timestamp",
  "title": "wnFoaW_title",
  "visuallyHidden": "wnFoaW_visuallyHidden"
};
const DRAG_PREVIEW_PROPERTIES = [
  "--dsh-sidebar-row-padding",
  "--dsh-sidebar-label-gap",
  "--dsh-sidebar-paint-inset"
];
const MIN_TITLE_REVEAL_PX = 8;
const TITLE_MARQUEE_PX_PER_MS = 0.03;
function displayTitle(node, t) {
  return node.blank ? t("session.new") : node.title || t("session.untitled");
}
function placeTitle(title, left, range) {
  if (typeof title.scrollTo === "function") title.scrollTo({
    left,
    behavior: "instant"
  });
  else title.scrollLeft = left;
  if (left > 0) title.dataset.scrolled = "";
  else delete title.dataset.scrolled;
  if (left < range) title.dataset.clipped = "";
  else delete title.dataset.clipped;
}
function restTitle(title) {
  if (typeof title.scrollTo === "function") title.scrollTo({
    left: 0,
    behavior: "instant"
  });
  else title.scrollLeft = 0;
  delete title.dataset.scrolled;
  delete title.dataset.clipped;
}
function useTitleMarquee(title) {
  const frame = (0, react.useRef)(0);
  const revealing = (0, react.useRef)(false);
  (0, react.useEffect)(() => () => {
    cancelAnimationFrame(frame.current);
  }, []);
  return (0, react.useMemo)(() => ({
    enter: (event) => {
      if (event?.pointerType === "touch") return;
      if (title.current === null) return;
      if (revealing.current) return;
      revealing.current = true;
      const element = title.current;
      const range = element.scrollWidth - element.clientWidth;
      if (range <= MIN_TITLE_REVEAL_PX) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        placeTitle(element, range, range);
        return;
      }
      cancelAnimationFrame(frame.current);
      let previous;
      let position = 0;
      const step = (now) => {
        position += previous === void 0 ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS;
        previous = now;
        placeTitle(element, Math.min(position, range), range);
        if (position < range) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    leave: () => {
      revealing.current = false;
      cancelAnimationFrame(frame.current);
      if (title.current === null) return;
      restTitle(title.current);
    }
  }), [title]);
}
function timeLabel(updatedAt, now, t) {
  const { unit, n } = (0, _deepseek_ai_dsh_client_ui_primitives.relativeTime)(updatedAt, now);
  return unit === "now" ? t("time.now") : t(`time.${unit}`, { n });
}
function hoverTimeLabel(updatedAt, now, t) {
  const { unit, n } = (0, _deepseek_ai_dsh_client_ui_primitives.relativeTime)(updatedAt, now);
  return unit === "now" ? t("time.now") : t("time.ago", { t: t(`time.${unit}`, { n }) });
}
function rowHalf(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
function assertNever(value) {
  throw new Error(`unknown pending interaction: ${String(value)}`);
}
function sessionStatuses(node, t) {
  const subagents = node.runningSubagentCount === 0 ? void 0 : {
    state: "ongoing",
    label: t(node.runningSubagentCount === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: node.runningSubagentCount })
  };
  let pending;
  switch (node.pendingInteraction) {
    case "approval":
      pending = {
        state: "warning",
        label: t("status.waitingApproval"),
        trailingLabel: t("status.compact.approval")
      };
      break;
    case "plan-review":
      pending = {
        state: "warning",
        label: t("status.planReview"),
        trailingLabel: t("status.compact.planReview")
      };
      break;
    case "question":
      pending = {
        state: "warning",
        label: t("status.waitingAnswer"),
        trailingLabel: t("status.compact.answer")
      };
      break;
    case void 0:
      break;
    /* v8 ignore next -- closed PendingInteractionStatus union */
    default:
      return assertNever(node.pendingInteraction);
  }
  if (pending !== void 0) return subagents === void 0 ? [pending] : [pending, subagents];
  if (node.running) {
    const primary = {
      state: "ongoing",
      label: t("status.running")
    };
    return subagents === void 0 ? [primary] : [primary, subagents];
  }
  if (subagents !== void 0) return [subagents];
  if (node.completed) return [{
    state: "done",
    label: t("status.completed")
  }];
  return [{
    state: "idle",
    label: t("status.idle")
  }];
}
function SessionStatusDots({ statuses }) {
  return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: statuses[0].state }), statuses.map((status) => (0, react_jsx_runtime.jsx)("span", {
    className: Rows_module_css_default.visuallyHidden,
    children: status.label
  }, status.label))] });
}
function PinnedIndicator({ t }) {
  const label = t("row.pinned");
  return (0, react_jsx_runtime.jsx)("span", {
    className: Rows_module_css_default.pinIndicator,
    role: "img",
    "aria-label": label,
    title: label,
    children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 })
  });
}
function SessionHoverContent({ node, cwd, now, renderSlot, t }) {
  const statuses = sessionStatuses(node, t).filter((status) => !(node.archived && (status.state === "done" || status.state === "idle")));
  return (0, react_jsx_runtime.jsxs)("div", {
    className: Rows_module_css_default.hoverContent,
    children: [
      (0, react_jsx_runtime.jsx)("div", {
        className: Rows_module_css_default.hoverTitle,
        children: displayTitle(node, t)
      }),
      cwd !== void 0 && (0, react_jsx_runtime.jsx)("div", {
        className: Rows_module_css_default.hoverPath,
        children: cwd
      }),
      !node.blank && (0, react_jsx_runtime.jsx)("div", {
        className: Rows_module_css_default.hoverTime,
        children: hoverTimeLabel(node.updatedAt, now, t)
      }),
      renderSlot("sidebar.session.row.hover", { sessionId: node.id }),
      statuses.map((status) => (0, react_jsx_runtime.jsxs)("div", {
        className: Rows_module_css_default.hoverStatus,
        children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: status.state }), (0, react_jsx_runtime.jsx)("span", { children: status.label })]
      }, status.label)),
      node.archived && (0, react_jsx_runtime.jsxs)("div", {
        className: clsx(Rows_module_css_default.hoverStatus, Rows_module_css_default.hoverArchived),
        children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 }), (0, react_jsx_runtime.jsx)("span", { children: t("row.archived") })]
      })
    ]
  });
}
function SessionNodeItem({ node, currentId, now, onOpen, onRenameRequest, renderSlot, openSessionMenu, useContextMenuTarget, useContextMenu, onReveal, drag, home, useSessionAccess, t }) {
  const { getTriggerProps } = useContextMenu();
  const row = node;
  const title = displayTitle(node, t);
  const selected = node.id === currentId;
  const statuses = sessionStatuses(node, t);
  const primaryStatus = statuses[0];
  const showStatus = primaryStatus.state !== "idle";
  const renamable = useSessionAccess(node.id, "session/rename");
  const reorderable = useSessionAccess(node.id, "workspace/insertSessionBefore");
  const draggable = drag !== void 0 && reorderable && !row.blank && !row.archived;
  const menuOpen = useContextMenuTarget((target) => target?.kind === "session" && target.value.sessionId === node.id);
  const dragPreview = (0, _deepseek_ai_dsh_client_ui_primitives.useRowDragPreview)(Rows_module_css_default.dragPreview, DRAG_PREVIEW_PROPERTIES);
  const rowRef = (0, react.useRef)(null);
  const titleRef = (0, react.useRef)(null);
  const renameArmed = (0, react.useRef)(false);
  const disarmRename = (0, react.useRef)(() => {
    renameArmed.current = false;
  }).current;
  const marquee = useTitleMarquee(titleRef);
  (0, react.useEffect)(() => {
    if (menuOpen || rowRef.current?.matches(":hover")) marquee.enter();
    else marquee.leave();
  }, [menuOpen, marquee]);
  (0, react.useEffect)(() => {
    if (onReveal === void 0) return;
    rowRef.current?.scrollIntoView({ block: "nearest" });
    onReveal();
  }, [onReveal]);
  return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
    anchor: (0, react_jsx_runtime.jsxs)("div", {
      ref: rowRef,
      "data-row-key": `session:${node.id}`,
      className: clsx(Rows_module_css_default.sessionRow, selected && Rows_module_css_default.selected, menuOpen && Rows_module_css_default.menuOpen, row.archived && Rows_module_css_default.archived, drag?.marker === "before" && Rows_module_css_default.dropBefore, drag?.marker === "after" && Rows_module_css_default.dropAfter),
      role: "treeitem",
      "aria-selected": selected,
      "aria-description": row.archived ? t("toast.archivedNotOpenable") : void 0,
      tabIndex: 0,
      onClick: () => {
        onOpen(node.id);
      },
      ...getTriggerProps(row.blank ? void 0 : {
        kind: "session",
        value: {
          sessionId: node.id,
          displayTitle: row.title
        }
      }, { onKeyDown: (event) => {
        if (event.target !== event.currentTarget || event.key !== "Enter" && event.key !== " ") return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        onOpen(node.id);
      } }),
      onPointerEnter: marquee.enter,
      onPointerLeave: () => {
        if (!menuOpen) marquee.leave();
      },
      draggable,
      onDragStart: !draggable ? void 0 : (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.id);
        drag.start();
        dragPreview.start(e);
      },
      onDragEnd: () => {
        if (dragPreview.clear()) drag?.end();
      },
      onDragOver: drag === void 0 ? void 0 : (e) => {
        if (!drag.active) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        drag.hover(rowHalf(e));
      },
      onDrop: drag === void 0 ? void 0 : (e) => {
        if (!drag.active) return;
        e.preventDefault();
        drag.drop(rowHalf(e));
      },
      children: [
        (0, react_jsx_runtime.jsx)("span", {
          className: Rows_module_css_default.slot,
          children: !row.archived && !row.blank && (showStatus ? (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses }) : renderSlot("sidebar.session.row.leading", { sessionId: node.id }))
        }),
        (0, react_jsx_runtime.jsx)("span", {
          ref: titleRef,
          className: Rows_module_css_default.title,
          onMouseDown: (e) => {
            if (e.detail !== 1) return;
            renameArmed.current = true;
            window.addEventListener("blur", disarmRename, { once: true });
          },
          onDoubleClick: row.blank || !renamable ? void 0 : (e) => {
            e.stopPropagation();
            if (!renameArmed.current) return;
            renameArmed.current = false;
            onRenameRequest(node.id, row.title);
          },
          children: title
        }),
        !row.blank && (0, react_jsx_runtime.jsxs)("span", {
          className: Rows_module_css_default.rowResting,
          children: [
            (0, react_jsx_runtime.jsx)("span", {
              className: clsx(Rows_module_css_default.time, primaryStatus.trailingLabel === void 0 && Rows_module_css_default.timestamp),
              "aria-hidden": primaryStatus.trailingLabel === void 0 ? void 0 : true,
              children: primaryStatus.trailingLabel ?? timeLabel(row.updatedAt, now, t)
            }),
            renderSlot("sidebar.session.row.trailing", { sessionId: node.id }),
            row.pinned && !row.archived && (0, react_jsx_runtime.jsx)(PinnedIndicator, { t })
          ]
        }),
        !row.blank && (0, react_jsx_runtime.jsxs)("span", {
          className: Rows_module_css_default.rowActions,
          onClick: (e) => {
            e.stopPropagation();
          },
          children: [(0, react_jsx_runtime.jsx)("button", {
            type: "button",
            className: Rows_module_css_default.iconButton,
            "aria-label": t("actions.session.aria", { name: title }),
            onPointerDown: (event) => {
              event.stopPropagation();
            },
            "data-context-menu-trigger": "",
            onClick: (event) => {
              event.currentTarget.focus({ preventScroll: true });
              const rect = event.currentTarget.getBoundingClientRect();
              openSessionMenu(node.id, row.title, {
                x: rect.left,
                y: rect.bottom
              }, "toggle");
            },
            children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
          }), (0, react_jsx_runtime.jsx)("span", {
            className: Rows_module_css_default.rowQuickActions,
            children: renderSlot("sidebar.workspaces.session.row.action", {
              sessionId: node.id,
              displayTitle: row.title
            })
          })]
        })
      ]
    }),
    content: (0, react_jsx_runtime.jsx)(SessionHoverContent, {
      node,
      cwd: row.cwd === void 0 ? void 0 : abbreviateHomePath(row.cwd, home),
      now,
      renderSlot,
      t
    }),
    openDelayMs: 800,
    grouped: true,
    disabled: menuOpen || drag?.active === true,
    copyText: row.blank || row.title === "" ? void 0 : row.title,
    copyLabel: t("copy"),
    copiedLabel: t("hover.copied")
  });
}
function ArchiveSessionRowButton({ sessionId, useArchived, useSessionAccess, archiveSession, unarchiveSession, t }) {
  const archived = useArchived((set) => set.has(sessionId));
  if (!useSessionAccess(sessionId, archived ? "workspace/unarchiveSession" : "workspace/archiveSession")) return null;
  return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
    label: t(archived ? "actions.unarchive" : "actions.archive"),
    side: "bottom",
    align: "end",
    delayMs: 500,
    portal: true,
    children: (0, react_jsx_runtime.jsx)("button", {
      type: "button",
      className: Rows_module_css_default.iconButton,
      "aria-label": t(archived ? "menu.unarchiveSession" : "menu.archiveSession"),
      onClick: () => {
        (archived ? unarchiveSession : archiveSession)(sessionId);
      },
      children: archived ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 })
    })
  });
}
function usePinState({ sessionId, usePinned, useArchived, useSessionAccess }) {
  const pinned = usePinned((set) => set.has(sessionId));
  return {
    pinned,
    archived: useArchived((archived) => archived.has(sessionId)),
    allowed: useSessionAccess(sessionId, pinned ? "workspace/unpinSession" : "workspace/pinSession")
  };
}
function PinSessionRowButton(props) {
  const { sessionId, pinSession, unpinSession, t } = props;
  const { pinned, archived, allowed } = usePinState(props);
  if (archived || !allowed) return null;
  return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
    label: t(pinned ? "actions.unpin" : "actions.pin"),
    side: "bottom",
    align: "end",
    delayMs: 500,
    portal: true,
    children: (0, react_jsx_runtime.jsx)("button", {
      type: "button",
      className: clsx(Rows_module_css_default.iconButton, pinned && Rows_module_css_default.pinnedAction),
      "aria-label": t(pinned ? "menu.unpinSession" : "menu.pinSession"),
      onClick: () => {
        (pinned ? unpinSession : pinSession)(sessionId);
      },
      children: pinned ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, { size: 14 })
    })
  });
}
export { SessionNodeItem, ArchiveSessionRowButton, PinSessionRowButton, Rows_module_css_default };
