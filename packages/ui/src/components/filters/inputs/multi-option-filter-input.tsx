'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { ChevronDown, X } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFilterValidation } from '@/hooks/use-filter-validation';
import { cn } from '@/lib/utils';

export interface MultiOptionFilterInputProps<TData = unknown> {
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
 * Multi-option filter input component
 * 
 * Pattern: Controlled component with minimal local UI state
 * - Data state (selected values) comes from filter.values
 * - UI state (popover open, search) managed locally
 * - Updates sent immediately to parent via onChange
 */
export function MultiOptionFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: MultiOptionFilterInputProps<TData>) {
  const options = column.filter?.options || [];
  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';
  const selectedValues = (filter.values || []) as string[];
  
  // UI-only state for popover and search
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Validate the current values
  const validation = useFilterValidation({
    filter,
    column,
    values: selectedValues,
    immediate: selectedValues.length > 0 || needsNoValues,
  });

  const handleToggleOption = React.useCallback(
    (value: string, checked: boolean) => {
      if (checked) {
        onChange([...selectedValues, value]);
      } else {
        onChange(selectedValues.filter((v) => v !== value));
      }
    },
    [selectedValues, onChange]
  );

  const handleRemoveValue = React.useCallback(
    (value: string) => {
      onChange(selectedValues.filter((v) => v !== value));
    },
    [selectedValues, onChange]
  );

  const handleClearAll = React.useCallback(() => {
    onChange([]);
  }, [onChange]);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower) ||
        option.value.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">
        This filter doesn't require selecting options.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Select Options</Label>
        {selectedValues.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Selected Values */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((value) => {
            const option = options.find((opt) => opt.value === value);
            const OptionIcon = option?.icon;
            return (
              <Badge
                key={value as React.Key}
                variant="secondary"
                className={cn('text-xs', 'flex items-center gap-1')}
              >
                {OptionIcon && (
                  <span className="mr-1">
                    <OptionIcon />
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

      {/* Option Selection Dropdown */}
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between',
              !validation.isValid && selectedValues.length > 0 && 'border-destructive'
            )}
            disabled={disabled}
          >
            <span className="text-sm text-muted-foreground">
              {selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Add options...'}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search options..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  const OptionIcon = option.icon;
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleToggleOption(option.value, !isSelected)}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {}} // Handled by CommandItem onSelect
                      />
                      <div className="flex items-center gap-2 flex-1">
                        {OptionIcon && (
                          <span>
                            <OptionIcon />
                          </span>
                        )}
                        <span>{option.label}</span>
                        {option.count !== undefined && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            ({option.count})
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!validation.isValid && validation.error && selectedValues.length > 0 && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
