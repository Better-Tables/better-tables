'use client';

import type { ColumnDefinition, FilterOperator } from '@better-tables/core';
import { getOperatorsForType } from '@better-tables/core';
import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  return (
    <div className="space-y-2">
      <label htmlFor={`operator-${column.id}`} className="text-sm font-medium">
        Operator
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={`operator-${column.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem key={operator.key} value={operator.key}>
              <div>
                <div className="font-medium">{operator.label}</div>
                {operator.description && (
                  <div className="text-xs text-muted-foreground">{operator.description}</div>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
