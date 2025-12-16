/**
 * Framework-agnostic URL serialization utilities for Better Tables
 *
 * These pure functions handle serializing and deserializing table state
 * to/from URL parameters. Complex data structures (filters, sorting, etc.)
 * are compressed and encoded to keep URLs short, while simple params (page, limit)
 * remain as plain strings.
 *
 * Uses serialization utilities from ./filter-serialization for filter serialization.
 * Other complex data structures (sorting, columnVisibility, columnOrder) use
 * compression utilities directly.
 *
 * Compression strategy:
 * 1. Key shortening (columnId → c, type → t, operator → o, values → v, etc.)
 * 2. lz-string compression for actual data compression
 *
 * Compressed data is prefixed with "c:" to distinguish from uncompressed data.
 *
 * @module utils/url-serialization
 */

import type { FilterState, PaginationState, SortingState } from '@/types';
import {
  compressAndEncode,
  decompressAndDecode,
} from './compression';
import { deserializeFiltersFromURL, serializeFiltersToURL } from './filter-serialization';

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
 * Serialize table state to URL parameters
 *
 * Converts table state (filters, pagination, sorting, etc.) into a format
 * suitable for URL query parameters. Complex data structures are compressed
 * and encoded to keep URLs short, while simple params (page, limit) remain as plain strings.
 *
 * **Compression Strategy:**
 * - All data: Key shortening + lz-string compression (URL-safe)
 * - Compressed data is prefixed with "c:" to identify compressed format
 *
 * **Compression Benefits:**
 * - 4 filters: ~400 chars → ~150-200 chars (50-60% reduction)
 * - 10+ filters: ~1000+ chars → ~300-400 chars (60-70% reduction)
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
 * //   filters: 'c:...', // compressed with lz-string
 * //   page: '2',
 * //   limit: '20',
 * //   sorting: 'c:...' // compressed with lz-string
 * // }
 * ```
 */
export function serializeTableStateToUrl(
  state: SerializableTableState
): Record<string, string | null> {
  const params: Record<string, string | null> = {};

  // Serialize filters (compressed and encoded) - use core serialization function
  if (state.filters && state.filters.length > 0) {
    try {
      params.filters = serializeFiltersToURL(state.filters);
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

  // Serialize sorting (compressed and encoded)
  if (state.sorting && state.sorting.length > 0) {
    try {
      params.sorting = compressAndEncode(state.sorting);
    } catch {
      // Silently ignore serialization errors
    }
  } else if (state.sorting !== undefined) {
    // Empty array - set to null to indicate it should be removed from URL
    params.sorting = null;
  }

  // Serialize column visibility (compressed and encoded)
  if (state.columnVisibility && Object.keys(state.columnVisibility).length > 0) {
    try {
      params.columnVisibility = compressAndEncode(state.columnVisibility);
    } catch {
      // Silently ignore serialization errors
    }
  } else if (state.columnVisibility !== undefined) {
    // Empty object - set to null to indicate it should be removed from URL
    params.columnVisibility = null;
  }

  // Serialize column order (compressed and encoded)
  if (state.columnOrder && state.columnOrder.length > 0) {
    try {
      params.columnOrder = compressAndEncode(state.columnOrder);
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
 * or invalid parameters gracefully with sensible defaults. Automatically
 * decompresses compressed data (prefixed with "c:").
 *
 * **Decompression:**
 * - Compressed data (starts with "c:"): Decompressed using lz-string, then keys restored
 * - Invalid data: Returns empty defaults (filters: [], sorting: [], etc.)
 *
 * @param params - URL parameters as a record (e.g., from URLSearchParams or Next.js searchParams)
 * @param defaults - Optional default values for pagination
 * @returns Deserialized table state
 *
 * @example
 * ```typescript
 * const params = {
 *   filters: 'c:...', // compressed with lz-string
 *   page: '2',
 *   limit: '20',
 *   sorting: 'c:...', // compressed with lz-string
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

  // Deserialize filters (compressed) - use core deserialization function
  if (params.filters) {
    try {
      result.filters = deserializeFiltersFromURL(params.filters);
    } catch {
      // Silently ignore deserialization errors, keep empty array default
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

  // Deserialize sorting (compressed)
  if (params.sorting) {
    const decoded = decompressAndDecode<SortingState>(params.sorting);
    if (decoded && Array.isArray(decoded)) {
      result.sorting = decoded;
    }
  }

  // Deserialize column visibility (compressed)
  if (params.columnVisibility) {
    const decoded = decompressAndDecode<Record<string, boolean>>(params.columnVisibility);
    if (decoded && typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
      result.columnVisibility = decoded;
    }
  }

  // Deserialize column order (compressed)
  if (params.columnOrder) {
    const decoded = decompressAndDecode<string[]>(params.columnOrder);
    if (decoded && Array.isArray(decoded)) {
      result.columnOrder = decoded;
    }
  }

  return result;
}
