/**
 * @fileoverview Filter serialization utilities for URL state persistence.
 *
 * This module provides utilities for serializing and deserializing filter states
 * to/from URL parameters, enabling bookmarkable filter states and shareable URLs.
 *
 * @module utils/filter-serialization
 */

import type { ColumnType, FilterOperator } from '../types';
import type { FilterState } from '../types/filter';

/**
 * Options for URL serialization.
 *
 * Configures how filters are serialized to URL parameters,
 * including compression and metadata inclusion.
 *
 * @example
 * ```typescript
 * const options: URLSerializationOptions = {
 *   paramName: 'filters',
 *   compress: true,
 *   includeMeta: false,
 *   maxLength: 2000
 * };
 * ```
 */
export interface URLSerializationOptions {
  /** URL parameter name for filters */
  paramName?: string;
  /** Whether to compress the data */
  compress?: boolean;
  /** Whether to include metadata */
  includeMeta?: boolean;
  /** Maximum URL length (for compression threshold) */
  maxLength?: number;
}

/**
 * Result of URL serialization.
 *
 * Contains the serialized string along with metadata about
 * the serialization process.
 *
 * @example
 * ```typescript
 * const result: URLSerializationResult = {
 *   value: 'JTVCJTdCJTIyYyUyMiUzQSUyMnVzZXJuYW1lJTIyJTJDJTIydCUyMiUzQSUyMnRleHQlMjIlMkMlMjJvJTIyJTNBJTIyZXF1YWxzJTIyJTJDJTIydiUyMiUzQSU1QiUyMmpvaG4lMjIlNUQlN0QlNUQ',
 *   compressed: false,
 *   size: 151
 * };
 * ```
 */
export interface URLSerializationResult {
  /** The serialized string */
  value: string;
  /** Whether compression was applied */
  compressed: boolean;
  /** Size of the result */
  size: number;
}

// Default configuration constants
const DEFAULT_PARAM_NAME = 'filters';
const DEFAULT_MAX_LENGTH = 2000; // Conservative URL length limit

/**
 * Serialize filters to URL-safe string.
 *
 * Converts filter states to a compact, URL-safe representation
 * that can be stored in URL parameters for bookmarking and sharing.
 *
 * @param filters - Array of filter states to serialize
 * @param options - Serialization options
 * @returns Serialization result with URL-safe string
 *
 * @example
 * ```typescript
 * const filters: FilterState[] = [
 *   { columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }
 * ];
 *
 * const result = serializeFiltersToURL(filters, {
 *   compress: true,
 *   paramName: 'filters'
 * });
 *
 * console.log(result.value); // URL-safe encoded string
 * ```
 */
export function serializeFiltersToURL(
  filters: FilterState[],
  options: URLSerializationOptions = {}
): URLSerializationResult {
  const { compress = true, includeMeta = false, maxLength = DEFAULT_MAX_LENGTH } = options;

  // Create minimal filter data
  const filterData = filters.map((filter) => ({
    c: filter.columnId,
    t: filter.type,
    o: filter.operator,
    v: filter.values,
    ...(filter.includeNull && { n: filter.includeNull }),
    ...(includeMeta && filter.meta && { m: filter.meta }),
  }));

  const json = JSON.stringify(filterData);

  // Try uncompressed first
  let result = encodeToURL(json);
  let isCompressed = false;

  // Apply compression if needed or requested
  if (compress || result.length > maxLength) {
    const compressed = compressData(json);
    const compressedResult = encodeToURL(compressed);

    if (compressedResult.length < result.length) {
      result = `c:${compressedResult}`; // Prefix to indicate compression
      isCompressed = true;
    }
  }

  return {
    value: result,
    compressed: isCompressed,
    size: result.length,
  };
}

/**
 * Deserialize filters from URL string.
 *
 * Converts a URL-safe string back to filter states,
 * handling both compressed and uncompressed formats.
 *
 * @param urlString - URL-safe encoded string containing filters
 * @returns Array of deserialized filter states
 * @throws {Error} If the string cannot be deserialized
 *
 * @example
 * ```typescript
 * const urlString = 'JTVCJTdCJTIyYyUyMiUzQSUyMnVzZXJuYW1lJTIyJTJDJTIydCUyMiUzQSUyMnRleHQlMjIlMkMlMjJvJTIyJTNBJTIyZXF1YWxzJTIyJTJDJTIydiUyMiUzQSU1QiUyMmpvaG4lMjIlNUQlN0QlNUQ';
 *
 * try {
 *   const filters = deserializeFiltersFromURL(urlString);
 *   console.log(filters); // [{ columnId: 'username', type: 'text', operator: 'equals', values: ['john'] }]
 * } catch (error) {
 *   console.error('Failed to deserialize filters:', error);
 * }
 * ```
 */
export function deserializeFiltersFromURL(urlString: string): FilterState[] {
  if (!urlString || urlString.trim() === '') {
    return [];
  }

  try {
    let json: string;

    // Check if compressed
    if (urlString.startsWith('c:')) {
      const compressed = urlString.slice(2);
      const decodedCompressed = decodeFromURL(compressed);
      json = decompressData(decodedCompressed);
    } else {
      json = decodeFromURL(urlString);
    }

    const filterData = JSON.parse(json);

    if (!Array.isArray(filterData)) {
      throw new Error('Invalid filter data format');
    }

    // Convert back to full FilterState format
    // Note: We cast to FilterState[] because JSON deserialization loses type information.
    // The consuming code should validate these filters to ensure they match the expected types.
    return filterData.map((data: Record<string, unknown>) => ({
      columnId: data.c as string,
      type: data.t as ColumnType,
      operator: data.o as FilterOperator,
      values: data.v as unknown[],
      ...(data.n && typeof data.n === 'boolean' ? { includeNull: data.n } : {}),
      ...(data.m && typeof data.m === 'object' ? { meta: data.m as Record<string, unknown> } : {}),
    })) as FilterState[];
  } catch (error) {
    console.warn('Failed to deserialize filters from URL:', error);
    throw error; // Re-throw for validation to catch
  }
}

/**
 * Get filters from current URL parameters.
 *
 * Extracts and deserializes filters from the current page's URL,
 * with safe fallback for server-side rendering.
 *
 * @param options - Options for parameter name
 * @returns Array of filter states from URL
 *
 * @example
 * ```typescript
 * // URL: https://example.com/table?filters=JTVCJTdCJTIyYyUyMiUzQSUyMnVzZXJuYW1lJTIyJTJDJTIydCUyMiUzQSUyMnRleHQlMjIlMkMlMjJvJTIyJTNBJTIyZXF1YWxzJTIyJTJDJTIydiUyMiUzQSU1QiUyMmpvaG4lMjIlNUQlN0QlNUQ
 * const filters = getFiltersFromURL({ paramName: 'filters' });
 * console.log(filters); // Filter states from URL
 * ```
 */
export function getFiltersFromURL(
  options: Pick<URLSerializationOptions, 'paramName'> = {}
): FilterState[] {
  const { paramName = DEFAULT_PARAM_NAME } = options;

  if (typeof window === 'undefined') {
    return []; // SSR safety
  }

  const params = new URLSearchParams(window.location.search);
  const filterString = params.get(paramName);

  if (!filterString) {
    return [];
  }

  try {
    return deserializeFiltersFromURL(filterString);
  } catch (error) {
    console.warn('Failed to get filters from URL:', error);
    return [];
  }
}

/**
 * Set filters in current URL parameters.
 *
 * Updates the current page's URL with serialized filter states,
 * enabling bookmarkable filter states without page reload.
 *
 * @param filters - Filter states to serialize and store
 * @param options - Serialization options
 *
 * @example
 * ```typescript
 * const filters: FilterState[] = [
 *   { columnId: 'status', type: 'option', operator: 'equals', values: ['active'] }
 * ];
 *
 * setFiltersInURL(filters, { paramName: 'filters' });
 * // URL updated with serialized filters
 * ```
 */
export function setFiltersInURL(
  filters: FilterState[],
  options: URLSerializationOptions = {}
): void {
  const { paramName = DEFAULT_PARAM_NAME } = options;

  if (typeof window === 'undefined') {
    return; // SSR safety
  }

  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (filters.length === 0) {
    params.delete(paramName);
  } else {
    const result = serializeFiltersToURL(filters, options);
    params.set(paramName, result.value);
  }

  // Update URL without page reload
  window.history.replaceState({}, '', url.toString());
}

/**
 * Create shareable URL with filters.
 *
 * Generates a complete URL with serialized filters that can be
 * shared with others to reproduce the same filter state.
 *
 * @param filters - Filter states to include in URL
 * @param baseUrl - Base URL to use (defaults to current URL)
 * @param options - Serialization options
 * @returns Complete URL with serialized filters
 *
 * @example
 * ```typescript
 * const filters: FilterState[] = [
 *   { columnId: 'department', type: 'option', operator: 'equals', values: ['engineering'] }
 * ];
 *
 * const shareableUrl = createShareableURL(
 *   filters,
 *   'https://example.com/employees',
 *   { paramName: 'filters' }
 * );
 *
 * console.log(shareableUrl);
 * // https://example.com/employees?filters=JTVCJTdCJTIyYyUyMiUzQSUyMmRlcGFydG1lbnQlMjIlMkMlMjJ0JTIyJTNBJTIyb3B0aW9uJTIyJTJDJTIybyUyMiUzQSUyMmVxdWFscyUyMiUyQyUyMnYlMjIlM0ElNUIlMjJlbmdpbmVlcmluZyUyMiU1RCU3RCU1RA
 * ```
 */
export function createShareableURL(
  filters: FilterState[],
  baseUrl?: string,
  options: URLSerializationOptions = {}
): string {
  const { paramName = DEFAULT_PARAM_NAME } = options;

  const url = new URL(baseUrl || (typeof window !== 'undefined' ? window.location.href : ''));

  if (filters.length > 0) {
    const result = serializeFiltersToURL(filters, options);
    url.searchParams.set(paramName, result.value);
  }

  return url.toString();
}

/**
 * Validate that URL string can be deserialized.
 *
 * Checks if a URL string contains valid serialized filters
 * without actually deserializing them.
 *
 * @param urlString - URL string to validate
 * @returns True if the string can be deserialized successfully
 *
 * @example
 * ```typescript
 * const isValid = validateFilterURL('JTVCJTdCJTIyYyUyMiUzQSUyMnVzZXJuYW1lJTIyJTJDJTIydCUyMiUzQSUyMnRleHQlMjIlMkMlMjJvJTIyJTNBJTIyZXF1YWxzJTIyJTJDJTIydiUyMiUzQSU1QiUyMmpvaG4lMjIlNUQlN0QlNUQ');
 * console.log(isValid); // true
 *
 * const isInvalid = validateFilterURL('invalid-string');
 * console.log(isInvalid); // false
 * ```
 */
export function validateFilterURL(urlString: string): boolean {
  try {
    const result = deserializeFiltersFromURL(urlString);
    return Array.isArray(result);
  } catch (_error) {
    return false;
  }
}

/**
 * Get serialization information without actually serializing.
 *
 * Provides estimates about serialization size and compression
 * requirements without performing the actual serialization.
 *
 * @param filters - Filter states to analyze
 * @param options - Serialization options
 * @returns Information about estimated serialization
 *
 * @example
 * ```typescript
 * const filters: FilterState[] = [
 *   { columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }
 * ];
 *
 * const info = getSerializationInfo(filters, { maxLength: 2000 });
 * console.log(info);
 * // {
 * //   estimatedSize: 64,
 * //   wouldCompress: false,
 * //   filterCount: 1
 * // }
 * ```
 */
export function getSerializationInfo(
  filters: FilterState[],
  options: URLSerializationOptions = {}
): {
  estimatedSize: number;
  wouldCompress: boolean;
  filterCount: number;
} {
  const { maxLength = DEFAULT_MAX_LENGTH } = options;
  const filterData = filters.map((filter) => ({
    c: filter.columnId,
    t: filter.type,
    o: filter.operator,
    v: filter.values,
  }));

  const json = JSON.stringify(filterData);
  const encoded = encodeToURL(json);

  return {
    estimatedSize: encoded.length,
    wouldCompress: encoded.length > maxLength,
    filterCount: filters.length,
  };
}

/**
 * Encode string to URL-safe format.
 *
 * Converts a string to a URL-safe base64 encoding by replacing
 * characters that could cause issues in URLs.
 *
 * @param str - String to encode
 * @returns URL-safe encoded string
 *
 * @internal
 */
function encodeToURL(str: string): string {
  return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode string from URL-safe format.
 *
 * Converts a URL-safe base64 string back to its original form
 * by reversing the URL-safe character replacements.
 *
 * @param str - URL-safe encoded string
 * @returns Decoded original string
 *
 * @internal
 */
function decodeFromURL(str: string): string {
  // Add padding if needed
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(atob(base64));
}

/**
 * Key mapping for compression optimization.
 *
 * Maps long property names to short abbreviations to reduce
 * serialized data size while maintaining readability.
 *
 * @internal
 */
const COMPRESSION_KEY_MAP: Record<string, string> = {
  columnId: 'c',
  type: 't',
  operator: 'o',
  values: 'v',
  includeNull: 'n',
  meta: 'm',
};

/**
 * Reverse key mapping for decompression.
 *
 * Maps compressed abbreviations back to full property names
 * during deserialization.
 *
 * @internal
 */
const DECOMPRESSION_KEY_MAP: Record<string, string> = Object.fromEntries(
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
 *
 * @internal
 */
function renameKeys(obj: unknown, keyMap: Record<string, string>): unknown {
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
 * Safe compression using key shortening only.
 *
 * Compresses data by shortening property names while preserving
 * all values. Operates on parsed JSON to avoid corrupting data.
 *
 * @param str - JSON string to compress
 * @returns Compressed JSON string
 *
 * @internal
 */
function compressData(str: string): string {
  try {
    const parsed = JSON.parse(str);
    const compressed = renameKeys(parsed, COMPRESSION_KEY_MAP);
    return JSON.stringify(compressed);
  } catch (error) {
    // If parsing fails, return original string
    console.warn('Failed to compress data, using original:', error);
    return str;
  }
}

/**
 * Decompress data by reversing key shortening.
 *
 * Restores full property names from compressed abbreviations.
 * Operates on parsed JSON to avoid corrupting data.
 *
 * @param str - Compressed JSON string
 * @returns Decompressed JSON string
 *
 * @internal
 */
function decompressData(str: string): string {
  try {
    const parsed = JSON.parse(str);
    const decompressed = renameKeys(parsed, DECOMPRESSION_KEY_MAP);
    return JSON.stringify(decompressed);
  } catch (error) {
    // If parsing fails, return original string
    console.warn('Failed to decompress data, using original:', error);
    return str;
  }
}

/**
 * Hook-style utility for React applications
 */
export const filterURLUtils = {
  serialize: serializeFiltersToURL,
  deserialize: deserializeFiltersFromURL,
  getFromURL: getFiltersFromURL,
  setInURL: setFiltersInURL,
  createShareableURL: createShareableURL,
  validate: validateFilterURL,
  getInfo: getSerializationInfo,
};

// Legacy export for backward compatibility
export const FilterURLSerializer = {
  serialize: serializeFiltersToURL,
  deserialize: deserializeFiltersFromURL,
  getFromURL: getFiltersFromURL,
  setInURL: setFiltersInURL,
  createShareableURL: createShareableURL,
  validate: validateFilterURL,
  getSerializationInfo: getSerializationInfo,
};

export default FilterURLSerializer;
