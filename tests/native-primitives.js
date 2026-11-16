// Test-only native host module alias. Exact RC.2 sources and licenses live in native-rc2/.
// The real public root also initializes document-wide input-modality tracking.
import './native-rc2/packages/client/ui-primitives/src/input-modality.ts';

export { Modal } from './native-rc2/packages/client/ui-primitives/src/Modal.tsx';
export { Button } from './native-rc2/packages/client/ui-primitives/src/Button.tsx';
export { Switch } from './native-rc2/packages/client/ui-primitives/src/Switch.tsx';
export { IconFolderCloseRegular, IconChevronDownOutlineRegular } from './native-rc2/packages/client/ui-primitives/src/icons/index.tsx';
export { Menu, MenuItemButton } from './native-rc2/packages/client/ui-primitives/src/Menu.tsx';
export { Toast } from './native-rc2/packages/client/ui-primitives/src/Toast.tsx';
export { StateDot } from './native-rc2/packages/client/ui-primitives/src/StateDot.tsx';
export { Tooltip } from './native-rc2/packages/client/ui-primitives/src/Tooltip.tsx';
export { FishLogo } from './native-rc2/packages/client/ui-primitives/src/FishLogo.tsx';
export { ShortcutKeys } from './native-rc2/packages/client/ui-primitives/src/ShortcutKeys.tsx';
export { isDarwinDesktop } from './native-rc2/packages/client/ui-primitives/src/darwin-desktop.ts';
export { IconNewChatOutlineMedium, IconNewChatOutlineRegular, IconPanelLeftOutlineRegular } from './native-rc2/packages/client/ui-primitives/src/icons/index.tsx';
export { observeComposition } from './native-rc2/packages/client/ui-primitives/src/keyboard-composition.ts';
export { MenuSurface } from './native-rc2/packages/client/ui-primitives/src/MenuSurface.tsx';
export { useModalLayer } from './native-rc2/packages/client/ui-primitives/src/useModalLayer.ts';
export { useAnchoredPosition } from './native-rc2/packages/client/ui-primitives/src/useAnchoredPosition.ts';
export { useDismissOnOutsidePointer } from './native-rc2/packages/client/ui-primitives/src/useDismissOnOutsidePointer.ts';
