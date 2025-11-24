/**
 * @fileoverview Filter serialization utilities for URL state persistence.
 *
 * This module provides pure functions for serializing and deserializing filter states
 * to/from compressed URL-safe strings. All serialization uses compression for consistency.
 *
 * This is a framework-agnostic module with no browser or framework dependencies.
 * For browser-specific URL manipulation, use utilities from @better-tables/ui.
 *
 * Uses compression utilities from ./compression for encoding/decoding.
 *
 * @module utils/filter-serialization
 */

import type { FilterState } from '../types/filter';
import { compressAndEncode, decompressAndDecode } from './compression';

/**
 * Serialize filters to URL-safe compressed string.
 *
 * Converts filter states to a compact, URL-safe representation using compression.
 * Always compresses data for consistency and optimal URL length.
 *
 * @param filters - Array of filter states to serialize
 * @returns Compressed URL-safe string (prefixed with "c:")
 *
 * @example
 * ```typescript
 * const filters: FilterState[] = [
 *   { columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }
 * ];
 *
 * const serialized = serializeFiltersToURL(filters);
 * // Returns: "c:..." (compressed string)
 * ```
 */
export function serializeFiltersToURL(filters: FilterState[]): string {
  return compressAndEncode(filters);
}

/**
 * Deserialize filters from URL-safe compressed string.
 *
 * Converts a compressed URL-safe string back to filter states.
 * Only supports compressed format (prefixed with "c:").
 *
 * @param urlString - Compressed URL-safe encoded string containing filters (must start with "c:")
 * @returns Array of deserialized filter states
 * @throws {Error} If the string cannot be deserialized or is not in compressed format
 *
 * @example
 * ```typescript
 * const urlString = 'c:...'; // Compressed string
 *
 * try {
 *   const filters = deserializeFiltersFromURL(urlString);
 *   console.log(filters); // [{ columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }]
 * } catch (error) {
 *   console.error('Failed to deserialize filters:', error);
 * }
 * ```
 */
export function deserializeFiltersFromURL(urlString: string): FilterState[] {
  if (!urlString || urlString.trim() === '') {
    throw new Error('Empty URL string');
  }

  // Must be compressed format (starts with "c:")
  if (!urlString.startsWith('c:')) {
    throw new Error('Invalid format: only compressed format (prefixed with "c:") is supported');
  }

  try {
    const decoded = decompressAndDecode<FilterState[]>(urlString);
    if (!decoded) {
      throw new Error('Failed to decompress data');
    }

    if (!Array.isArray(decoded)) {
      throw new Error('Invalid filter data format: expected array');
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to deserialize filters from URL');
  }
}
