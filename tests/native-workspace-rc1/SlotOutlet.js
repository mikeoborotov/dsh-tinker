// Exact native 0.2.2-rc.1 anchor function; fixture owns its static service dependencies.
// MIT, see LICENSE. This does not model the anchor tag/display/content protocol.
import * as react from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';
export function capturedSlotOutlet({ useHost, useLocaleRevision, useScopeBinding, renderOutletContent }) {
		const ANCHOR_STYLE = { display: "contents" };
		function SlotOutlet({ slotKey, ownerProps, opts, declaredInline }) {
			const host = useHost();
			(0, react.useSyncExternalStore)((fn) => host.subscribe(slotKey, fn), () => host.getVersion(slotKey));
			useLocaleRevision(host.locale);
			const scopeBinding = useScopeBinding();
			const spec = host.specOf(slotKey);
			return (0, react_jsx_runtime.jsx)((spec === void 0 ? declaredInline : spec.inline === true) ? "span" : "div", {
				"data-slot": slotKey,
				style: ANCHOR_STYLE,
				children: spec === void 0 ? null : renderOutletContent(host, slotKey, ownerProps, opts, scopeBinding, spec)
			});
		}
return SlotOutlet;
}
