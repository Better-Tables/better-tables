import { ColumnBuilder } from './column-builder';
import { TextColumnBuilder } from './text-column-builder';
import { NumberColumnBuilder } from './number-column-builder';
import { DateColumnBuilder } from './date-column-builder';
import { OptionColumnBuilder } from './option-column-builder';
import { MultiOptionColumnBuilder } from './multi-option-column-builder';
import { BooleanColumnBuilder } from './boolean-column-builder';

/**
 * Column factory interface for type-safe column creation
 */
export interface ColumnFactory<TData = any> {
  /** Create a text column builder */
  text(): TextColumnBuilder<TData>;
  
  /** Create a number column builder */
  number(): NumberColumnBuilder<TData>;
  
  /** Create a date column builder */
  date(): DateColumnBuilder<TData>;
  
  /** Create a boolean column builder */
  boolean(): BooleanColumnBuilder<TData>;
  
  /** Create an option (single-select) column builder */
  option(): OptionColumnBuilder<TData>;
  
  /** Create a multi-option (multi-select) column builder */
  multiOption(): MultiOptionColumnBuilder<TData>;
  
  /** Create a custom column builder for special types */
  custom<TValue = any>(type: 'json' | 'custom'): ColumnBuilder<TData, TValue>;
}

/**
 * Create a column factory for building type-safe columns
 * 
 * @example
 * ```typescript
 ** // Create a column factory for a Contact type
 * const cb = createColumnBuilder<Contact>();
 * 
 ** // Build columns using the fluent API
 * const columns = [
 *   cb.text()
 *     .id('name')
 *     .displayName('Full Name')
 *     .accessor(contact => `${contact.firstName} ${contact.lastName}`)
 *     .searchable()
 *     .build(),
 *     
 *   cb.number()
 *     .id('age')
 *     .displayName('Age')
 *     .accessor(contact => contact.age)
 *     .range(0, 120)
 *     .build(),
 *     
 *   cb.option()
 *     .id('status')
 *     .displayName('Status')
 *     .accessor(contact => contact.status)
 *     .options([
 *       { value: 'active', label: 'Active', color: 'green' },
 *       { value: 'inactive', label: 'Inactive', color: 'red' },
 *     ])
 *     .build(),
 * ];
 * ```
 */
export function createColumnBuilder<TData = any>(): ColumnFactory<TData> {
  return {
    text: () => new TextColumnBuilder<TData>(),
    number: () => new NumberColumnBuilder<TData>(),
    date: () => new DateColumnBuilder<TData>(),
    boolean: () => new BooleanColumnBuilder<TData>(),
    option: () => new OptionColumnBuilder<TData>(),
    multiOption: () => new MultiOptionColumnBuilder<TData>(),
    custom: <TValue = any>(type: 'json' | 'custom') => new ColumnBuilder<TData, TValue>(type),
  };
}

/**
 * Global column factory function (not type-safe)
 * Use this when you don't have a specific data type or need flexibility
 * 
 * @example
 * ```typescript
 ** // Create columns without type safety
 * const columns = [
 *   column.text()
 *     .id('name')
 *     .displayName('Name')
 *     .accessor(data => data.name)
 *     .searchable()
 *     .build(),
 * ];
 * ```
 */
export const column = createColumnBuilder();

/**
 * Utility function to create a column builder with explicit type
 * 
 * @example
 * ```typescript
 ** // Create a typed column builder
 * const cb = createTypedColumnBuilder<User>();
 * 
 * // Or use the shorter alias
 * const cb = typed<User>();
 * ```
 */
export function createTypedColumnBuilder<TData>(): ColumnFactory<TData> {
  return createColumnBuilder<TData>();
}

/**
 * Shorter alias for createTypedColumnBuilder
 */
export const typed = createTypedColumnBuilder;

/**
 * Utility function to create multiple column builders at once
 * 
 * @example
 * ```typescript
 ** // Create multiple column builders
 * const { users, orders, products } = createColumnBuilders({
 *   users: {} as User,
 *   orders: {} as Order,
 *   products: {} as Product,
 * });
 * 
 ** // Now you can use them independently
 * const userColumns = [
 *   users.text().id('name').displayName('Name').build(),
 * ];
 * 
 * const orderColumns = [
 *   orders.number().id('total').displayName('Total').build(),
 * ];
 * ```
 */
export function createColumnBuilders<T extends Record<string, any>>(
  types: T
): { [K in keyof T]: ColumnFactory<T[K]> } {
  const result = {} as { [K in keyof T]: ColumnFactory<T[K]> };
  
  for (const key in types) {
    result[key] = createColumnBuilder<T[typeof key]>();
  }
  
  return result;
}

/**
 * Utility function to validate column definitions
 * 
 * @example
 * ```typescript
 * const cb = createColumnBuilder<Contact>();
 * 
 * const columns = [
 *   cb.text().id('name').displayName('Name').accessor(c => c.name).build(),
 *   cb.number().id('age').displayName('Age').accessor(c => c.age).build(),
 * ];
 * 
 ** // Validate all columns
 * const validation = validateColumns(columns);
 * if (!validation.valid) {
 *   console.error('Column validation errors:', validation.errors);
 * }
 * ```
 */
export function validateColumns(columns: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const usedIds = new Set<string>();
  
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    
    // Check required fields
    if (!column.id) {
      errors.push(`Column at index ${i} is missing required 'id' field`);
    }
    
    if (!column.displayName) {
      errors.push(`Column at index ${i} is missing required 'displayName' field`);
    }
    
    if (!column.accessor) {
      errors.push(`Column at index ${i} is missing required 'accessor' field`);
    }
    
    if (!column.type) {
      errors.push(`Column at index ${i} is missing required 'type' field`);
    }
    
    // Check for duplicate IDs
    if (column.id && usedIds.has(column.id)) {
      errors.push(`Duplicate column ID '${column.id}' found at index ${i}`);
    } else if (column.id) {
      usedIds.add(column.id);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Utility function to create a column definition with minimal configuration
 * Useful for rapid prototyping or simple use cases
 * 
 * @example
 * ```typescript
 ** // Quick column creation
 * const columns = [
 *   quickColumn('name', 'Name', data => data.name),
 *   quickColumn('email', 'Email', data => data.email, { type: 'email' }),
 *   quickColumn('age', 'Age', data => data.age, { type: 'number' }),
 * ];
 * ```
 */
export function quickColumn<TData, TValue = any>(
  id: string,
  displayName: string,
  accessor: (data: TData) => TValue,
  options: {
    type?: 'text' | 'number' | 'date' | 'boolean' | 'option' | 'multiOption' | 'email' | 'url' | 'phone';
    sortable?: boolean;
    filterable?: boolean;
    width?: number;
  } = {}
) {
  const { type = 'text', sortable = true, filterable = true, width } = options;
  
  const builder = new ColumnBuilder<TData, TValue>(type);
  
  const column = builder
    .id(id)
    .displayName(displayName)
    .accessor(accessor)
    .sortable(sortable)
    .filterable(filterable);
    
  if (width) {
    column.width(width);
  }
  
  return column.build();
} 