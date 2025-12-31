/**
 * @fileoverview Utility for creating export adapters with minimal configuration.
 *
 * This module provides a simple factory function to create TableAdapter instances
 * specifically for export operations, reducing boilerplate code.
 *
 * @module utils/create-export-adapter
 */

import type { AdapterMeta, TableAdapter } from '../types/adapter';
import type { FilterState } from '../types/filter';
import type { SortingParams } from '../types/sorting';

/**
 * Options for creating an API-based export adapter.
 */
export interface CreateApiExportAdapterOptions<TData = unknown> {
  /** API endpoint URL for fetching data */
  url: string;

  /** HTTP method (default: 'POST') */
  method?: 'GET' | 'POST';

  /** Custom headers to include in requests */
  headers?: Record<string, string>;

  /** Transform the response data */
  transformResponse?: (response: unknown) => {
    data: TData[];
    total: number;
  };

  /** Custom request body builder (for POST requests) */
  buildRequestBody?: (params: {
    offset: number;
    limit: number;
    filters?: FilterState[];
    sorting?: SortingParams[];
  }) => unknown;

  /** Custom URL builder (for GET requests) */
  buildRequestUrl?: (params: {
    offset: number;
    limit: number;
    filters?: FilterState[];
    sorting?: SortingParams[];
  }) => string;
}

/**
 * Default adapter meta for export-only adapters.
 */
const DEFAULT_EXPORT_ADAPTER_META: AdapterMeta = {
  name: 'api-export-adapter',
  version: '1.0.0',
  features: {
    create: false,
    read: true,
    update: false,
    delete: false,
    bulkOperations: false,
    realTimeUpdates: false,
    export: true,
    transactions: false,
  },
  supportedColumnTypes: [
    'text',
    'number',
    'date',
    'boolean',
    'option',
    'multiOption',
    'currency',
    'percentage',
    'url',
    'email',
    'phone',
    'json',
    'custom',
  ],
  supportedOperators: {
    text: ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
    number: [
      'equals',
      'greaterThan',
      'lessThan',
      'greaterThanOrEqual',
      'lessThanOrEqual',
      'between',
    ],
    date: ['is', 'before', 'after', 'between', 'isEmpty', 'isNotEmpty'],
    boolean: ['isTrue', 'isFalse'],
    option: ['equals', 'notEquals', 'isAnyOf', 'isEmpty', 'isNotEmpty'],
    multiOption: ['includes', 'includesAll', 'includesAny', 'isEmpty', 'isNotEmpty'],
    currency: ['equals', 'greaterThan', 'lessThan', 'between'],
    percentage: ['equals', 'greaterThan', 'lessThan', 'between'],
    url: ['contains', 'equals', 'startsWith', 'isEmpty', 'isNotEmpty'],
    email: ['contains', 'equals', 'startsWith', 'isEmpty', 'isNotEmpty'],
    phone: ['contains', 'equals', 'startsWith', 'isEmpty', 'isNotEmpty'],
    json: ['isEmpty', 'isNotEmpty'],
    custom: [],
  },
};

/**
 * Creates a minimal TableAdapter for export operations from an API endpoint.
 *
 * This utility reduces boilerplate by providing sensible defaults for all
 * adapter methods except data fetching.
 *
 * @example Simple usage
 * ```typescript
 * const exportAdapter = createApiExportAdapter<User>({
 *   url: '/api/users',
 * });
 *
 * <BetterTable
 *   export={{
 *     enabled: true,
 *     adapter: exportAdapter,
 *   }}
 * />
 * ```
 *
 * @example With custom response transformation
 * ```typescript
 * const exportAdapter = createApiExportAdapter<User>({
 *   url: '/api/users',
 *   transformResponse: (response) => ({
 *     data: response.items,
 *     total: response.totalCount,
 *   }),
 * });
 * ```
 *
 * @example With GET request and custom URL building
 * ```typescript
 * const exportAdapter = createApiExportAdapter<User>({
 *   url: '/api/users',
 *   method: 'GET',
 *   buildRequestUrl: ({ offset, limit, filters }) => {
 *     const params = new URLSearchParams({
 *       offset: String(offset),
 *       limit: String(limit),
 *     });
 *     if (filters) params.set('filters', JSON.stringify(filters));
 *     return `/api/users?${params.toString()}`;
 *   },
 * });
 * ```
 *
 * @template TData - The type of data returned by the API
 * @param options - Configuration options for the adapter
 * @returns A TableAdapter configured for export operations
 */
export function createApiExportAdapter<TData = unknown>(
  options: CreateApiExportAdapterOptions<TData>
): TableAdapter<TData> {
  const {
    url,
    method = 'POST',
    headers = {},
    transformResponse,
    buildRequestBody,
    buildRequestUrl,
  } = options;

  return {
    fetchData: async (params) => {
      const { pagination, filters, sorting } = params;
      const offset = pagination ? (pagination.page - 1) * pagination.limit : 0;
      const limit = pagination?.limit ?? 100;

      let fetchUrl = url;
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (method === 'POST') {
        const body = buildRequestBody
          ? buildRequestBody({ offset, limit, filters, sorting })
          : { offset, limit, filters, sorting };
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchUrl = buildRequestUrl
          ? buildRequestUrl({ offset, limit, filters, sorting })
          : `${url}?offset=${offset}&limit=${limit}`;
      }

      const response = await fetch(fetchUrl, fetchOptions);

      if (!response.ok) {
        throw new Error(`Failed to fetch export data: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const transformed = transformResponse
        ? transformResponse(result)
        : { data: result.data as TData[], total: result.total as number };

      return {
        data: transformed.data,
        total: transformed.total,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.ceil(transformed.total / limit),
          hasNext: offset + limit < transformed.total,
          hasPrev: offset > 0,
        },
      };
    },
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0] as [number, number],
    meta: DEFAULT_EXPORT_ADAPTER_META,
  };
}

/**
 * Creates a minimal TableAdapter that uses the provided data array directly.
 *
 * Useful for exporting when all data is already loaded in memory.
 *
 * @example
 * ```typescript
 * const exportAdapter = createInMemoryExportAdapter(usersData);
 *
 * <BetterTable
 *   data={usersData}
 *   export={{
 *     enabled: true,
 *     adapter: exportAdapter,
 *   }}
 * />
 * ```
 *
 * @template TData - The type of data in the array
 * @param data - Array of data to export
 * @returns A TableAdapter that returns slices of the data array
 */
export function createInMemoryExportAdapter<TData = unknown>(data: TData[]): TableAdapter<TData> {
  return {
    fetchData: async (params) => {
      const { pagination } = params;
      const offset = pagination ? (pagination.page - 1) * pagination.limit : 0;
      const limit = pagination?.limit ?? data.length;
      const paginatedData = data.slice(offset, offset + limit);

      return {
        data: paginatedData,
        total: data.length,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.ceil(data.length / limit),
          hasNext: offset + limit < data.length,
          hasPrev: offset > 0,
        },
      };
    },
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0] as [number, number],
    meta: DEFAULT_EXPORT_ADAPTER_META,
  };
}
