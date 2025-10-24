'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilterValidation } from '@/hooks/use-filter-validation';
import { cn } from '@/lib/utils';

export interface OptionFilterInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function OptionFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: OptionFilterInputProps<TData>) {
  const options = column.filter?.options || [];
  const allowsMultiple = filter.operator === 'isAnyOf' || filter.operator === 'isNoneOf';
  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';

  const selectedValues = (filter.values || []) as string[];

  // Validate the current values
  const validation = useFilterValidation({
    filter,
    column,
    values: selectedValues,
    immediate: selectedValues.length > 0 || needsNoValues,
  });

  const handleSingleSelect = (value: string) => {
    onChange([value]);
  };

  const handleMultipleToggle = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const handleRemoveValue = (value: string) => {
    onChange(selectedValues.filter((v) => v !== value));
  };

  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">
        This filter doesn't require selecting options.
      </div>
    );
  }

  if (allowsMultiple) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Select Options</Label>

        {/* Selected Values */}
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedValues.map((value) => {
              const option = options.find((opt) => opt.value === value);
              return (
                <Badge key={value as React.Key} variant="secondary" className="text-xs">
                  {option?.icon && (
                    <span className="mr-1">
                      <option.icon />
                    </span>
                  )}
                  {option?.label ? option.label : String(value)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-auto p-0 text-xs hover:bg-transparent"
                    onClick={() => handleRemoveValue(String(value))}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Option Selection */}
        <Select onValueChange={handleMultipleToggle} disabled={disabled}>
          <SelectTrigger
            className={cn(
              !validation.isValid &&
                selectedValues.length > 0 &&
                'border-destructive focus:ring-destructive'
            )}
          >
            <SelectValue placeholder="Add option..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={selectedValues.includes(option.value)}
              >
                <div className="flex items-center gap-2">
                  {option.icon && (
                    <span>
                      <option.icon />
                    </span>
                  )}
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground">({option.count})</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!validation.isValid && validation.error && selectedValues.length > 0 && (
          <p className="text-sm text-destructive">{validation.error}</p>
        )}
      </div>
    );
  }

  // Single selection
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Select Option</Label>
      <Select
        value={selectedValues[0] ? String(selectedValues[0]) : ''}
        onValueChange={handleSingleSelect}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            !validation.isValid &&
              selectedValues.length > 0 &&
              'border-destructive focus:ring-destructive'
          )}
        >
          <SelectValue placeholder="Choose an option..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.icon && (
                  <span>
                    <option.icon />
                  </span>
                )}
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-muted-foreground">({option.count})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!validation.isValid && validation.error && selectedValues.length > 0 && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
