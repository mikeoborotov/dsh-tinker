import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

// Keep byte offsets in the original Buffer, including all suffix line endings.
export function detailFromReadme(readme) {
  if (!Buffer.isBuffer(readme)) throw new TypeError('README must be a Buffer');
  const headings = [];
  let fence;
  for (let offset = 0; offset < readme.length;) {
    const newline = readme.indexOf(0x0a, offset);
    const end = newline === -1 ? readme.length : newline;
    const line = readme.subarray(offset, end).toString('utf8').replace(/\r$/, '');
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && /^[ \t]*$/.test(marker[2])) fence = undefined;
    } else if (marker && (marker[1][0] !== '`' || !marker[2].includes('`'))) {
      fence = { character: marker[1][0], length: marker[1].length };
    } else if (/^ {0,3}##[ \t]+Features(?:[ \t]+#+)?[ \t]*$/.test(line)) {
      headings.push(offset);
    }
    offset = newline === -1 ? readme.length : newline + 1;
  }
  if (headings.length !== 1) throw new Error('README must contain exactly one H2 Features heading outside fenced code blocks; found ' + headings.length);
  return readme.subarray(headings[0]);
}

// Documentation only: no build, package-manager call or change to the full README.
export async function writeDetailDocument(root = projectRoot) {
  root = path.resolve(root);
  const detail = detailFromReadme(await readFile(path.join(root, 'README.md')));
  const target = path.join(root, 'DETAIL.md');
  let previous;
  try { previous = await readFile(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!previous?.equals(detail)) await writeFile(target, detail);
  return detail;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/readme.mjs');
  const detail = await writeDetailDocument();
  console.log('DETAIL.md is up to date (' + detail.length + ' bytes).');
}
