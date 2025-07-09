'use client';

import * as React from 'react';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFilterValidation } from '@/hooks/use-filter-validation';
import { cn } from '@/lib/utils';

export interface NumberFilterInputProps<TData = any> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: any[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function NumberFilterInput<TData = any>({
  filter,
  column,
  onChange,
  disabled = false,
}: NumberFilterInputProps<TData>) {
  const [values, setValues] = React.useState(() => {
    const filterValues = filter.values || [];
    return {
      single: filterValues[0] || '',
      min: filterValues[0] || '',
      max: filterValues[1] || '',
    };
  });
  
  const needsTwoValues = filter.operator === 'between' || filter.operator === 'notBetween';
  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';
  
  // Prepare values for validation
  const validationValues = React.useMemo(() => {
    if (needsNoValues) return [];
    if (needsTwoValues) {
      const min = parseFloat(values.min);
      const max = parseFloat(values.max);
      const validValues = [];
      if (!isNaN(min)) validValues.push(min);
      if (!isNaN(max)) validValues.push(max);
      return validValues;
    } else {
      const single = parseFloat(values.single);
      return !isNaN(single) ? [single] : [];
    }
  }, [values, needsTwoValues, needsNoValues]);
  
  // Validate the current values
  const validation = useFilterValidation({
    filter,
    column,
    values: validationValues,
    immediate: validationValues.length > 0 || needsNoValues,
  });
  
  // Update parent when values change
  React.useEffect(() => {
    if (needsNoValues) {
      onChange([]);
    } else if (needsTwoValues) {
      const min = parseFloat(values.min);
      const max = parseFloat(values.max);
      const newValues = [];
      if (!isNaN(min)) newValues.push(min);
      if (!isNaN(max)) newValues.push(max);
      onChange(newValues);
    } else {
      const single = parseFloat(values.single);
      onChange(!isNaN(single) ? [single] : []);
    }
  }, [values, onChange, needsTwoValues, needsNoValues]);
  
  // Sync local values when filter values change externally
  React.useEffect(() => {
    const filterValues = filter.values || [];
    setValues({
      single: filterValues[0] || '',
      min: filterValues[0] || '',
      max: filterValues[1] || '',
    });
  }, [filter.values]);
  
  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues(prev => ({ ...prev, single: e.target.value }));
  };
  
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues(prev => ({ ...prev, min: e.target.value }));
  };
  
  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues(prev => ({ ...prev, max: e.target.value }));
  };
  
  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">
        This filter doesn't require a value.
      </div>
    );
  }
  
  if (needsTwoValues) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Min</Label>
            <Input
              type="number"
              value={values.min}
              onChange={handleMinChange}
              placeholder="0"
              min={column.filter?.min}
              max={column.filter?.max}
              disabled={disabled}
              className={cn(
                !validation.isValid && values.min && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Max</Label>
            <Input
              type="number"
              value={values.max}
              onChange={handleMaxChange}
              placeholder="100"
              min={column.filter?.min}
              max={column.filter?.max}
              disabled={disabled}
              className={cn(
                !validation.isValid && values.max && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>
        </div>
        {!validation.isValid && validation.error && validationValues.length > 0 && (
          <p className="text-sm text-destructive">{validation.error}</p>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Value</Label>
      <Input
        type="number"
        value={values.single}
        onChange={handleSingleChange}
        placeholder={`Enter ${column.displayName}...`}
        min={column.filter?.min}
        max={column.filter?.max}
        disabled={disabled}
        className={cn(
          !validation.isValid && values.single && "border-destructive focus-visible:ring-destructive"
        )}
      />
      {!validation.isValid && validation.error && validationValues.length > 0 && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
} 