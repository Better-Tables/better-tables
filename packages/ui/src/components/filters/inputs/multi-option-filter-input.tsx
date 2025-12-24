'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { ChevronDown, X } from 'lucide-react';
import * as React from 'react';
import { useFilterValidation } from '../../../hooks/use-filter-validation';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command';
import { Label } from '../../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';

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
  // Auto-open popover when filter is empty (newly added filter)
  const [open, setOpen] = React.useState(() => {
    return !needsNoValues && selectedValues.length === 0;
  });
  const [search, setSearch] = React.useState('');
  const popoverContentRef = React.useRef<HTMLDivElement>(null);

  // Auto-focus search input when popover opens and filter is empty
  React.useEffect(() => {
    if (open && selectedValues.length === 0 && !disabled) {
      // Use setTimeout to ensure the input is visible
      // CommandInput doesn't forward refs, so we need to query for the input element
      // Scope the query to the popover content to avoid selecting wrong element when multiple components exist
      const timeoutId = setTimeout(() => {
        const popoverContent = popoverContentRef.current;
        if (popoverContent) {
          const input = popoverContent.querySelector<HTMLInputElement>(
            '[data-slot="command-input"]'
          );
          input?.focus();
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [open, selectedValues.length, disabled]);

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
        <PopoverContent ref={popoverContentRef} className="w-full p-0" align="start">
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
