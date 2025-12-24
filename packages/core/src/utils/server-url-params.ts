/**
 * Framework-agnostic server-side URL parameter parsing utilities
 *
 * Pure functions for parsing URL parameters on the server. Works with
 * Next.js, Remix, or any server framework that provides searchParams.
 * Handles compressed complex data structures automatically.
 *
 * @module utils/server-url-params
 */

import type { FilterState, SortingState } from '@/types';
import { deserializeTableStateFromUrl } from './url-serialization';

/**
 * Parsed table search parameters from server-side URL
 */
export interface ParsedTableSearchParams {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Active filters */
  filters: FilterState[];
  /** Sorting configuration */
  sorting: SortingState;
  /** Column visibility state */
  columnVisibility: Record<string, boolean>;
  /** Column order */
  columnOrder: string[];
}

/**
 * Parse table search parameters from server-side URL
 *
 * Extracts and parses all table-related URL parameters from server-side
 * searchParams (e.g., Next.js 15 searchParams, Remix searchParams).
 * Provides sensible defaults for missing parameters.
 * Automatically decompresses complex data structures.
 *
 * @param searchParams - URL search parameters as a record (e.g., from Next.js or Remix)
 * @param defaults - Optional default values for pagination (defaults to page: 1, limit: 20)
 * @returns Parsed table search parameters
 *
 * @example
 * ```typescript
 * // Next.js 15
 * export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
 *   const params = await searchParams;
 *   const tableParams = parseTableSearchParams(params);
 *   // Use tableParams.page, tableParams.filters, etc.
 * }
 *
 * // Remix
 * export async function loader({ request }: LoaderArgs) {
 *   const url = new URL(request.url);
 *   const searchParams = Object.fromEntries(url.searchParams);
 *   const tableParams = parseTableSearchParams(searchParams);
 *   // Use tableParams.page, tableParams.filters, etc.
 * }
 * ```
 */
export function parseTableSearchParams(
  searchParams: Record<string, string | undefined | null>,
  defaults?: {
    page?: number;
    limit?: number;
  }
): ParsedTableSearchParams {
  const defaultPage = defaults?.page ?? 1;
  const defaultLimit = defaults?.limit ?? 20;

  // Use the deserialization utility (handles decompression automatically)
  const deserialized = deserializeTableStateFromUrl(searchParams, {
    page: defaultPage,
    limit: defaultLimit,
  });

  // Ensure page and limit are always numbers (not undefined)
  return {
    page: deserialized.pagination.page ?? defaultPage,
    limit: deserialized.pagination.limit ?? defaultLimit,
    filters: deserialized.filters,
    sorting: deserialized.sorting,
    columnVisibility: deserialized.columnVisibility,
    columnOrder: deserialized.columnOrder,
  };
}
