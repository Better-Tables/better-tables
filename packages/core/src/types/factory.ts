/**
 * @fileoverview Factory types for Better Tables
 * @module @better-tables/core/types/factory
 *
 * @description
 * Type definitions for the betterTables() factory function and related configuration.
 */

import type { TableAdapter } from './adapter';
import type { ColumnDefinition } from './column';
import type { FilterState } from './filter';
import type { PaginationState } from './pagination';
import type { SelectionState } from './selection';
import type { SortingState } from './sorting';
import type { VirtualizationConfig } from './virtualization';

/**
 * Configuration options for the betterTables() factory function.
 *
 * @template TRecord - The record type for table rows
 *
 * @description
 * Defines the complete configuration for creating a Better Tables instance,
 * including the data adapter, column definitions, and initial state.
 */
export interface BetterTablesConfig<TRecord = unknown> {
  /**
   * The data adapter that provides data fetching and mutation capabilities.
   * Can be any adapter implementing the TableAdapter interface.
   *
   * @example
   * ```typescript
   * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
   * import { prismaAdapter } from '@better-tables/adapters-prisma';
   *
   * // With Drizzle
   * const config = { database: drizzleAdapter(db) };
   *
   * // With Prisma
   * const config = { database: prismaAdapter(prisma) };
   * ```
   */
  database: TableAdapter<TRecord>;

  /**
   * Column definitions for the table.
   * Optional - can be configured later.
   */
  columns?: ColumnDefinition<TRecord>[];

  /**
   * Initial filter state.
   */
  filters?: FilterState[];

  /**
   * Initial pagination state.
   */
  pagination?: PaginationState;

  /**
   * Initial sorting state.
   */
  sorting?: SortingState[];

  /**
   * Initial selection state.
   */
  selection?: SelectionState;

  /**
   * Virtualization configuration.
   */
  virtualization?: VirtualizationConfig;

  /**
   * Additional adapter-specific options.
   */
  options?: Record<string, unknown>;
}

/**
 * Return type for the betterTables() factory function.
 *
 * @template TRecord - The record type for table rows
 *
 * @description
 * Represents a fully configured Better Tables instance with all
 * managers and utilities available.
 */
export interface BetterTablesInstance<TRecord = unknown> {
  /**
   * The configured data adapter.
   */
  adapter: TableAdapter<TRecord>;

  /**
   * Column definitions.
   */
  columns: ColumnDefinition<TRecord>[];

  /**
   * Get the current table configuration.
   */
  getConfig(): BetterTablesConfig<TRecord>;

  /**
   * Update the configuration.
   */
  updateConfig(config: Partial<BetterTablesConfig<TRecord>>): void;
}
