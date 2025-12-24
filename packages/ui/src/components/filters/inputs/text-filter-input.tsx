'use client';

import {
  type ColumnDefinition,
  type FilterState,
  getFilterValueAsString,
} from '@better-tables/core';
import * as React from 'react';
import { useFilterValidation } from '../../../hooks/use-filter-validation';
import { cn } from '../../../lib/utils';
import { Input } from '../../ui/input';

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
 * - Updates sent to parent only on blur or Enter key press
 * - Syncs from parent only when not actively typing
 */
export function TextFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: TextFilterInputProps<TData>) {
  // Ref for the input element to enable auto-focus
  const inputRef = React.useRef<HTMLInputElement>(null);

  // UI-only state: what user sees while typing
  const [localValue, setLocalValue] = React.useState(() => {
    return getFilterValueAsString(filter, 0) || '';
  });

  // Track if user is actively typing (prevents external sync during interaction)
  const [isUserTyping, setIsUserTyping] = React.useState(false);

  // Auto-focus when filter is empty (newly added filter)
  React.useEffect(() => {
    if (!localValue && inputRef.current && !disabled) {
      // Use setTimeout to ensure the input is visible (e.g., in a Popover/Dialog)
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [localValue, disabled]);

  // Store onChange in ref to prevent effect dependencies
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Validate the current value (no debounce needed for validation)
  const validation = useFilterValidation({
    filter,
    column,
    values: localValue ? [localValue] : [],
    immediate: !!localValue,
  });

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

  // Commit the value to parent when user is done editing
  const commitValue = React.useCallback(() => {
    onChangeRef.current(localValue ? [localValue] : []);
    setIsUserTyping(false);
  }, [localValue]);

  // Handle blur - commit the value
  const handleBlur = () => {
    commitValue();
  };

  // Handle Enter key - commit the value
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitValue();
    }
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
        ref={inputRef}
        id={`value-${filter.columnId}`}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
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
