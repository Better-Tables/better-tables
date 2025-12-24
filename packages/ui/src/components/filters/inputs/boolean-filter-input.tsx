'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import * as React from 'react';

export interface BooleanFilterInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Boolean filter input component
 *
 * Pattern: Purely controlled component (no local state needed)
 * - Values are determined by the operator
 * - Sends appropriate values when operator changes
 * - No user input required - operator defines the value
 */
export function BooleanFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: BooleanFilterInputProps<TData>) {
  // Store onChange in ref to prevent effect dependencies
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Set the appropriate value based on the operator
  // Only run when operator changes
  React.useEffect(() => {
    switch (filter.operator) {
      case 'isTrue':
        onChangeRef.current([true]);
        break;
      case 'isFalse':
        onChangeRef.current([false]);
        break;
      case 'isNull':
      case 'isNotNull':
        onChangeRef.current([]);
        break;
      default:
        onChangeRef.current([]);
    }
  }, [filter.operator]);

  const getDescription = () => {
    switch (filter.operator) {
      case 'isTrue':
        return `${column.displayName} is true`;
      case 'isFalse':
        return `${column.displayName} is false`;
      case 'isNull':
        return `${column.displayName} is null or undefined`;
      case 'isNotNull':
        return `${column.displayName} is not null and not undefined`;
      default:
        return 'Boolean filter';
    }
  };

  return (
    <div className={`text-sm text-muted-foreground ${disabled ? 'opacity-50' : ''}`}>
      {getDescription()}
    </div>
  );
}
