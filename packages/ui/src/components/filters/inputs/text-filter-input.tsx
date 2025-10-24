'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useFilterValidation } from '@/hooks/use-filter-validation';
import { getFilterValueAsString } from '@/lib/filter-value-utils';
import { cn } from '@/lib/utils';

export interface TextFilterInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function TextFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: TextFilterInputProps<TData>) {
  const [localValue, setLocalValue] = React.useState(() => {
    const value = getFilterValueAsString(filter, 0);
    return value || '';
  });

  // Debounce the onChange to avoid excessive updates
  const debounceMs = column.filter?.debounce ?? 300;
  const debouncedValue = useDebounce(localValue, debounceMs);

  // Validate the current values
  const validation = useFilterValidation({
    filter,
    column,
    values: debouncedValue ? [debouncedValue] : [],
    immediate: !!debouncedValue, // Only validate if there's a value
  });

  // Update parent when debounced value changes (only if valid)
  React.useEffect(() => {
    if (debouncedValue !== filter.values[0]) {
      onChange(debouncedValue ? [debouncedValue] : []);
    }
  }, [debouncedValue, onChange, filter.values]);

  // Sync local value when filter values change externally
  React.useEffect(() => {
    const newValue = getFilterValueAsString(filter, 0) || '';
    if (newValue !== localValue) {
      setLocalValue(newValue);
    }
  }, [filter.values, filter, localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const placeholder = React.useMemo(() => {
    switch (filter.operator) {
      case 'contains':
        return `Text that ${column.displayName} contains...`;
      case 'equals':
        return `Exact ${column.displayName} value...`;
      case 'startsWith':
        return `Text that ${column.displayName} starts with...`;
      case 'endsWith':
        return `Text that ${column.displayName} ends with...`;
      default:
        return `Enter ${column.displayName}...`;
    }
  }, [filter.operator, column.displayName]);

  // For operators that don't need values
  if (filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty') {
    return (
      <div className="text-sm text-muted-foreground">This filter doesn't require a value.</div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`value-${filter.columnId}`} className="text-sm font-medium">
        Value
      </label>
      <Input
        id={`value-${filter.columnId}`}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'w-full',
          !validation.isValid && localValue && 'border-destructive focus-visible:ring-destructive'
        )}
        disabled={disabled}
      />
      {!validation.isValid && validation.error && localValue && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
