// Test-only native host module alias. Exact RC.2 sources and licenses live in native-rc2/.
// The real public root also initializes document-wide input-modality tracking.
import './native-rc2/packages/client/ui-primitives/src/input-modality.ts';

export { Modal } from './native-rc2/packages/client/ui-primitives/src/Modal.tsx';
export { Button } from './native-rc2/packages/client/ui-primitives/src/Button.tsx';
export { observeComposition } from './native-rc2/packages/client/ui-primitives/src/keyboard-composition.ts';
