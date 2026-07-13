'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import * as React from 'react';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

export interface BooleanFilterInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Operator change handler */
  onOperatorChange?: (operator: FilterState['operator']) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function BooleanFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  onOperatorChange,
  disabled = false,
}: BooleanFilterInputProps<TData>) {
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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

  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';

  if (needsNoValues) {
    return (
      <div className={`text-sm text-muted-foreground ${disabled ? 'opacity-50' : ''}`}>
        {filter.operator === 'isNull'
          ? `${column.displayName} is empty or undefined`
          : `${column.displayName} has a value`}
      </div>
    );
  }

  const currentValue =
    filter.operator === 'isTrue' ? 'true' : filter.operator === 'isFalse' ? 'false' : '';

  const handleValueChange = (value: string) => {
    if (!value || disabled) return;
    if (value === 'true') {
      onOperatorChange?.('isTrue');
      onChange([true]);
      return;
    }
    onOperatorChange?.('isFalse');
    onChange([false]);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Value for {column.displayName}</p>
      <ToggleGroup
        value={currentValue ? [currentValue] : []}
        onValueChange={(values: string[]) => handleValueChange(values[0] ?? '')}
        disabled={disabled}
        variant="outline"
        size="sm"
        spacing={0}
        className="w-full"
      >
        <ToggleGroupItem value="true" className="flex-1">
          True
        </ToggleGroupItem>
        <ToggleGroupItem value="false" className="flex-1">
          False
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
