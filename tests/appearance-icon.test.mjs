import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { APPEARANCE_BRUSH_SVG } from '../src/appearance-icon.js';

test('shared brush preserves the exact previously accepted Workspace trusted SVG',()=>{
  assert.equal(createHash('sha256').update(APPEARANCE_BRUSH_SVG).digest('hex'),'976d003e5b567a15f14fee331882258cc3b7fc9fab5dd98737eed8a822109656');
});
