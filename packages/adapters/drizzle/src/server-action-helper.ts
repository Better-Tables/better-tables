/**
 * @fileoverview Helper utilities for creating Next.js server actions with Drizzle adapters.
 *
 * This module provides utilities to easily create server actions that work with
 * DrizzleAdapter instances, enabling seamless integration between server-side
 * adapters and client-side components.
 *
 * @module server-action-helper
 */

import type {
  FetchDataParams,
  FetchDataResult,
  SchemaInfo,
  TableAdapter,
} from '@better-tables/core';
import type { DrizzleAdapter } from './drizzle-adapter';

/**
 * Creates a server action function that wraps a DrizzleAdapter's fetchData method.
 *
 * This is a convenience function for Next.js applications that want to use server
 * actions instead of API routes. The returned function can be used directly as a
 * server action or passed to `createServerActionAdapter`.
 *
 * @example
 * ```typescript
 * // In app/actions/export.ts
 * 'use server';
 *
 * import { createDrizzleFetchDataAction } from '@better-tables/adapters-drizzle';
 * import { getAdapter } from '@/lib/adapter';
 *
 * export const fetchExportData = createDrizzleFetchDataAction(async () => {
 *   return await getAdapter();
 * });
 * ```
 *
 * @template TData - The type of data returned by the adapter
 * @param getAdapter - Function that returns the DrizzleAdapter instance
 * @returns A server action function that fetches data using the adapter
 */
export function createDrizzleFetchDataAction<TData = unknown>(
  getAdapter: () => Promise<DrizzleAdapter<TData>> | DrizzleAdapter<TData>
): (params: FetchDataParams) => Promise<FetchDataResult<TData>> {
  return async (params: FetchDataParams): Promise<FetchDataResult<TData>> => {
    const adapter = await getAdapter();
    return adapter.fetchData(params);
  };
}

/**
 * Creates a server action function that wraps a DrizzleAdapter and includes schema info.
 *
 * This is a convenience function that creates both the fetchData action and extracts
 * schema information in one call. The schema info is returned alongside the action,
 * allowing you to pass it to `createServerActionAdapter`.
 *
 * @example
 * ```typescript
 * // In app/actions/export.ts
 * 'use server';
 *
 * import { createDrizzleExportActions } from '@better-tables/adapters-drizzle';
 * import { createServerActionAdapter } from '@better-tables/core';
 * import { getAdapter } from '@/lib/adapter';
 *
 * const { fetchDataAction, schemaInfo } = createDrizzleExportActions(async () => {
 *   return await getAdapter();
 * });
 *
 * export { fetchDataAction, schemaInfo };
 * ```
 *
 * @template TData - The type of data returned by the adapter
 * @param getAdapter - Function that returns the DrizzleAdapter instance
 * @returns An object containing the fetchData action and schema info
 */
export async function createDrizzleExportActions<TData = unknown>(
  getAdapter: () => Promise<DrizzleAdapter<TData>> | DrizzleAdapter<TData>
): Promise<{
  fetchDataAction: (params: FetchDataParams) => Promise<FetchDataResult<TData>>;
  schemaInfo: SchemaInfo | null;
}> {
  const adapter = await getAdapter();
  const schemaInfo = adapter.getSchemaInfo ? adapter.getSchemaInfo() : null;

  return {
    fetchDataAction: async (params: FetchDataParams) => {
      return adapter.fetchData(params);
    },
    schemaInfo: schemaInfo instanceof Promise ? await schemaInfo : schemaInfo,
  };
}
