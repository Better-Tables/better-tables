'use client';

import * as React from 'react';
import type { ColumnDefinition, FilterState } from '@better-tables/core';

export interface BooleanFilterInputProps<TData = any> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: any[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function BooleanFilterInput<TData = any>({
  filter,
  column,
  onChange,
  disabled = false,
}: BooleanFilterInputProps<TData>) {
  // Boolean filters with value-based operators don't need inputs
  // since the operator itself defines the value (isTrue, isFalse, isNull, isNotNull)
  
  React.useEffect(() => {
    // Set the appropriate value based on the operator
    switch (filter.operator) {
      case 'isTrue':
        onChange([true]);
        break;
      case 'isFalse':
        onChange([false]);
        break;
      case 'isNull':
      case 'isNotNull':
        onChange([]);
        break;
      default:
        onChange([]);
    }
  }, [filter.operator, onChange]);
  
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