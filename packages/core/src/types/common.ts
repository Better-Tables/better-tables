import type { ComponentType } from 'react';

/**
 * Base configuration for any configurable component
 */
export interface BaseConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name?: string;
  /** Additional metadata */
  meta?: Record<string, any>;
}

/**
 * Theme configuration for table components
 */
export interface TableTheme {
  /** Theme name */
  name?: string;
  /** CSS class name to apply */
  className?: string;
  /** Color definitions */
  colors?: {
    primary?: string;
    secondary?: string;
    success?: string;
    warning?: string;
    error?: string;
    [key: string]: string | undefined;
  };
  /** Component-specific theme overrides */
  components?: {
    table?: Record<string, any>;
    filter?: Record<string, any>;
    pagination?: Record<string, any>;
    [key: string]: Record<string, any> | undefined;
  };
}

/**
 * Icon component type
 */
export type IconComponent = ComponentType<{ className?: string; size?: number }>;

/**
 * Render props for custom components
 * @template TData - The type of row data
 * @template TValue - The type of cell value
 * @template TColumn - The type of column definition
 */
export interface RenderProps<TData = any, TValue = any, TColumn = any> {
  /** Current row data */
  row: TData;
  /** Current cell value */
  value: TValue;
  /** Column definition */
  column: TColumn;
  /** Row index */
  rowIndex: number;
  /** Table instance */
  table?: any; // Will be TableInstance
}

/**
 * Event handler types
 */
export type EventHandler<T = void> = (event: T) => void | Promise<void>;

/**
 * Data event for real-time updates
 */
export interface DataEvent<TData = any> {
  /** Event type */
  type: 'insert' | 'update' | 'delete';
  /** Affected data */
  data: TData | TData[];
  /** Additional event metadata */
  meta?: Record<string, any>;
} 