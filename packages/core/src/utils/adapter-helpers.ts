/**
 * @fileoverview Utility functions for working with table adapters.
 *
 * @module utils/adapter-helpers
 */

import type { SchemaInfo, TableAdapter } from '../types/adapter';

/**
 * Check if an adapter supports schema introspection.
 *
 * @param adapter - The adapter to check
 * @returns True if the adapter implements getSchemaInfo, false otherwise
 *
 * @example
 * ```typescript
 * if (supportsSchemaIntrospection(adapter)) {
 *   const schemaInfo = await adapter.getSchemaInfo();
 * }
 * ```
 */
export function supportsSchemaIntrospection<TData = unknown>(
  adapter: TableAdapter<TData> | null | undefined
): adapter is TableAdapter<TData> & { getSchemaInfo: () => Promise<SchemaInfo> | SchemaInfo } {
  return adapter !== null && adapter !== undefined && typeof adapter.getSchemaInfo === 'function';
}

/**
 * Get schema information from an adapter if supported.
 *
 * This is a safe wrapper that checks if the adapter supports schema introspection
 * before attempting to call getSchemaInfo.
 *
 * @param adapter - The adapter to get schema info from
 * @returns Promise resolving to schema info, or null if not supported
 *
 * @example
 * ```typescript
 * const schemaInfo = await getSchemaInfoSafe(adapter);
 * if (schemaInfo) {
 *   // Use schema info
 * }
 * ```
 */
export async function getSchemaInfoSafe<TData = unknown>(
  adapter: TableAdapter<TData> | null | undefined
): Promise<SchemaInfo | null> {
  if (!supportsSchemaIntrospection(adapter)) {
    return null;
  }

  try {
    const result = adapter.getSchemaInfo();
    return result instanceof Promise ? await result : result;
  } catch (error) {
    console.error('Error getting schema info:', error);
    return null;
  }
}
