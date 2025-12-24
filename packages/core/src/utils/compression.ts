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
 * Recursively rename object keys using the provided key map.
 *
 * Traverses nested objects and arrays to apply key transformations
 * throughout the entire data structure.
 *
 * @param obj - Object to transform
 * @param keyMap - Mapping of old keys to new keys
 * @returns Object with renamed keys
 */
export function renameKeys(obj: unknown, keyMap: Record<string, string>): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => renameKeys(item, keyMap));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = keyMap[key] ?? key;
    result[newKey] = renameKeys(value, keyMap);
  }

  return result;
}

/**
 * Compress and encode data using key shortening and lz-string compression.
 *
 * This is the single source of truth for compression in the Better Tables
 * ecosystem. It applies key shortening first, then lz-string compression
 * (which is already URL-safe). Always returns compressed data with "c:" prefix.
 *
 * @param data - Data to compress and encode
 * @returns Compressed and encoded string with "c:" prefix, or empty string on failure
 *
 * @example
 * ```typescript
 * const filters = [{ columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }];
 * const compressed = compressAndEncode(filters);
 * // Returns: "c:..." (lz-string compressed with key shortening)
 * ```
 */
export function compressAndEncode(data: unknown): string {
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

    return `c:${compressed}`;
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
 * @param encoded - Encoded string (must start with "c:" prefix)
 * @returns Decoded data (parsed from JSON) or null if decompression fails
 *
 * @example
 * ```typescript
 * const decoded = decompressAndDecode<FilterState[]>('c:...');
 * // Returns: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }]
 * ```
 */
export function decompressAndDecode<T = unknown>(encoded: string): T | null {
  try {
    // Must start with "c:" prefix
    if (!encoded.startsWith('c:')) {
      return null;
    }

    const compressed = encoded.slice(2);
    // Decompress with lz-string
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decompressed) {
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
