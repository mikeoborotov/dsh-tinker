#!/usr/bin/env node
/**
 * Generate the checked-in native-glyph catalog. No npm dependencies.
 *
 * node scripts/build-emoji-data.mjs                 Fetch pinned sources and generate.
 * node scripts/build-emoji-data.mjs --check         Validate checked-in data OFFLINE.
 * node scripts/build-emoji-data.mjs --verify        Rebuild from sources without writing.
 * Add --source-dir <dir> to generate/verify from local source copies instead of fetching.
 * Local copies use emoji-test.txt, annotations/{en,ru}.xml and annotationsDerived/{en,ru}.xml.
 *
 * Sources: final Unicode Emoji 13.1 (2020), Unicode CLDR 38.1 (2020).
 * CLDR annotationsDerived supplies standard skin-tone, gender and flag annotations.
 * Copyright 1991-2020 Unicode, Inc.; Unicode-DFS-2016 license. Preserve its notice
 * in associated distribution documentation. Exact license URL is in the metadata.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EMOJI_VERSION = '13.1';
export const CLDR_VERSION = '38.1';
export const CLDR_COMMIT = '367b79b4a86a9cb12314158897d950268dc77b02';
export const EXPECTED_COUNT = 3512;
export const SEQUENCE_SHA256 = 'c224e70fa1fb6a689c76b34af99839594a86e073a9487fbab5a9130e6c6d5788';
const OUTPUT = new URL('../src/emoji-data.json', import.meta.url);
const CLDR_BASE = `https://raw.githubusercontent.com/unicode-org/cldr/${CLDR_COMMIT}`;
export const SOURCES = [
  { id: 'emoji-test', file: 'emoji-test.txt', url: 'https://unicode.org/Public/emoji/13.1/emoji-test.txt', sha256: '8e3cc312a2a85115184738fa7ed97b3a9b3d0d221ffdaec3b22fd0314a18cd58' },
  { id: 'annotations-en', file: 'annotations/en.xml', url: `${CLDR_BASE}/common/annotations/en.xml`, sha256: 'e2c54e5950079de0e0c150c2ca1749024be2483dab084b208960ed2fd4eeeea3' },
  { id: 'annotations-ru', file: 'annotations/ru.xml', url: `${CLDR_BASE}/common/annotations/ru.xml`, sha256: '8f5309995ab264d05bf908d9b11598c319fad63a07434fc8a41ef9bfa90b3c4f' },
  { id: 'annotations-derived-en', file: 'annotationsDerived/en.xml', url: `${CLDR_BASE}/common/annotationsDerived/en.xml`, sha256: 'c48c2da3c8b95d987ecaf2f5466723f22575df04d19280b1e98f42ab9496b975' },
  { id: 'annotations-derived-ru', file: 'annotationsDerived/ru.xml', url: `${CLDR_BASE}/common/annotationsDerived/ru.xml`, sha256: 'efffadf2dee09c8cf13aa985a16de26488bb198a905bb4619ef1be8107d1ff23' },
];
// IDs are stable slugs of the official Unicode emoji-test group names.
// Russian category labels are project translations; entry labels/keywords are CLDR.
export const GROUPS = [
  { id: 'smileys-emotion', en: 'Smileys & Emotion', ru: 'Смайлики и эмоции' },
  { id: 'people-body', en: 'People & Body', ru: 'Люди и тело' },
  { id: 'animals-nature', en: 'Animals & Nature', ru: 'Животные и природа' },
  { id: 'food-drink', en: 'Food & Drink', ru: 'Еда и напитки' },
  { id: 'travel-places', en: 'Travel & Places', ru: 'Путешествия и места' },
  { id: 'activities', en: 'Activities', ru: 'Занятия' },
  { id: 'objects', en: 'Objects', ru: 'Предметы' },
  { id: 'symbols', en: 'Symbols', ru: 'Символы' },
  { id: 'flags', en: 'Flags', ru: 'Флаги' },
];
export const GROUP_COUNTS = {
  'smileys-emotion': 156, 'people-body': 2049, 'animals-nature': 140,
  'food-drink': 129, 'travel-places': 215, activities: 84,
  objects: 250, symbols: 220, flags: 269,
};
const VERSION_COUNTS = {
  '0.6': 719, '0.7': 139, '1.0': 485, '2.0': 286, '3.0': 157, '4.0': 598,
  '5.0': 239, '11.0': 157, '12.0': 230, '12.1': 168, '13.0': 117, '13.1': 217,
};
const LICENSE = {
  spdx: 'Unicode-DFS-2016',
  copyright: 'Copyright © 1991-2020 Unicode, Inc. All rights reserved.',
  url: `${CLDR_BASE}/unicode-license.txt`,
  termsUrl: 'https://www.unicode.org/terms_of_use.html',
};
const hash = text => createHash('sha256').update(text).digest('hex');
const emojiKey = text => text.replace(/\uFE0F/gu, '');

// Keep this deterministic normalization in sync with the small runtime module.
// Preserve Cyrillic й and emoji selectors/keycap marks; strip linguistic accents.
export function normalizeKeywords(text) {
  return String(text ?? '').toLowerCase().replace(/ё/gu, 'е').normalize('NFKD')
    .replace(/и\u0306/gu, 'й')
    .replace(/\p{M}/gu, mark => /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u20E3]/u.test(mark) ? mark : '')
    .replace(/\s+/gu, ' ').trim();
}

function decodeXml(text) {
  // Deliberately handles only XML's five predefined entities and numeric references.
  // No DTD loading or external entity expansion. Unknown entities are rejected.
  return text.replace(/&([^;]*);/gu, (entity, value) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, value)) return named[value];
    if (/^#(?:x[0-9a-f]+|[0-9]+)$/iu.test(value)) {
      const hex = value[1].toLowerCase() === 'x';
      const cp = Number.parseInt(value.slice(hex ? 2 : 1), hex ? 16 : 10);
      assert(cp > 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF), `Bad XML code point ${entity}`);
      return String.fromCodePoint(cp);
    }
    throw new Error(`Unknown XML entity ${entity}`);
  });
}

export function parseAnnotations(xml, language, into = new Map()) {
  assert(xml.includes(`<language type="${language}"/>`), `Wrong CLDR locale, expected ${language}`);
  const body = xml.replace(/<!--[\s\S]*?-->/gu, '');
  const container = body.match(/<annotations>([\s\S]*?)<\/annotations>/u);
  assert(container, 'Missing CLDR annotations');
  let count = 0;
  const residual = container[1].replace(/<annotation\b([^>]*?)>([^<]*)<\/annotation>/gu, (_, rawAttrs, rawText) => {
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([A-Za-z][A-Za-z0-9_-]*)="([^"]*)"/gu)].map(m => [m[1], decodeXml(m[2])]));
    assert(attrs.cp, 'Missing annotation cp attribute');
    assert(!attrs.type || attrs.type === 'tts', `Unexpected annotation type ${attrs.type}`);
    const key = emojiKey(attrs.cp);
    const text = decodeXml(rawText).trim();
    assert(text && !/[↑∅]/u.test(text), `Unresolved CLDR annotation for ${attrs.cp}`);
    const entry = into.get(key) ?? {};
    const field = attrs.type === 'tts' ? 'name' : 'keywords';
    assert(!Object.hasOwn(entry, field), `Duplicate ${language} ${field} annotation for ${attrs.cp}`);
    entry[field] = text;
    into.set(key, entry);
    count++;
    return '';
  });
  assert(!residual.trim(), 'Unsupported CLDR annotation XML');
  assert(count > 1000, 'Unexpectedly small CLDR annotation file');
  return into;
}

export function parseEmojiTest(text) {
  assert(/^# Version: 13\.1$/mu.test(text), 'Unexpected Emoji source version');
  const groupByName = new Map(GROUPS.map(g => [g.en, g.id]));
  const entries = [], groupCounts = Object.fromEntries(GROUPS.map(g => [g.id, 0])), versionCounts = {};
  let group, componentCount = 0;
  for (const line of text.split(/\r?\n/u)) {
    if (line.startsWith('# group: ')) {
      const officialName = line.slice(9).trim();
      assert(groupByName.has(officialName) || officialName === 'Component', `Unknown group ${officialName}`);
      group = groupByName.get(officialName);
      continue;
    }
    if (!line.trim() || line.startsWith('#')) continue;
    const match = line.match(/^([0-9A-F ]+)\s*;\s*(fully-qualified|minimally-qualified|unqualified|component)\s*#\s*(\S+)\s+E(\d+\.\d+)\s+(.+)$/u);
    assert(match, `Unrecognized emoji-test row: ${line}`);
    if (match[2] === 'component') { componentCount++; continue; }
    if (match[2] !== 'fully-qualified') continue;
    assert(group, 'Fully-qualified entry without a populated group');
    assert(Number(match[4]) <= Number(EMOJI_VERSION), `Emoji above version ceiling: ${line}`);
    const emoji = String.fromCodePoint(...match[1].trim().split(/\s+/u).map(cp => Number.parseInt(cp, 16)));
    assert.equal(emoji, match[3], 'Source glyph does not match its Unicode sequence');
    entries.push({ emoji, group });
    groupCounts[group]++;
    versionCounts[match[4]] = (versionCounts[match[4]] ?? 0) + 1;
  }
  assert.equal(entries.length, EXPECTED_COUNT, 'Unexpected fully-qualified count');
  assert.equal(componentCount, 9, 'Unexpected standalone component count');
  assert.deepEqual(groupCounts, GROUP_COUNTS);
  assert.deepEqual(versionCounts, VERSION_COUNTS);
  assert.equal(hash(entries.map(e => e.emoji).join('\n')), SEQUENCE_SHA256, 'Unexpected RGI Unicode sequences or order');
  return { entries, groupCounts, versionCounts, componentCount };
}

export async function loadSources(sourceDir) {
  const rows = await Promise.all(SOURCES.map(async source => {
    let bytes;
    if (sourceDir) {
      bytes = await readFile(path.join(sourceDir, source.file));
    } else {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
      assert(response.ok, `${response.status} fetching ${source.url}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    assert(bytes.length < 5 * 1024 * 1024, `Oversized source ${source.id}`);
    assert.equal(hash(bytes), source.sha256, `SHA-256 mismatch for ${source.id}; do not silently accept changed sources`);
    return [source.id, new TextDecoder('utf-8', { fatal: true }).decode(bytes)];
  }));
  return Object.fromEntries(rows);
}

export function generateData(sources) {
  const parsed = parseEmojiTest(sources['emoji-test']);
  const en = parseAnnotations(sources['annotations-en'], 'en');
  parseAnnotations(sources['annotations-derived-en'], 'en', en);
  const ru = parseAnnotations(sources['annotations-ru'], 'ru');
  parseAnnotations(sources['annotations-derived-ru'], 'ru', ru);
  const entries = parsed.entries.map(({ emoji, group }) => {
    const english = en.get(emojiKey(emoji)), russian = ru.get(emojiKey(emoji));
    for (const [language, annotation] of [['en', english], ['ru', russian]])
      assert(annotation?.name && annotation?.keywords, `Missing ${language} CLDR name/keywords for ${emoji}`);
    const phrases = [...new Set([
      english.name, russian.name, ...english.keywords.split('|'), ...russian.keywords.split('|'),
    ].map(normalizeKeywords))];
    return { emoji, en: english.name, ru: russian.name, keywords: phrases.join(' '), group };
  });
  const metadata = {
    emojiVersion: EMOJI_VERSION, cldrVersion: CLDR_VERSION, cldrCommit: CLDR_COMMIT,
    count: entries.length, qualification: 'fully-qualified', maxEmojiVersion: EMOJI_VERSION,
    excludedStandaloneComponents: parsed.componentCount,
    groupCounts: parsed.groupCounts, emojiVersionCounts: parsed.versionCounts,
    sequenceSha256: SEQUENCE_SHA256,
    contentSha256: hash(JSON.stringify({ groups: GROUPS, entries })),
    sources: SOURCES, license: LICENSE,
  };
  const data = { metadata, groups: GROUPS, entries };
  validateData(data);
  return data;
}

export function validateData(data) {
  assert(data && typeof data === 'object', 'Missing catalog data');
  const { metadata, groups, entries } = data;
  assert.equal(metadata.emojiVersion, EMOJI_VERSION);
  assert.equal(metadata.maxEmojiVersion, EMOJI_VERSION);
  assert.equal(metadata.cldrVersion, CLDR_VERSION);
  assert.equal(metadata.cldrCommit, CLDR_COMMIT);
  assert.equal(metadata.qualification, 'fully-qualified');
  assert.equal(metadata.excludedStandaloneComponents, 9);
  assert.deepEqual(metadata.sources, SOURCES);
  assert.deepEqual(metadata.license, LICENSE);
  assert.deepEqual(metadata.emojiVersionCounts, VERSION_COUNTS);
  assert.deepEqual(metadata.groupCounts, GROUP_COUNTS);
  assert.deepEqual(groups, GROUPS);
  assert.equal(metadata.count, EXPECTED_COUNT);
  assert.equal(entries.length, EXPECTED_COUNT);
  const seen = new Set(), counts = Object.fromEntries(GROUPS.map(g => [g.id, 0]));
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry), ['emoji', 'en', 'ru', 'keywords', 'group']);
    assert(typeof entry.emoji === 'string' && entry.emoji && !seen.has(entry.emoji), 'Invalid or duplicate emoji');
    // Regional indicators, ZWJ, presentation selectors, keycaps and subdivision tags
    // are essential Unicode sequence parts, not assets or stand-alone components.
    assert(/^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}0-9#*\u200D\uFE0F\u20E3\u{E0020}-\u{E007F}]+$/u.test(entry.emoji), `Non-emoji Unicode sequence ${entry.emoji}`);
    assert(typeof entry.en === 'string' && /[a-z]/iu.test(entry.en), 'Missing English label');
    // CLDR's Russian names for optical discs are intentionally "CD" and "DVD".
    assert(typeof entry.ru === 'string' && entry.ru.trim(), 'Missing Russian label');
    assert(typeof entry.keywords === 'string' && entry.keywords === normalizeKeywords(entry.keywords), 'Non-normalized keywords');
    assert(/[а-яё]/iu.test(entry.keywords), 'Missing Russian searchable text');
    assert(entry.keywords.includes(normalizeKeywords(entry.en)) && entry.keywords.includes(normalizeKeywords(entry.ru)), 'Names missing from keywords');
    assert(Object.hasOwn(counts, entry.group), `Unknown category ${entry.group}`);
    counts[entry.group]++;
    seen.add(entry.emoji);
  }
  assert.deepEqual(counts, GROUP_COUNTS);
  assert.equal(metadata.sequenceSha256, SEQUENCE_SHA256);
  assert.equal(hash(entries.map(e => e.emoji).join('\n')), SEQUENCE_SHA256, 'Catalog differs from final Emoji 13.1 RGI set');
  assert.equal(metadata.contentSha256, hash(JSON.stringify({ groups, entries })), 'Generated content fingerprint mismatch');
  return data;
}

export function serializeData(data) {
  // Stable UTF-8/LF with one readable entry per line, no timestamps or host paths.
  return '{\n  "metadata": ' + JSON.stringify(data.metadata, null, 2).replaceAll('\n', '\n  ')
    + ',\n  "groups": ' + JSON.stringify(data.groups, null, 2).replaceAll('\n', '\n  ')
    + ',\n  "entries": [\n' + data.entries.map(row => '    ' + JSON.stringify(row)).join(',\n') + '\n  ]\n}\n';
}

async function main(args) {
  let check = false, verify = false, sourceDir;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--verify') verify = true;
    else if (args[i] === '--source-dir' && args[i + 1] && !args[i + 1].startsWith('--')) sourceDir = path.resolve(args[++i]);
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  assert(!(check && (verify || sourceDir)), '--check is offline; cannot combine with --verify/--source-dir');
  if (check) {
    const existing = await readFile(OUTPUT, 'utf8');
    const data = validateData(JSON.parse(existing));
    assert.equal(existing, serializeData(data), 'Generated JSON serialization is not canonical');
    console.log(`Validated ${data.entries.length} Emoji ${EMOJI_VERSION} entries, ${data.groups.length} groups (offline).`);
    return;
  }
  const generated = serializeData(generateData(await loadSources(sourceDir)));
  // Observe any existing output before overwriting; fetch/parse/validate finishes first.
  let previous;
  try { previous = await readFile(OUTPUT, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (verify) {
    assert.equal(previous, generated, 'Checked-in JSON differs from the pinned upstream sources');
    console.log(`Verified byte-for-byte regeneration of ${EXPECTED_COUNT} Emoji ${EMOJI_VERSION} entries.`);
  } else {
    if (previous !== generated) await writeFile(OUTPUT, generated, 'utf8');
    console.log(`Generated ${EXPECTED_COUNT} Emoji ${EMOJI_VERSION} entries in ${fileURLToPath(OUTPUT)} (${Buffer.byteLength(generated)} bytes).`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
