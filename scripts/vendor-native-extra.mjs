// Explicit maintainer operation; ordinary builds/tests never download native sources.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = new URL('../tests/native-rc2/', import.meta.url);
const manifestURL = new URL('source-files.json', root);
const manifest = JSON.parse(await readFile(manifestURL, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (process.argv.includes('--check')) {
  for (const entry of manifest.files) {
    const bytes = await readFile(new URL(entry.path, root));
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error('Native fixture changed: ' + entry.path);
  }
  console.log('Native fixture: ' + manifest.files.length + ' pinned files verified');
} else if (process.argv.includes('--download')) {
  const queue = ['packages/client/ui-primitives/src/Menu.tsx', 'packages/client/ui-primitives/src/StateDot.tsx',
    'packages/client/ui-sidebar/src/client/SidebarRoot.tsx', 'packages/client/ui-primitives/src/Tooltip.tsx',
    'packages/client/ui-primitives/src/FishLogo.tsx', 'packages/client/ui-primitives/src/darwin-desktop.ts',
    'packages/client/ui-primitives/src/Toast.tsx'];
  const seen = new Set(manifest.files.map(entry => entry.path));
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    if (!name.startsWith('packages/') || name.includes('..')) throw new Error('Unexpected upstream path: ' + name);
    const source = 'https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/' + manifest.dshCommit + '/' + name;
    const response = await fetch(source);
    if (!response.ok) throw new Error(response.status + ' ' + source);
    const bytes = Buffer.from(await response.arrayBuffer());
    const target = new URL(name, root);
    await mkdir(new URL('./', target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' }); // Never overwrite an existing copy.
    manifest.files.push({ path: name, source, bytes: bytes.length, sha256: hash(bytes) });
    seen.add(name);
    const text = bytes.toString('utf8').replace(/import\s+type\b[\s\S]*?from\s*['"][^'"]+['"]\s*\n/g, '');
    for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1])));
    }
    console.log('Added pinned native copy: ' + name);
  }
  await writeFile(manifestURL, JSON.stringify(manifest, null, 2) + '\n');
} else {
  throw new Error('Use --check (offline) or --download (explicit pinned-source update)');
}
