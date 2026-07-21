/**
 * @fileoverview Common types and interfaces used throughout the core package.
 *
 * This module provides foundational types for configuration, theming, rendering,
 * and event handling that are shared across all table components and managers.
 *
 * @module types/common
 */

import type { ComponentType } from 'react';

/**
 * Base configuration interface for any configurable component.
 *
 * Provides a common structure for components that need identification,
 * naming, and metadata storage.
 *
 * @example
 * ```typescript
 * const config: BaseConfig = {
 *   id: 'user-table',
 *   name: 'User Management Table',
 *   meta: { version: '1.0.0' }
 * };
 * ```
 */
export interface BaseConfig {
  /** Unique identifier for the component */
  id: string;
  /** Human-readable display name */
  name?: string;
  /** Additional metadata for extensibility */
  meta?: Record<string, unknown>;
}

/**
 * Icon component type definition.
 *
 * Standardizes the interface for icon components used throughout the table,
 * ensuring consistent props and styling capabilities.
 *
 * @example
 * ```typescript
 * const SortIcon: IconComponent = ({ className, size = 16 }) => (
 *   <svg className={className} width={size} height={size}>
 *     <path d="M7 14l5-5-5-5" />
 *   </svg>
 * );
 * ```
 */
export type IconComponent = ComponentType<{
  /** CSS class name for styling */
  className?: string;
  /** Icon size in pixels */
  size?: number;
}>;

/**
 * Render props interface for custom components.
 *
 * Provides all necessary context for custom cell and header renderers,
 * including row data, column information, and table state.
 *
 * @template TData - The type of row data
 * @template TValue - The type of cell value
 * @template TColumn - The type of column definition
 *
 * @example
 * ```typescript
 * const CustomCell: React.FC<RenderProps<User, string, ColumnDefinition<User>>> = ({
 *   row,
 *   value,
 *   column,
 *   rowIndex
 * }) => (
 *   <div className="custom-cell">
 *     {value} (Row {rowIndex})
 *   </div>
 * );
 * ```
 */
export interface RenderProps<TData = unknown, TValue = unknown, TColumn = unknown> {
  /** Current row data object */
  row: TData;
  /** Current cell value extracted by column accessor */
  value: TValue;
  /** Column definition containing metadata and configuration */
  column: TColumn;
  /** Zero-based index of the current row */
  rowIndex: number;
  /** Table instance for accessing table state and methods */
  table?: Record<string, unknown>; // Will be TableInstance
}

/**
 * Generic event handler type definition.
 *
 * Supports both synchronous and asynchronous event handling for
 * table events like sorting, filtering, and data changes.
 *
 * @template T - The type of event data
 *
 * @example
 * ```typescript
 * const handleSort: EventHandler<SortEvent> = async (event) => {
 *   console.log('Sort changed:', event);
 *   await updateTableData();
 * };
 * ```
 */
export type EventHandler<T = void> = (event: T) => void | Promise<void>;

/**
 * Data event interface for real-time updates.
 *
 * Used by adapters to notify the table of data changes,
 * enabling reactive updates and synchronization.
 *
 * @template TData - The type of data being updated
 *
 * @example
 * ```typescript
 * const dataEvent: DataEvent<User> = {
 *   type: 'update',
 *   data: { id: '1', name: 'John Doe', email: 'john@example.com' },
 *   meta: { timestamp: Date.now(), source: 'api' }
 * };
 * ```
 */
export interface DataEvent<TData = unknown> {
  /** Type of data operation performed */
  type: 'insert' | 'update' | 'delete';
  /** The affected data item(s) */
  data: TData | TData[];
  /** Additional event metadata for context */
  meta?: Record<string, unknown>;
}
