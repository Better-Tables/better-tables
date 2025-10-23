import type { ColumnType, FilterOperator } from '../types';
import type { FilterState } from '../types/filter';

/**
 * Options for URL serialization
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
 * Result of URL serialization
 */
export interface URLSerializationResult {
  /** The serialized string */
  value: string;
  /** Whether compression was applied */
  compressed: boolean;
  /** Size of the result */
  size: number;
}

/**
 * Filter serialization utilities for URL state persistence
 */

const DEFAULT_PARAM_NAME = 'filters';
const DEFAULT_MAX_LENGTH = 2000; // Conservative URL length limit

/**
 * Serialize filters to URL-safe string
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
 * Deserialize filters from URL string
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
    return filterData.map((data: Record<string, unknown>) => ({
      columnId: data.c as string,
      type: data.t as ColumnType,
      operator: data.o as FilterOperator,
      values: data.v as unknown[],
      ...(data.n && typeof data.n === 'boolean' ? { includeNull: data.n } : {}),
      ...(data.m && typeof data.m === 'object' ? { meta: data.m as Record<string, unknown> } : {}),
    }));
  } catch (error) {
    console.warn('Failed to deserialize filters from URL:', error);
    throw error; // Re-throw for validation to catch
  }
}

/**
 * Get filters from current URL
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
 * Set filters in current URL
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
 * Create shareable URL with filters
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
 * Validate that URL string can be deserialized
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
 * Get serialization info without actually serializing
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
 * Encode string to URL-safe format
 */
function encodeToURL(str: string): string {
  return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode string from URL-safe format
 */
function decodeFromURL(str: string): string {
  // Add padding if needed
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(atob(base64));
}

/**
 * Safe compression using key shortening only
 */
function compressData(str: string): string {
  // Only use safe key shortening - this provides significant URL length reduction
  // without the risk of data corruption from run-length encoding
  return str
    .replace(/("columnId")/g, '"c"')
    .replace(/("type")/g, '"t"')
    .replace(/("operator")/g, '"o"')
    .replace(/("values")/g, '"v"')
    .replace(/("includeNull")/g, '"n"')
    .replace(/("meta")/g, '"m"');
}

/**
 * Decompress data by reversing key shortening
 */
function decompressData(str: string): string {
  // Only reverse the safe key shortening - no unsafe run-length decoding
  return str
    .replace(/("c")/g, '"columnId"')
    .replace(/("t")/g, '"type"')
    .replace(/("o")/g, '"operator"')
    .replace(/("v")/g, '"values"')
    .replace(/("n")/g, '"includeNull"')
    .replace(/("m")/g, '"meta"');
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
