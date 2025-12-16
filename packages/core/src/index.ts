/**
 * @fileoverview Main package export for the Better Tables Core library.
 *
 * This module provides the primary entry point for the Better Tables Core library,
 * exporting all builders, managers, types, and utilities needed to create powerful,
 * performant, and customizable data tables.
 *
 * The library is organized into four main modules:
 * - **Builders**: Fluent API for creating column definitions
 * - **Managers**: State management for filters, pagination, sorting, selection, and virtualization
 * - **Types**: TypeScript definitions for all table-related interfaces and types
 * - **Utils**: Utility functions for common operations
 *
 * @module core
 * @version 1.0.0
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * import {
 *   // Column builders
 *   TextColumnBuilder,
 *   NumberColumnBuilder,
 *   DateColumnBuilder,
 *   BooleanColumnBuilder,
 *   OptionColumnBuilder,
 *   MultiOptionColumnBuilder,
 *   ColumnBuilder,
 *
 *   // Column factory utilities
 *   createColumnBuilder,
 *   column,
 *   typed,
 *
 *   // State managers
 *   TableStateManager,
 *   FilterManager,
 *   PaginationManager,
 *   SortingManager,
 *   SelectionManager,
 *   VirtualizationManager,
 *
 *   // Types
 *   type ColumnDefinition,
 *   type FilterState,
 *   type PaginationState,
 *   type SortingState,
 *   type SelectionState,
 *   type VirtualizationConfig,
 *   type TableConfig,
 *
 *   // Utilities
 *   deepEqual,
 *   shallowEqualArrays,
 *   serializeFiltersToURL,
 *   deserializeFiltersFromURL
 * } from '@/index';
 *
 * // Create a table with comprehensive functionality
 * const columns = [
 *   new TextColumnBuilder<User>()
 *     .id('name')
 *     .displayName('Full Name')
 *     .accessor(user => `${user.firstName} ${user.lastName}`)
 *     .sortable()
 *     .filterable()
 *     .build(),
 *
 *   new NumberColumnBuilder<User>()
 *     .id('age')
 *     .displayName('Age')
 *     .accessor(user => user.age)
 *     .range(0, 120)
 *     .build(),
 *
 *   new DateColumnBuilder<User>()
 *     .id('createdAt')
 *     .displayName('Created')
 *     .accessor(user => user.createdAt)
 *     .format('MMM dd, yyyy')
 *     .build()
 * ];
 *
 * // Initialize state management
 * const tableStateManager = new TableStateManager<User>(columns, {
 *   filters: [],
 *   pagination: { page: 1, limit: 20 },
 *   sorting: [],
 *   selectedRows: new Set()
 * });
 *
 * // Subscribe to state changes
 * const unsubscribe = tableStateManager.subscribe((event) => {
 *   console.log('Table state changed:', event);
 * });
 * ```
 */

// Builders
export * from './builders';
// Factory
export * from './factory';
// Lib utilities
export * from './lib';
// Managers
export * from './managers';
// Types
export * from './types';
// Utils
export * from './utils';
