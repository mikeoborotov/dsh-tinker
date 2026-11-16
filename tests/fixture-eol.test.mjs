import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const fixturePaths = [
  'tests/native-shortcuts-rc2/packages/client/shortcuts/src/binding.ts',
  'tests/native-hover-rc1/workspace.js',
];
const metadata = data => ({
  bytes: data.length,
  sha256: createHash('sha256').update(data).digest('hex'),
});

for (const fixturePath of fixturePaths) {
  test(`Git autocrlf checkout preserves pinned fixture bytes: ${fixturePath}`, () => {
    const options = { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] };
    const blob = execFileSync('git', ['cat-file', 'blob', `HEAD:${fixturePath}`], options);
    const checkout = execFileSync('git', [
      '-c', 'core.autocrlf=true', 'cat-file', '--filters', `HEAD:${fixturePath}`,
    ], options);

    // Compare actual bytes, but report only sizes and hashes on failure.
    assert.ok(checkout.equals(blob), JSON.stringify({
      path: fixturePath,
      blob: metadata(blob),
      checkout: metadata(checkout),
    }));
  });
}
