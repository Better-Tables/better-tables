'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { Check, X } from 'lucide-react';
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

export interface OptionFilterInputProps<TData = unknown> {
  filter: FilterState;
  column: ColumnDefinition<TData>;
  onChange: (values: unknown[]) => void;
  disabled?: boolean;
}

export function OptionFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: OptionFilterInputProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const options = column.filter?.options || [];
  const allowsMultiple = filter.operator === 'isAnyOf' || filter.operator === 'isNoneOf';
  const needsNoValues = filter.operator === 'isNull' || filter.operator === 'isNotNull';
  const selectedValues = (filter.values || []) as string[];

  const validation = useFilterValidation({
    filter,
    column,
    values: selectedValues,
    immediate: selectedValues.length > 0 || needsNoValues,
  });

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const query = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search]);

  const handleToggleOption = React.useCallback(
    (value: string, checked: boolean) => {
      if (allowsMultiple) {
        const newValues = checked
          ? [...selectedValues, value]
          : selectedValues.filter((v) => v !== value);
        onChange(newValues);
        return;
      }
      onChange(checked ? [value] : []);
      if (checked) setOpen(false);
    },
    [allowsMultiple, onChange, selectedValues]
  );

  const handleRemoveValue = React.useCallback(
    (value: string) => {
      onChange(selectedValues.filter((v) => v !== value));
    },
    [onChange, selectedValues]
  );

  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">
        This filter doesn't require selecting options.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">
        {allowsMultiple ? 'Select options' : 'Select option'}
      </Label>

      {allowsMultiple && selectedValues.length > 0 && (
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
                  <X className="size-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                'w-full justify-between',
                !validation.isValid && selectedValues.length > 0 && 'border-destructive'
              )}
              disabled={disabled}
            />
          }
        >
          <span className="text-sm text-muted-foreground truncate">
            {allowsMultiple
              ? selectedValues.length > 0
                ? `${selectedValues.length} selected`
                : 'Add options...'
              : selectedValues[0]
                ? options.find((opt) => opt.value === selectedValues[0])?.label || selectedValues[0]
                : 'Choose an option...'}
          </span>
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
                      className="flex items-center gap-2"
                    >
                      {allowsMultiple ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            handleToggleOption(option.value, !isSelected)
                          }
                        />
                      ) : (
                        <Check
                          className={cn('size-3.5', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                      )}
                      <div className="flex flex-1 items-center gap-2">
                        {OptionIcon && (
                          <span>
                            <OptionIcon />
                          </span>
                        )}
                        <span>{option.label}</span>
                        {option.count !== undefined && (
                          <span className="ml-auto text-xs text-muted-foreground">
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
