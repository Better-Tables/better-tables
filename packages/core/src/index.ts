/**
 * @fileoverview Main package export for the Better Tables Core library.
 *
 * This module provides the primary entry point for the Better Tables Core library,
 * exporting all builders, managers, types, and utilities needed to create powerful,
 * performant, and customizable data tables.
 *
 * The library is organized into these main modules:
 * - **Builders**: Fluent API for creating column definitions
 * - **Managers**: State management for filters, pagination, sorting, selection, and virtualization
 * - **Plugins**: Core-tier data hooks (`beforeFetch`/`afterFetch`) for `betterTables({ plugins })`
 * - **Types**: TypeScript definitions for all table-related interfaces and types
 * - **Utils**: Utility functions for common operations
 *
 * @module core
 *
 * @example
 * ```typescript
 * import { betterTables, defineTable } from '@better-tables/core';
 * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
 *
 * export const tables = betterTables({
 *   database: drizzleAdapter(db),
 *   defaults: { pageSize: 20 },
 * });
 *
 * export const ticketsTable = defineTable<typeof tables>()('tickets', (t) => ({
 *   columns: [
 *     t.text('subject').searchable().filterable().sortable(),
 *     t.option('status').filterable(),
 *     t.text('customer.company').displayName('Customer').filterable(),
 *   ],
 * }));
 *
 * const result = await tables.fetchData(ticketsTable, {
 *   pagination: { page: 1, limit: 20 },
 *   sorting: [{ columnId: 'createdAt', direction: 'desc' }],
 * });
 * ```
 *
 * For hand-built columns without a schema (client-only tables, tests), use
 * `memoryAdapter` + `defineTableRow`, or collect direct builder-class output
 * with `defineColumns` — see the Custom Adapters and Columns docs.
 */

// Adapters (HTTP transport)
export * from './adapters';
// Builders
export * from './builders';
// Factory
export * from './factory';
// Lib utilities
export * from './lib';
// Managers
export * from './managers';
// Plugins (core-tier hooks)
export * from './plugins';
// Stores
export * from './stores';
// Types
export * from './types';
// Utils
export * from './utils';
