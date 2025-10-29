/**
 * @fileoverview Main factory function for creating Better Tables instances
 * @module @better-tables/core/factory
 *
 * @description
 * Provides the primary API for creating Better Tables instances with any adapter.
 * This factory function creates a unified interface regardless of the underlying
 * data source (Drizzle, Prisma, REST API, etc.).
 *
 * @example
 * ```typescript
 * import { betterTables } from '@better-tables/core';
 * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
 *
 * const tables = betterTables({
 *   database: drizzleAdapter(db),
 *   columns: [...],
 *   pagination: { page: 1, limit: 20 }
 * });
 * ```
 */

import type { TableAdapter } from './types/adapter';
import type { ColumnDefinition } from './types/column';
import type { BetterTablesConfig, BetterTablesInstance } from './types/factory';

/**
 * Create a Better Tables instance with any adapter.
 *
 * @description
 * This is the main entry point for Better Tables. It accepts a configuration
 * object with a data adapter and optional settings for columns, filters,
 * pagination, sorting, and more.
 *
 * The function provides a clean, adapter-agnostic API that works consistently
 * whether you're using Drizzle, Prisma, a REST API, or any other data source.
 *
 * @template TRecord - The record type for table rows (auto-inferred from adapter)
 *
 * @param config - Configuration object with adapter and optional settings
 * @returns A fully configured Better Tables instance
 *
 * @example
 * ```typescript
 * // With Drizzle adapter
 * import { betterTables } from '@better-tables/core';
 * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
 *
 * const tables = betterTables({
 *   database: drizzleAdapter(db),
 *   columns: [
 *     { id: 'name', displayName: 'Name', type: 'text' },
 *     { id: 'email', displayName: 'Email', type: 'text' }
 *   ],
 *   pagination: { page: 1, limit: 20 }
 * });
 *
 * // Use the adapter directly
 * const result = await tables.adapter.fetchData({
 *   columns: ['name', 'email'],
 *   pagination: { page: 1, limit: 20 }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With future Prisma adapter
 * import { betterTables } from '@better-tables/core';
 * import { prismaAdapter } from '@better-tables/adapters-prisma';
 *
 * const tables = betterTables({
 *   database: prismaAdapter(prisma.user)
 * });
 * ```
 */
export function betterTables<TRecord = unknown>(
  config: BetterTablesConfig<TRecord>
): BetterTablesInstance<TRecord> {
  // Store the configuration with defaults
  const initialColumns = config.columns ?? [];
  let currentConfig: BetterTablesConfig<TRecord> = {
    ...config,
    columns: initialColumns,
  };

  // Return the instance with methods
  return {
    // Use getter/setter to always reflect current adapter and allow writes
    get adapter(): TableAdapter<TRecord> {
      return currentConfig.database;
    },

    set adapter(value: TableAdapter<TRecord>) {
      currentConfig.database = value;
    },

    // Use getter/setter to always reflect current columns and allow writes
    get columns(): ColumnDefinition<TRecord>[] {
      return currentConfig.columns ?? [];
    },

    set columns(value: ColumnDefinition<TRecord>[]) {
      currentConfig.columns = value ?? [];
    },

    getConfig() {
      return { ...currentConfig };
    },

    updateConfig(updates: Partial<BetterTablesConfig<TRecord>>) {
      const updatedColumns = updates.columns ?? currentConfig.columns ?? [];
      currentConfig = {
        ...currentConfig,
        ...updates,
        // Preserve existing values if not provided in updates
        columns: updatedColumns,
      };
    },
  };
}

/**
 * Type helper to extract the record type from an adapter.
 *
 * @template TAdapter - The adapter type
 *
 * @example
 * ```typescript
 * type MyAdapter = typeof myAdapter;
 * type MyRecord = ExtractAdapterRecord<MyAdapter>;
 * ```
 */
export type ExtractAdapterRecord<TAdapter> = TAdapter extends {
  // biome-ignore lint/suspicious/noExplicitAny: Generic function signature for type extraction
  fetchData: (...args: any[]) => Promise<{ data: Array<infer TData> }>;
}
  ? TData
  : unknown;
