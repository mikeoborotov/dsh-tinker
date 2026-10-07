import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import data from '../src/emoji-data.json' with { type: 'json' };
import { EMOJI_VERSION, EMOJI, EMOJI_GROUPS, EMOJI_SOURCE, searchEmoji, normalizeSearch } from '../src/emoji-catalog.js';
import { validateAppearance, createPreferences } from '../src/store.js';
import {
  validateData, serializeData, normalizeKeywords, loadSources, parseEmojiTest, parseAnnotations,
} from '../scripts/build-emoji-data.mjs';

const expectedCounts = {
  'smileys-emotion': 156, 'people-body': 2049, 'animals-nature': 140,
  'food-drink': 129, 'travel-places': 215, activities: 84,
  objects: 250, symbols: 220, flags: 269,
};
const known = new Set(EMOJI.map(entry => entry.emoji));
const matches = (query, emoji, group) => assert(searchEmoji(query, group).some(entry => entry.emoji === emoji), `${JSON.stringify(query)} should find ${emoji}`);
const newer = ['🫠', '🫨', '🪽', '🙂‍↔️', '🙂‍↕️', '🐦‍🔥', '🍋‍🟩', '🫩', '🪾'];

test('complete final Emoji 13.1 fully-qualified catalog with exact sequence fingerprint', () => {
  assert.equal(EMOJI_VERSION, '13.1');
  assert.equal(EMOJI.length, 3512);
  assert.equal(known.size, EMOJI.length);
  assert.equal(EMOJI_GROUPS.length, 9);
  assert.deepEqual(Object.fromEntries(EMOJI_GROUPS.map(g => [g.id, EMOJI.filter(e => e.group === g.id).length])), expectedCounts);
  const fingerprint = createHash('sha256').update(EMOJI.map(e => e.emoji).join('\n')).digest('hex');
  assert.equal(fingerprint, 'c224e70fa1fb6a689c76b34af99839594a86e073a9487fbab5a9130e6c6d5788');
  assert.equal(EMOJI_SOURCE.qualification, 'fully-qualified');
  assert.equal(EMOJI_SOURCE.maxEmojiVersion, '13.1');
  assert.equal(EMOJI_SOURCE.emojiVersionCounts['13.1'], 217);
  assert.equal(Object.values(EMOJI_SOURCE.emojiVersionCounts).reduce((a, b) => a + b, 0), EMOJI.length);
  assert(Object.keys(EMOJI_SOURCE.emojiVersionCounts).every(v => Number(v) <= 13.1));
});

test('Unicode-only standard sequences include tones, professions, families, keycaps and flags', () => {
  for (const emoji of ['😀', '🚀', '🦔', '🫖', '❤️‍🔥', '❤️‍🩹', '😮‍💨', '😵‍💫', '😶‍🌫️', '🧔‍♀️', '👩🏽‍💻', '👨‍👩‍👧‍👦', '1️⃣', '#️⃣', '🇷🇺', '🇺🇸', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'])
    assert(known.has(emoji), `Expected fully-qualified standard emoji ${emoji}`);
  assert(known.has('❤️'));
  assert(!known.has('❤'), 'Unqualified forms must not duplicate fully-qualified entries');
  for (const component of ['🏻', '🏼', '🏽', '🏾', '🏿', '🦰', '🦱', '🦳', '🦲']) assert(!known.has(component));
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const entry of EMOJI) {
    assert.deepEqual(Object.keys(entry), ['emoji', 'en', 'ru', 'keywords', 'group']);
    assert.equal([...segmenter.segment(entry.emoji)].length, 1, `Not one Unicode emoji grapheme: ${entry.emoji}`);
    assert(/^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}0-9#*\u200D\uFE0F\u20E3\u{E0020}-\u{E007F}]+$/u.test(entry.emoji));
    assert(!/https?:|<svg|data:|twemoji/iu.test(entry.emoji));
  }
});

test('all entries have pinned bilingual CLDR labels and pre-normalized searchable keywords', () => {
  assert.equal(EMOJI_SOURCE.cldrVersion, '38.1');
  assert.equal(EMOJI_SOURCE.cldrCommit, '367b79b4a86a9cb12314158897d950268dc77b02');
  assert.equal(EMOJI_SOURCE.sources.length, 5);
  assert.equal(EMOJI_SOURCE.license.spdx, 'Unicode-DFS-2016');
  for (const source of EMOJI_SOURCE.sources) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/u);
    assert(source.url.startsWith('https://unicode.org/') || source.url.startsWith(`https://raw.githubusercontent.com/unicode-org/cldr/${EMOJI_SOURCE.cldrCommit}/`));
  }
  for (const entry of EMOJI) {
    assert(entry.en.trim() && entry.ru.trim());
    assert(/[а-яё]/iu.test(entry.keywords));
    assert.equal(entry.keywords, normalizeSearch(entry.keywords));
    assert.equal(entry.keywords, normalizeKeywords(entry.keywords));
    assert(entry.keywords.includes(normalizeSearch(entry.en)));
    assert(entry.keywords.includes(normalizeSearch(entry.ru)));
  }
  assert.equal(EMOJI.find(e => e.emoji === '🚀').en, 'rocket');
  assert.equal(EMOJI.find(e => e.emoji === '🚀').ru, 'ракета');
  // Official Russian CLDR names may be acronyms; do not fabricate translations.
  assert.equal(EMOJI.find(e => e.emoji === '💿').ru, 'CD');
});

test('search finds EN/RU names, synonyms and derived annotations across the whole catalog', () => {
  for (const [query, emoji] of [
    ['rocket', '🚀'], ['РАКЕТА', '🚀'], ['space', '🚀'], ['космос', '🚀'],
    ['computer', '💻'], ['компьютер', '💻'], ['hedgehog', '🦔'], ['колючки', '🦔'],
    ['file', '📁'], ['документы', '📁'], ['tea', '🫖'], ['чайник', '🫖'],
    ['developer woman medium skin', '👩🏽‍💻'], ['разработчик женщина средний', '👩🏽‍💻'],
    ['Russia', '🇷🇺'], ['РОССИЯ', '🇷🇺'], ['United States', '🇺🇸'], ['Соединённые Штаты', '🇺🇸'],
    ['heart fire', '❤️‍🔥'], ['пламенное сердце', '❤️‍🔥'],
  ]) matches(query, emoji);
  assert(EMOJI.findIndex(entry => entry.emoji === '🚀') > 16, 'Search must not use a small suggestion list');
});

test('case, Ё, composed/decomposed accents and varied whitespace normalize consistently', () => {
  assert.equal(normalizeSearch(' \t ЁЖ  CAFÉ\u00A0  РАКЕТА \n'), 'еж cafe ракета');
  assert.equal(normalizeSearch('Е\u0308Ж CAFE\u0301'), 'еж cafe');
  assert.equal(normalizeSearch('Й ЧАЙ И\u0306'), 'й чай й', 'Cyrillic й is a distinct letter, not a removable accent');
  assert.equal(normalizeSearch(null), '');
  assert.equal(normalizeSearch(undefined), '');
  assert.equal(normalizeSearch(123), '123');
  for (const value of ['ЁЖ', 'Е\u0308Ж', ' CAFÉ ', 'Й', '❤️', '1️⃣', '👩🏽‍💻', '🇺🇸'])
    assert.equal(normalizeSearch(value), normalizeKeywords(value));
  matches('ЁЖ', '🦔');
  matches('Е\u0308Ж', '🦔');
  matches('ЁЛКА', '🎄');
  matches('  ROCKÉT\t', '🚀');
  matches('WOMAN\tDEVELOPER\nMEDIUM', '👩🏽‍💻');
});

test('literal search preserves ZWJ, modifiers, flags, keycaps and optional presentation selectors', () => {
  for (const emoji of ['🚀', '❤️', '❤️‍🔥', '👩🏽‍💻', '👨‍👩‍👧‍👦', '🇺🇸', '1️⃣', '#️⃣']) {
    assert.equal(normalizeSearch(emoji), emoji);
    matches(emoji, emoji);
    matches(emoji.replace(/\uFE0F/gu, ''), emoji);
  }
  assert.deepEqual(searchEmoji('🇺🇸').map(e => e.emoji), ['🇺🇸']);
  assert.deepEqual(searchEmoji('👩🏽‍💻').map(e => e.emoji), ['👩🏽‍💻']);
  assert.deepEqual(searchEmoji('1⃣').map(e => e.emoji), ['1️⃣']);
  assert.deepEqual(searchEmoji('\uFE0F'), [], 'A selector by itself is not a query matching everything');
});

test('category filters and empty searches do not truncate or reorder results', () => {
  assert.deepEqual(searchEmoji(''), EMOJI);
  assert.deepEqual(searchEmoji(' \t\n '), EMOJI);
  assert.notEqual(searchEmoji(''), EMOJI, 'Callers receive a fresh result array');
  for (const group of EMOJI_GROUPS) {
    assert.deepEqual(searchEmoji('', group.id), EMOJI.filter(e => e.group === group.id));
    assert.equal(searchEmoji('', group.id).length, expectedCounts[group.id]);
  }
  matches('space', '🚀', 'travel-places');
  assert.deepEqual(searchEmoji('🚀', 'objects'), []);
  matches('developer', '👩🏽‍💻', 'people-body');
  assert(searchEmoji('developer', 'people-body').every(entry => entry.group === 'people-body'));
  assert.deepEqual(searchEmoji('rocket', 'unknown-category'), []);
  assert.deepEqual(searchEmoji('', 'unknown-category'), []);
  assert.deepEqual(searchEmoji('definitely-not-an-emoji-zzzz'), []);
  assert.deepEqual(searchEmoji('rocket hedgehog'), []);
});

test('newer/experimental emojis are absent but saved/manual emojis remain unconstrained', () => {
  for (const emoji of newer) {
    assert(!known.has(emoji), `Emoji newer than 13.1 must be excluded: ${emoji}`);
    assert.deepEqual(searchEmoji(emoji), []);
    assert.deepEqual(validateAppearance({ kind: 'emoji', emoji }, ['folder']), { kind: 'emoji', emoji });
  }
  const storage = new Map();
  const preferences = createPreferences({
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }, ['folder']);
  preferences.save('workspace', { kind: 'emoji', emoji: '🫠' });
  assert.equal(preferences.appearance('workspace').emoji, '🫠');
});

test('catalog and provenance cannot be mutated by search callers', () => {
  assert(Object.isFrozen(EMOJI));
  assert(Object.isFrozen(EMOJI_GROUPS));
  assert(Object.isFrozen(EMOJI_SOURCE.sources));
  assert.throws(() => { EMOJI[0].emoji = '🫠'; }, TypeError);
  assert.throws(() => { EMOJI_GROUPS[0].id = 'other'; }, TypeError);
  assert.throws(() => { EMOJI_SOURCE.sources[0].sha256 = 'bad'; }, TypeError);
  searchEmoji('rocket').pop();
  matches('rocket', '🚀');
});

test('checked-in data validates offline and serialization is reproducible', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Network forbidden in offline catalog validation'); });
  assert.equal(validateData(data), data);
  const existing = await readFile(new URL('../src/emoji-data.json', import.meta.url), 'utf8');
  assert.equal(serializeData(data), existing);
  const offline = await import('../src/emoji-catalog.js?offline-validation');
  assert.equal(offline.EMOJI.length, 3512);
  assert(offline.searchEmoji('ракета').some(entry => entry.emoji === '🚀'));
});

test('validation rejects dataset tampering, missing bilingual labels and version changes', () => {
  for (const mutate of [
    d => { d.metadata.emojiVersion = '14.0'; },
    d => { d.metadata.maxEmojiVersion = '15.0'; },
    d => { d.metadata.sources[0].sha256 = '0'.repeat(64); },
    d => { d.entries.pop(); },
    d => { d.entries[0].emoji = '🫠'; },
    d => { d.entries[0].ru = ''; },
    d => { d.entries[0].keywords = 'NOT NORMALIZED'; },
    d => { d.entries[0].group = 'unknown-category'; },
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => validateData(changed));
  }
});

test('generator rejects newer upstream versions, bad glyphs and unknown XML entities', () => {
  assert.throws(() => parseEmojiTest('# Version: 14.0\n'), /source version/u);
  assert.throws(() => parseEmojiTest('# Version: 13.1\n# group: Smileys & Emotion\n1FAE0 ; fully-qualified # 🫠 E14.0 melting face\n'), /version ceiling/u);
  assert.throws(() => parseEmojiTest('# Version: 13.1\n# group: Smileys & Emotion\n1F600 ; fully-qualified # 🚀 E1.0 grinning face\n'), /glyph/u);
  assert.throws(() => parseAnnotations('<language type="ru"/><annotations><annotation cp="😀">&external;</annotation></annotations>', 'ru'), /Unknown XML entity/u);
  assert.throws(() => parseAnnotations('<language type="ru"/><annotations><annotation cp="😀">↑↑↑</annotation></annotations>', 'ru'), /Unresolved CLDR annotation/u);
});

test('generator checks pinned source hashes before accepting downloaded content', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode('unexpected upstream content').buffer,
  }));
  await assert.rejects(loadSources(), /SHA-256 mismatch/u);
});
