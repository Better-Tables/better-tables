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

/**
 * Text filter input component
 *
 * Pattern: Controlled component with local UI state
 * - Data state (filter.values) comes from parent (TableStateManager)
 * - UI state (local input value, typing status) managed locally
 * - Debounced updates sent back to parent
 * - Syncs from parent only when not actively typing
 */
export function TextFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: TextFilterInputProps<TData>) {
  // UI-only state: what user sees while typing
  const [localValue, setLocalValue] = React.useState(() => {
    return getFilterValueAsString(filter, 0) || '';
  });

  // Track if user is actively typing (prevents external sync during interaction)
  const [isUserTyping, setIsUserTyping] = React.useState(false);

  // Store onChange in ref to prevent effect dependencies
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounce the value to avoid excessive updates
  const debounceMs = column.filter?.debounce ?? 500;
  const debouncedValue = useDebounce(localValue, debounceMs);

  // Validate the current value
  const validation = useFilterValidation({
    filter,
    column,
    values: debouncedValue ? [debouncedValue] : [],
    immediate: !!debouncedValue,
  });

  // Sync TO parent when debounced value changes
  React.useEffect(() => {
    // Send update to parent
    onChangeRef.current(debouncedValue ? [debouncedValue] : []);

    // Mark typing as complete
    setIsUserTyping(false);
  }, [debouncedValue]);

  // Sync FROM parent when filter values change (only if not typing)
  // Use the actual value from filter, not a stringified key
  const externalValue = getFilterValueAsString(filter, 0) || '';

  React.useEffect(() => {
    if (!isUserTyping && externalValue !== localValue) {
      setLocalValue(externalValue);
    }
  }, [externalValue, isUserTyping, localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUserTyping(true);
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
