/**
 * Framework-agnostic URL serialization utilities for Better Tables
 *
 * These pure functions handle serializing and deserializing table state
 * to/from URL parameters. Complex data structures (filters, sorting, etc.)
 * are base64-encoded to keep URLs short, while simple params (page, limit)
 * remain as plain strings.
 *
 * @module utils/url-serialization
 */

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';

/**
 * Table state that can be serialized to URL parameters
 */
export interface SerializableTableState {
  /** Active filters */
  filters?: FilterState[];
  /** Pagination state */
  pagination?: PaginationState;
  /** Sorting configuration */
  sorting?: SortingState;
  /** Column visibility state */
  columnVisibility?: Record<string, boolean>;
  /** Column order */
  columnOrder?: string[];
}

/**
 * Deserialized table state from URL parameters
 */
export interface DeserializedTableState {
  /** Active filters */
  filters: FilterState[];
  /** Pagination state (partial - only page and limit from URL) */
  pagination: Partial<PaginationState>;
  /** Sorting configuration */
  sorting: SortingState;
  /** Column visibility state */
  columnVisibility: Record<string, boolean>;
  /** Column order */
  columnOrder: string[];
}

/**
 * Encode data to base64 URL-safe string
 *
 * @param data - Data to encode (will be JSON stringified first)
 * @returns Base64 URL-safe encoded string
 */
export function encodeBase64(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    // Use browser's btoa if available, otherwise use Buffer (Node.js)
    if (typeof window !== 'undefined' && typeof btoa !== 'undefined') {
      return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    // Node.js environment
    return Buffer.from(json, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch {
    return '';
  }
}

/**
 * Decode base64 URL-safe string to data
 *
 * @param encoded - Base64 URL-safe encoded string
 * @returns Decoded data (parsed from JSON)
 */
export function decodeBase64<T = unknown>(encoded: string): T | null {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    // Use browser's atob if available, otherwise use Buffer (Node.js)
    let json: string;
    if (typeof window !== 'undefined' && typeof atob !== 'undefined') {
      json = atob(base64);
    } else {
      // Node.js environment
      json = Buffer.from(base64, 'base64').toString('utf-8');
    }
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Serialize table state to URL parameters
 *
 * Converts table state (filters, pagination, sorting, etc.) into a format
 * suitable for URL query parameters. Complex data structures are base64-encoded
 * to keep URLs short, while simple params (page, limit) remain as plain strings.
 *
 * @param state - Table state to serialize
 * @returns Record of URL parameter keys and values (null values should be removed from URL)
 *
 * @example
 * ```typescript
 * const state = {
 *   filters: [{ columnId: 'status', operator: 'equals', values: ['active'], type: 'option' }],
 *   pagination: { page: 2, limit: 20, totalPages: 10, hasNext: true, hasPrev: true },
 *   sorting: [{ columnId: 'name', direction: 'asc' }],
 * };
 *
 * const params = serializeTableStateToUrl(state);
 * // Returns:
 * // {
 * //   filters: 'W3siY29sdW1uSWQiOiJzdGF0dXMiLCJvcGVyYXRvciI6ImVxdWFscyIsInZhbHVlcyI6WyJhY3RpdmUiXSwidHlwZSI6Im9wdGlvbiJ9XQ', // base64
 * //   page: '2',
 * //   limit: '20',
 * //   sorting: 'W3siY29sdW1uSWQiOiJuYW1lIiwiZGlyZWN0aW9uIjoiYXNjIn1d' // base64
 * // }
 * ```
 */
export function serializeTableStateToUrl(
  state: SerializableTableState
): Record<string, string | null> {
  const params: Record<string, string | null> = {};

  // Serialize filters (base64-encoded)
  if (state.filters && state.filters.length > 0) {
    try {
      params.filters = encodeBase64(state.filters);
    } catch {
      // Silently ignore serialization errors
    }
  } else if (state.filters !== undefined) {
    // Empty array - set to null to indicate it should be removed from URL
    params.filters = null;
  }

  // Serialize pagination (plain strings for page and limit)
  if (state.pagination) {
    params.page = state.pagination.page.toString();
    params.limit = state.pagination.limit.toString();
  }

  // Serialize sorting (base64-encoded)
  if (state.sorting && state.sorting.length > 0) {
    try {
      params.sorting = encodeBase64(state.sorting);
    } catch {
      // Silently ignore serialization errors
    }
  } else if (state.sorting !== undefined) {
    // Empty array - set to null to indicate it should be removed from URL
    params.sorting = null;
  }

  // Serialize column visibility (base64-encoded)
  if (state.columnVisibility && Object.keys(state.columnVisibility).length > 0) {
    try {
      params.columnVisibility = encodeBase64(state.columnVisibility);
    } catch {
      // Silently ignore serialization errors
    }
  } else if (state.columnVisibility !== undefined) {
    // Empty object - set to null to indicate it should be removed from URL
    params.columnVisibility = null;
  }

  // Serialize column order (base64-encoded)
  if (state.columnOrder && state.columnOrder.length > 0) {
    try {
      params.columnOrder = encodeBase64(state.columnOrder);
    } catch {
      // Silently ignore serialization errors
    }
  } else if (state.columnOrder !== undefined) {
    // Empty array - set to null to indicate it should be removed from URL
    params.columnOrder = null;
  }

  return params;
}

/**
 * Deserialize table state from URL parameters
 *
 * Converts URL query parameters back into table state. Handles missing
 * or invalid parameters gracefully with sensible defaults. Base64-encoded
 * values are automatically decoded.
 *
 * @param params - URL parameters as a record (e.g., from URLSearchParams or Next.js searchParams)
 * @param defaults - Optional default values for pagination
 * @returns Deserialized table state
 *
 * @example
 * ```typescript
 * const params = {
 *   filters: 'W3siY29sdW1uSWQiOiJzdGF0dXMiLCJvcGVyYXRvciI6ImVxdWFscyIsInZhbHVlcyI6WyJhY3RpdmUiXSwidHlwZSI6Im9wdGlvbiJ9XQ',
 *   page: '2',
 *   limit: '20',
 *   sorting: 'W3siY29sdW1uSWQiOiJuYW1lIiwiZGlyZWN0aW9uIjoiYXNjIn1d',
 * };
 *
 * const state = deserializeTableStateFromUrl(params);
 * // Returns:
 * // {
 * //   filters: [{ columnId: 'status', operator: 'equals', values: ['active'], type: 'option' }],
 * //   pagination: { page: 2, limit: 20 },
 * //   sorting: [{ columnId: 'name', direction: 'asc' }],
 * //   columnVisibility: {},
 * //   columnOrder: []
 * // }
 * ```
 */
export function deserializeTableStateFromUrl(
  params: Record<string, string | undefined | null>,
  defaults?: {
    page?: number;
    limit?: number;
  }
): DeserializedTableState {
  const result: DeserializedTableState = {
    filters: [],
    pagination: {},
    sorting: [],
    columnVisibility: {},
    columnOrder: [],
  };

  // Deserialize filters (base64-decoded)
  if (params.filters) {
    const decoded = decodeBase64<FilterState[]>(params.filters);
    if (decoded && Array.isArray(decoded)) {
      result.filters = decoded;
    }
  }

  // Deserialize pagination (plain strings)
  if (params.page) {
    const page = Number.parseInt(params.page, 10);
    if (!Number.isNaN(page) && page > 0) {
      result.pagination.page = page;
    } else if (defaults?.page) {
      result.pagination.page = defaults.page;
    }
  } else if (defaults?.page) {
    result.pagination.page = defaults.page;
  }

  if (params.limit) {
    const limit = Number.parseInt(params.limit, 10);
    if (!Number.isNaN(limit) && limit > 0) {
      result.pagination.limit = limit;
    } else if (defaults?.limit) {
      result.pagination.limit = defaults.limit;
    }
  } else if (defaults?.limit) {
    result.pagination.limit = defaults.limit;
  }

  // Deserialize sorting (base64-decoded)
  if (params.sorting) {
    const decoded = decodeBase64<SortingState>(params.sorting);
    if (decoded && Array.isArray(decoded)) {
      result.sorting = decoded;
    }
  }

  // Deserialize column visibility (base64-decoded)
  if (params.columnVisibility) {
    const decoded = decodeBase64<Record<string, boolean>>(params.columnVisibility);
    if (decoded && typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
      result.columnVisibility = decoded;
    }
  }

  // Deserialize column order (base64-decoded)
  if (params.columnOrder) {
    const decoded = decodeBase64<string[]>(params.columnOrder);
    if (decoded && Array.isArray(decoded)) {
      result.columnOrder = decoded;
    }
  }

  return result;
}
