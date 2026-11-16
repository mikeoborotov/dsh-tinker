import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detailFromReadme, writeDetailDocument } from '../scripts/readme.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(projectRoot, name));
const expectedFiles = ['DETAIL.md', 'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'client.js', 'cordis.patch.yml', 'icon.svg', 'index.js', 'locale/en.json', 'locale/ru.json', 'package.json'];

test('LF detail starts at Features and retains every trailing byte', () => {
  const prefix = Buffer.from('# Tinker\n\n## Install\n\nInstall first.\n\n');
  const suffix = Buffer.from('## Features\n\nFeature text.\n\n## License\n\n[MIT](LICENSE).\t  \n\n\n');
  const readme = Buffer.concat([prefix, suffix]);
  const original = Buffer.from(readme);
  const detail = detailFromReadme(readme);
  assert.ok(Buffer.isBuffer(detail));
  assert.deepEqual(detail, suffix);
  assert.deepEqual(readme, original, 'Extraction must not mutate the full README');
});

test('CRLF detail is returned without newline normalization', () => {
  const prefix = Buffer.from('# Tinker\r\n\r\n## Install\r\n\r\n');
  const suffix = Buffer.from('## Features\r\n\r\nFeatures stay intact.\r\n\r\n## License\r\n\r\n[MIT](LICENSE).\r\n');
  assert.deepEqual(detailFromReadme(Buffer.concat([prefix, suffix])), suffix);
});

test('Unicode before and after Features uses byte offsets, not character offsets', () => {
  const prefix = Buffer.from('# Настройки 🧰\n\nCafé e\u0301: 日本語.\n\n');
  const suffix = Buffer.from('## Features\n\nИконки 🧩, цвета, 日本語 и e\u0301.\n');
  assert.deepEqual(detailFromReadme(Buffer.concat([prefix, suffix])), suffix);
});

test('headings, badges and installation prefix are excluded but later sections remain', () => {
  const prefix = '# DSH Tinker\n\n![npm](https://example.test/badge)\n\n## Install\n\nInstall instructions.\n\n';
  const suffix = '## Features\n\nEnabled features.\n\n## Compatible DeepSeek Harness versions\n\n| Minimum | >=0.2.0-rc.2 |\n\n## License\n\n[MIT](LICENSE).\n';
  const detail = detailFromReadme(Buffer.from(prefix + suffix));
  assert.equal(detail.toString(), suffix);
  assert.doesNotMatch(detail.toString(), /# DSH Tinker|badge|Install instructions/);
});

test('mixed line endings and arbitrary suffix bytes are preserved exactly', () => {
  const suffix = Buffer.concat([Buffer.from('## Features\r\n\nBody\r\n'), Buffer.from([0xff, 0x00, 0x80, 0x0a, 0x0d, 0x0a])]);
  assert.deepEqual(detailFromReadme(Buffer.concat([Buffer.from('# Tinker\n\n'), suffix])), suffix);
});

test('Features at the beginning or end needs no surrounding blank line or final newline', () => {
  for (const text of ['## Features', '## Features\nBody without final newline', '## Features\r\n']) {
    const bytes = Buffer.from(text);
    assert.deepEqual(detailFromReadme(bytes), bytes);
  }
  assert.deepEqual(detailFromReadme(Buffer.from('# Tinker\n## Features')), Buffer.from('## Features'));
});

test('an ATX H2 may have up to three spaces, a tab separator or closing hashes', () => {
  for (const heading of ['##\tFeatures', '   ## Features', '## Features ##', '## Features ###  \t']) {
    const suffix = Buffer.from(heading + '\n\nText.\n');
    assert.deepEqual(detailFromReadme(Buffer.concat([Buffer.from('# Tinker\n\n'), suffix])), suffix);
  }
});

test('missing or non-H2 Features headings fail without a fallback', () => {
  for (const text of ['', '# Tinker\nREADME only.\n', '# Features\n', '### Features\n', '## features\n', '## Features extra\n', '##Features\n', '    ## Features\n', '> ## Features\n', 'Text ## Features\n', '\\## Features\n']) {
    assert.throws(() => detailFromReadme(Buffer.from(text)), /exactly one H2 Features.*found 0/);
  }
});

test('multiple real Features headings are ambiguous even after another section', () => {
  for (const text of ['## Features\nFirst.\n## Features\nSecond.\n', '## Features\n\n## License\n\n   ## Features ##\n']) {
    assert.throws(() => detailFromReadme(Buffer.from(text)), /exactly one H2 Features.*found 2/);
  }
});

test('backtick fenced headings before and after the real section are ignored', () => {
  const prefix = '# Tinker\n\n```md\n## Features\n```\n\n';
  const suffix = '## Features\n\nReal content.\n\n```markdown\n## Features\n```\n\n## License\n';
  assert.deepEqual(detailFromReadme(Buffer.from(prefix + suffix)), Buffer.from(suffix));
});

test('tilde fenced headings and indented fences are ignored', () => {
  const prefix = '# Tinker\r\n\r\n   ~~~ markdown\r\n## Features\r\n   ~~~~\t\r\n\r\n';
  const suffix = '## Features\r\n\r\nReal content.\r\n\r\n~~~\r\n## Features\r\n~~~\r\n';
  assert.deepEqual(detailFromReadme(Buffer.from(prefix + suffix)), Buffer.from(suffix));
});

test('only a matching fence of sufficient length with no info text closes code', () => {
  const prefix = '````md\n## Features\n```\n## Features\n~~~~\n## Features\n```` not-a-close\n## Features\n`````\n\n';
  const suffix = '## Features\n\nActual section.\n';
  assert.deepEqual(detailFromReadme(Buffer.from(prefix + suffix)), Buffer.from(suffix));
});

test('a backtick in backtick fence info does not open a code fence', () => {
  const suffix = '## Features\n\nActual heading.\n';
  assert.deepEqual(detailFromReadme(Buffer.from('```not`a-fence\n' + suffix)), Buffer.from(suffix));
});

test('fenced-only or unclosed fenced Features is missing, not a document stub', () => {
  for (const text of ['```md\n## Features\n```\n', '~~~\n## Features\n', '````\n## Features\n```\n']) {
    assert.throws(() => detailFromReadme(Buffer.from(text)), /exactly one H2 Features.*found 0/);
  }
});

test('a fence after Features does not truncate the returned suffix', () => {
  const suffix = Buffer.from('## Features\n\nText.\n\n```md\n## Features\nNo closing fence.');
  assert.deepEqual(detailFromReadme(Buffer.concat([Buffer.from('# Tinker\n\n'), suffix])), suffix);
});

test('only Buffers are accepted', () => {
  for (const value of ['## Features', undefined, null, new Uint8Array([35, 35])]) {
    assert.throws(() => detailFromReadme(value), /README must be a Buffer/);
  }
});

test('the helper imports only Node built-ins and exposes generation without a build import', async () => {
  assert.equal(typeof writeDetailDocument, 'function');
  const source = (await read('scripts/readme.mjs')).toString();
  const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]);
  assert.deepEqual(imports, ['node:fs/promises', 'node:path', 'node:url']);
  assert.doesNotMatch(source, /import\s*\(|\b(?:buildClient|packDev|execFile|spawn)\b/);
});

test('locale detail is a root Markdown path while titles, descriptions and engines stay unchanged', async () => {
  const manifest = JSON.parse(await read('package.json'));
  assert.equal(manifest.name, 'dsh-tinker');
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.description, 'Everyday usability upgrades - workspace icons, AI model logos, unread reminders, profile styling, cleaner sidebar.');
  assert.equal(manifest.description.length, 114);
  assert.deepEqual(manifest.engines, { dsh: '>=0.2.0-rc.2 <0.3.0-0' });
  for (const language of ['en', 'ru']) {
    const { meta } = JSON.parse(await read('locale/' + language + '.json'));
    assert.equal(meta.title, 'Tinker');
    assert.equal(meta.description, manifest.description);
    assert.equal(meta.detail, 'DETAIL.md');
    assert.equal(path.posix.dirname(meta.detail), '.', 'Root detail keeps LICENSE and notice links relative to the package root');
    assert.ok(!meta.detail.includes('\\') && !/^[A-Za-z][A-Za-z\d+.-]*:/.test(meta.detail));
    assert.ok(meta.detail.split('/').every(segment => segment && segment !== '.' && segment !== '..'));
    assert.match(meta.detail, /\.(?:md|markdown)$/i);
    assert.ok(manifest.files.includes(meta.detail));
  }
});

test('manifest and sorted packer allowlist contain both full README and detail among eleven members', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const files = manifest.files.flatMap(name => name === 'locale' ? ['locale/en.json', 'locale/ru.json'] : [name]);
  assert.deepEqual([...files, 'package.json'].sort(), expectedFiles);
  const source = (await read('scripts/pack-dev.mjs')).toString();
  const match = source.match(/^export const PACKAGE_FILES = (\[[^\r\n]+\]);$/m);
  assert.ok(match, 'A literal payload allowlist is required');
  const packageFiles = JSON.parse(match[1].replaceAll("'", '"'));
  assert.equal(packageFiles.length, 11);
  assert.deepEqual(packageFiles, expectedFiles);
  assert.deepEqual(packageFiles, [...packageFiles].sort());
});

test('README and the executing helper are snapshot inputs, while generated detail is not', async () => {
  const source = (await read('scripts/pack-dev.mjs')).toString();
  const inputs = source.match(/^const inputFiles = (\[[^\r\n]+\]);$/m);
  assert.ok(inputs);
  const inputFiles = JSON.parse(inputs[1].replaceAll("'", '"'));
  assert.ok(inputFiles.includes('README.md'));
  assert.ok(!inputFiles.includes('DETAIL.md'));
  assert.match(source, /for \(const name of \['scripts\/build\.mjs', 'scripts\/pack-dev\.mjs', 'scripts\/readme\.mjs'\]\) files\.set/);
});

test('current README yields a Features suffix with root-relative license and notices intact', async () => {
  const readme = await read('README.md');
  const detail = detailFromReadme(readme);
  assert.match(detail.toString(), /^## Features\r?\n/);
  assert.ok(detail.length < readme.length);
  assert.deepEqual(detail, readme.subarray(readme.length - detail.length));
  assert.match(detail.toString(), /\[MIT\]\(LICENSE\)/);
  assert.match(detail.toString(), /\[THIRD_PARTY_NOTICES\.md\]\(THIRD_PARTY_NOTICES\.md\)/);
});
