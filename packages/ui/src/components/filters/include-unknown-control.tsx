'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { HelpCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

export interface IncludeUnknownControlProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Callback when includeNull changes */
  onChange: (includeNull: boolean) => void;
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function IncludeUnknownControl<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
  className,
}: IncludeUnknownControlProps<TData>) {
  // Get appropriate label and description based on column type
  const { label, description } = React.useMemo(() => {
    switch (column.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return {
          label: 'Include empty values',
          description: 'Include records where this field is empty',
        };
      case 'number':
      case 'currency':
      case 'percentage':
        return {
          label: 'Include missing values',
          description: 'Include records where this field has no value',
        };
      case 'date':
        return {
          label: 'Include missing dates',
          description: 'Include records where this field is not set',
        };
      case 'boolean':
        return {
          label: 'Include unknown values',
          description: 'Include records where this field is not true or false',
        };
      case 'option':
        return {
          label: 'Include unassigned values',
          description: 'Include records where no option has been selected',
        };
      case 'multiOption':
        return {
          label: 'Include empty selections',
          description: 'Include records where no options have been selected',
        };
      case 'json':
        return {
          label: 'Include empty JSON',
          description: 'Include records where this field is empty or null',
        };
      default:
        return {
          label: 'Include null values',
          description: 'Include records where this field is null or undefined',
        };
    }
  }, [column.type]);

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      onChange(checked);
    },
    [onChange]
  );

  // Check if the column/filter is configured to include null values
  const columnAllowsNull = column.filter?.includeNull ?? false;

  // Don't show checkbox for isNull/isNotNull operators (they already handle null)
  const isNullOperator = filter.operator === 'isNull' || filter.operator === 'isNotNull';

  // Don't render if column doesn't allow it or if operator already handles null
  if (!columnAllowsNull || isNullOperator) {
    return null;
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`include-null-${filter.columnId}`}
          checked={filter.includeNull ?? false}
          onCheckedChange={handleCheckedChange}
          disabled={disabled}
        />
        <Label
          htmlFor={`include-null-${filter.columnId}`}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </Label>
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Hook to check if a filter should show the include unknown control
 */
export function useIncludeUnknownControl<TData = unknown>(
  filter: FilterState,
  column: ColumnDefinition<TData>
): boolean {
  return React.useMemo(() => {
    // Check if the column/filter is configured to include null values
    const columnAllowsNull = column.filter?.includeNull ?? false;

    // Don't show checkbox for isNull/isNotNull operators (they already handle null)
    const isNullOperator = filter.operator === 'isNull' || filter.operator === 'isNotNull';

    return columnAllowsNull && !isNullOperator;
  }, [filter.operator, column.filter?.includeNull]);
}

/**
 * Get the appropriate label for the include unknown control based on column type
 */
export function getIncludeUnknownLabel(columnType: string): string {
  switch (columnType) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return 'Include empty values';
    case 'number':
    case 'currency':
    case 'percentage':
      return 'Include missing values';
    case 'date':
      return 'Include missing dates';
    case 'boolean':
      return 'Include unknown values';
    case 'option':
      return 'Include unassigned values';
    case 'multiOption':
      return 'Include empty selections';
    case 'json':
      return 'Include empty JSON';
    default:
      return 'Include null values';
  }
}

/**
 * Get the appropriate description for the include unknown control based on column type
 */
export function getIncludeUnknownDescription(columnType: string): string {
  switch (columnType) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return 'Include records where this field is empty';
    case 'number':
    case 'currency':
    case 'percentage':
      return 'Include records where this field has no value';
    case 'date':
      return 'Include records where this field is not set';
    case 'boolean':
      return 'Include records where this field is not true or false';
    case 'option':
      return 'Include records where no option has been selected';
    case 'multiOption':
      return 'Include records where no options have been selected';
    case 'json':
      return 'Include records where this field is empty or null';
    default:
      return 'Include records where this field is null or undefined';
  }
}
