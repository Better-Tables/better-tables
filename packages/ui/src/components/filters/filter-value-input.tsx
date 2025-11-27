'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { IncludeUnknownControl, useIncludeUnknownControl } from './include-unknown-control';
import { BooleanFilterInput } from './inputs/boolean-filter-input';
import { DateFilterInput } from './inputs/date-filter-input';
import { MultiOptionFilterInput } from './inputs/multi-option-filter-input';
import { NumberFilterInput } from './inputs/number-filter-input';
import { OptionFilterInput } from './inputs/option-filter-input';
import { TextFilterInput } from './inputs/text-filter-input';

export interface FilterValueInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Include null change handler */
  onIncludeNullChange?: (includeNull: boolean) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function FilterValueInput<TData = unknown>({
  filter,
  column,
  onChange,
  onIncludeNullChange,
  disabled = false,
}: FilterValueInputProps<TData>) {
  // Check if we should show the include unknown control
  const shouldShowIncludeUnknown = useIncludeUnknownControl(filter, column);

  // Get the appropriate input component based on column type
  const getInputComponent = () => {
    // Check if column has a custom filter component
    if (column.filter?.customComponent) {
      const CustomComponent = column.filter.customComponent;
      // Create a typed onChange handler that matches FilterComponentProps signature
      const handleCustomChange = (value: unknown[]) => {
        // Flatten nested arrays - if value is string[][], flatten to string[]
        // This handles the case where custom components pass nested arrays due to type inference
        const flattenedValue = Array.isArray(value) && value.length > 0 && Array.isArray(value[0])
          ? (value as unknown as string[][]).flat()
          : value;
        onChange(flattenedValue);
      };
      return (
        <CustomComponent
          value={(filter.values || []) as unknown[]}
          onChange={handleCustomChange}
          operator={filter.operator}
          column={column as ColumnDefinition<unknown, unknown>}
        />
      );
    }

    // Fall back to default type-based components
    switch (column.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <TextFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <NumberFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      case 'date':
        return (
          <DateFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      case 'boolean':
        return (
          <BooleanFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      case 'option':
        return (
          <OptionFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      case 'multiOption':
        return (
          <MultiOptionFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      case 'json':
        // For JSON, use text input for now
        return (
          <TextFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );

      default:
        // Fallback to text input
        return (
          <TextFilterInput
            filter={filter}
            column={column}
            onChange={onChange}
            disabled={disabled}
          />
        );
    }
  };

  // If we don't need to show the include unknown control, just return the input
  if (!shouldShowIncludeUnknown) {
    return getInputComponent();
  }

  // Render both the input component and the include unknown control
  return (
    <div className="space-y-4">
      {getInputComponent()}

      {shouldShowIncludeUnknown && onIncludeNullChange && (
        <IncludeUnknownControl
          filter={filter}
          column={column}
          onChange={onIncludeNullChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
