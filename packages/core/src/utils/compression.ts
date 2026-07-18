/**
 * @fileoverview Compression utilities for URL serialization.
 *
 * This module provides the single source of truth for compression and encoding
 * of data structures for URL serialization. It uses a hybrid approach:
 * 1. Key shortening (columnId → c, type → t, operator → o, values → v, etc.)
 * 2. lz-string compression for actual data compression
 *
 * Compressed data is prefixed with "c:" to distinguish from uncompressed data.
 *
 * @module utils/compression
 */

import LZString from 'lz-string';

/**
 * Key mapping for compression optimization.
 *
 * Maps long property names to short abbreviations to reduce
 * serialized data size while maintaining readability.
 *
 * Includes all keys used across filter and sorting state serialization.
 */
export const COMPRESSION_KEY_MAP: Record<string, string> = {
  columnId: 'c',
  type: 't',
  operator: 'o',
  values: 'v',
  includeNull: 'n',
  meta: 'm',
  direction: 'd', // For sorting state
  kind: 'k', // For FilterGroupNode (contract v2)
  logic: 'l', // For FilterGroupNode (contract v2)
  children: 'h', // For FilterGroupNode ('g' would read as "group"; 'h' avoids any future group -> g)
  id: 'i', // For BaseFilterState.id (plan 031 Step 3, finding 2) -- optional, so absent on most filters
};

/**
 * Reverse key mapping for decompression.
 *
 * Maps compressed abbreviations back to full property names
 * during deserialization.
 *
 * Auto-generated from COMPRESSION_KEY_MAP.
 */
export const DECOMPRESSION_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COMPRESSION_KEY_MAP).map(([long, short]) => [short, long])
);

/**
 * Keys whose VALUE is user-authored data, never a structural field to
 * rename into. `renameKeys` still renames these keys themselves (e.g.
 * `meta` -> `m`, `values` -> `v` on compress; `m` -> `meta`, `v` -> `values`
 * on decompress), but must never descend into what they CONTAIN.
 *
 * This is CORE-06: blind recursion into `meta`/`values` silently mangles
 * user data whose own keys happen to collide with a short code -- e.g. a
 * `meta` object with a key literally named `kind`, `c`, or `children` would
 * be rewritten on decompression, or a JSON filter's `values` (which may hold
 * arbitrary objects, `values: (object | string)[]`) could have its own keys
 * renamed. Adding `kind`/`logic`/`children` to the key map (above) widens
 * this collision surface, which is why the wire-format version bump is the
 * moment to fix it (`plans/design/core-contract-v2.md` §1.3).
 *
 * Includes both the long and short spellings so the same denylist works on
 * both the compress pass (keys are long: `meta`, `values`) and the
 * decompress pass (keys are already short: `m`, `v`).
 */
const OPAQUE_VALUE_KEYS = new Set(['meta', 'm', 'values', 'v']);

/**
 * Fail-closed bounds for server-side URL decompression (plan 051, SEC-05).
 * Chosen generously so bookmarked table state (large filter trees, many
 * columns) never hits them in normal use.
 */
export const MAX_COMPRESSED_ENCODED_LENGTH = 65_536; // 64 KiB after the `c:` prefix
export const MAX_DECOMPRESSED_JSON_LENGTH = 512_000; // 512 KiB decompressed JSON
export const MAX_RENAME_KEYS_DEPTH = 64; // nested FilterGroupNode depth

/**
 * Recursively rename object keys using the provided key map.
 *
 * Traverses nested objects and arrays to apply key transformations
 * throughout the entire data structure -- except the VALUE of a `meta` or
 * `values` key, which is user-authored data and is passed through
 * untouched (CORE-06, see {@link OPAQUE_VALUE_KEYS}). The key itself is
 * still renamed; only descent into its contents is skipped.
 *
 * @param obj - Object to transform
 * @param keyMap - Mapping of old keys to new keys
 * @returns Object with renamed keys
 */
export function renameKeys(
  obj: unknown,
  keyMap: Record<string, string>,
  depth = 0,
  maxDepth = MAX_RENAME_KEYS_DEPTH
): unknown {
  if (depth > maxDepth) {
    throw new RangeError('renameKeys depth limit exceeded');
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => renameKeys(item, keyMap, depth + 1, maxDepth));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = keyMap[key] ?? key;
    result[newKey] = OPAQUE_VALUE_KEYS.has(key)
      ? value
      : renameKeys(value, keyMap, depth + 1, maxDepth);
  }

  return result;
}

/**
 * Compress and encode data using key shortening and lz-string compression.
 *
 * This is the single source of truth for compression in the Better Tables
 * ecosystem. It applies key shortening first, then lz-string compression
 * (which is already URL-safe). Always returns compressed data prefixed with
 * `prefix` (default `"c:"`).
 *
 * @param data - Data to compress and encode
 * @param prefix - Prefix to stamp on the returned string (default `"c:"`).
 * Plan 015's `c2:` filter wire format is the one caller that overrides this
 * -- every other caller (sorting, column visibility, column order) keeps the
 * default so their format is unaffected by the filter-group version bump.
 * @returns Compressed and encoded string with the given prefix, or empty
 * string on failure
 *
 * @example
 * ```typescript
 * const filters = [{ columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }];
 * const compressed = compressAndEncode(filters);
 * // Returns: "c:..." (lz-string compressed with key shortening)
 * ```
 */
export function compressAndEncode(data: unknown, prefix = 'c:'): string {
  try {
    const json = JSON.stringify(data);

    // Apply key shortening
    const parsed = JSON.parse(json);
    const shortened = renameKeys(parsed, COMPRESSION_KEY_MAP);
    const shortenedJson = JSON.stringify(shortened);

    // Apply lz-string compression (URL-safe encoding)
    const compressed = LZString.compressToEncodedURIComponent(shortenedJson);
    if (!compressed) {
      // Compression failed, return empty string
      return '';
    }

    return `${prefix}${compressed}`;
  } catch {
    // Fallback to empty string if compression fails
    return '';
  }
}

/**
 * Decompress and decode data that was compressed with compressAndEncode.
 *
 * This is the single source of truth for decompression in the Better Tables
 * ecosystem. It decompresses lz-string compressed data and restores key names.
 *
 * @param encoded - Encoded string (must start with `prefix`)
 * @param prefix - Prefix `encoded` must start with (default `"c:"`), stripped
 * before decompression. See {@link compressAndEncode}'s `prefix` doc.
 * @returns Decoded data (parsed from JSON) or null if decompression fails
 *
 * @example
 * ```typescript
 * const decoded = decompressAndDecode<FilterState[]>('c:...');
 * // Returns: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }]
 * ```
 */
export function decompressAndDecode<T = unknown>(encoded: string, prefix = 'c:'): T | null {
  try {
    // Must start with the expected prefix
    if (!encoded.startsWith(prefix)) {
      return null;
    }

    const compressed = encoded.slice(prefix.length);
    if (compressed.length > MAX_COMPRESSED_ENCODED_LENGTH) {
      return null;
    }

    // Decompress with lz-string
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decompressed) {
      return null;
    }
    if (decompressed.length > MAX_DECOMPRESSED_JSON_LENGTH) {
      return null;
    }

    // Restore keys
    const parsed = JSON.parse(decompressed);
    const restored = renameKeys(parsed, DECOMPRESSION_KEY_MAP);
    return restored as T;
  } catch {
    return null;
  }
}
