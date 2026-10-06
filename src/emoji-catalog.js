/**
 * Local Unicode Emoji 13.1 RGI catalog, rendered as SYSTEM/native text glyphs.
 * Names/keywords: pinned Unicode CLDR 38.1, including annotationsDerived.
 * Generated source URLs, SHA-256 fingerprints and license: EMOJI_SOURCE.
 * Copyright 1991-2020 Unicode, Inc. Data license: Unicode-DFS-2016.
 * Regenerate explicitly with scripts/build-emoji-data.mjs; no runtime network.
 *
 * The catalog is a picker/search policy, NOT validation for saved/manual emojis.
 * Native rendering depends on the OS; keep standard flags and ZWJ entries even
 * when a platform cannot render them as one glyph. No image/font fallback.
 */
import data from './emoji-data.json' with { type: 'json' };

export const EMOJI_VERSION = '13.1';
export const EMOJI = Object.freeze(data.entries.map(entry => Object.freeze(entry)));
export const EMOJI_GROUPS = Object.freeze(data.groups.map(group => Object.freeze(group)));

function freezeMetadata(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeMetadata(child);
    Object.freeze(value);
  }
  return value;
}
export const EMOJI_SOURCE = freezeMetadata(data.metadata);

/** Case/Ё/linguistic-accent/whitespace folding, preserving emoji sequence parts. */
export function normalizeSearch(text) {
  return String(text ?? '').toLowerCase().replace(/ё/gu, 'е').normalize('NFKD')
    .replace(/и\u0306/gu, 'й')
    .replace(/\p{M}/gu, mark => /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u20E3]/u.test(mark) ? mark : '')
    .replace(/\s+/gu, ' ').trim();
}

const literalKey = text => text.replace(/\uFE0F/gu, '');
const index = EMOJI.map(entry => ({ entry, literal: literalKey(entry.emoji) }));

/**
 * All query tokens must match combined RU/EN names/CLDR keywords or literal emoji.
 * Matches retain official Unicode order; no result limit and no platform hiding.
 * Empty query returns the entire requested category; unknown category returns [].
 * Literal lookup accepts both fully-qualified and selector-less pasted emoji.
 * Always returns a fresh array; entries and exported catalog data are read-only.
 */
export function searchEmoji(query, group = 'all') {
  const normalized = normalizeSearch(query);
  const tokens = normalized ? normalized.split(' ').map(text => ({ text, literal: literalKey(text) })) : [];
  return index.filter(({ entry, literal }) => (group === 'all' || entry.group === group)
    && tokens.every(token => entry.keywords.includes(token.text)
      || (token.literal.length > 0 && literal.includes(token.literal))))
    .map(({ entry }) => entry);
}
