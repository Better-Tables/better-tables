'use client';

import type { ColumnDefinition, FilterOperator } from '@better-tables/core';
import { getOperatorsForType } from '@better-tables/core';
import * as React from 'react';
import { useId } from 'react';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

export interface FilterOperatorSelectProps<TData = unknown> {
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Current operator value */
  value: FilterOperator;
  /** Change handler */
  onChange: (operator: FilterOperator) => void;
  /** Whether the select is disabled */
  disabled?: boolean;
}

export function FilterOperatorSelect<TData = unknown>({
  column,
  value,
  onChange,
  disabled = false,
}: FilterOperatorSelectProps<TData>) {
  const id = useId();

  // Get available operators for this column type
  const customOperators = column.filter?.operators;
  const operators = React.useMemo(() => {
    const availableOperators = getOperatorsForType(column.type);

    // If column has custom operators defined, use those instead
    if (customOperators && customOperators.length > 0) {
      return availableOperators.filter((op) => customOperators.includes(op.key));
    }

    return availableOperators;
  }, [column.type, customOperators]);

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      onChange(newValue as FilterOperator);
    },
    [onChange]
  );

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Operator</Label>
      <RadioGroup
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        className="gap-4"
      >
        {operators.map((operator) => (
          <div key={operator.key} className="flex items-start gap-2">
            <RadioGroupItem
              value={operator.key}
              id={`${id}-${operator.key}`}
              aria-describedby={
                operator.description ? `${id}-${operator.key}-description` : undefined
              }
              disabled={disabled}
              className="cursor-pointer mt-1"
            />
            <div className="grid grow gap-0.5">
              <Label
                htmlFor={`${id}-${operator.key}`}
                className="text-sm font-medium cursor-pointer"
              >
                {operator.label}
              </Label>
              {operator.description && (
                <p
                  id={`${id}-${operator.key}-description`}
                  className="text-xs text-muted-foreground"
                >
                  {operator.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
