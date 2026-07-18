'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { Search } from 'lucide-react';
import * as React from 'react';
import { useId } from 'react';
import { useFilterValidation } from '../../../hooks/use-filter-validation';
import { cn } from '../../../lib/utils';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { ScrollArea } from '../../ui/scroll-area';
import { Separator } from '../../ui/separator';

/** Show the inline search box only once the option list gets long enough to need it. */
const SEARCH_THRESHOLD = 8;

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
  const id = useId();
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

  const showSearch = options.length > SEARCH_THRESHOLD;
  const filteredOptions = React.useMemo(() => {
    if (!showSearch || !search) return options;
    const query = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search, showSearch]);

  const handleToggleOption = React.useCallback(
    (value: string, checked: boolean) => {
      if (allowsMultiple) {
        onChange(checked ? [...selectedValues, value] : selectedValues.filter((v) => v !== value));
        return;
      }
      onChange(checked ? [value] : []);
    },
    [allowsMultiple, onChange, selectedValues]
  );

  if (needsNoValues) {
    return (
      <div className="text-xs text-muted-foreground px-1">
        This filter doesn't require selecting options.
      </div>
    );
  }

  const singleValue = selectedValues[0] ?? '';

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-semibold tracking-tight px-1">
        {allowsMultiple ? 'Select options' : 'Select option'}
      </Label>
      <Separator />

      {showSearch && (
        <div className="relative px-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search options..."
            disabled={disabled}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}

      <ScrollArea className="max-h-60 px-1">
        {filteredOptions.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No options found.</p>
        ) : allowsMultiple ? (
          <div className="flex flex-col gap-0.5 pr-2">
            {filteredOptions.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              const OptionIcon = option.icon;
              return (
                <Label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal',
                    'hover:bg-accent/50 transition-colors',
                    disabled && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleOption(option.value, !isSelected)}
                    disabled={disabled}
                  />
                  {OptionIcon && <OptionIcon className="size-3.5 text-muted-foreground" />}
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {option.count}
                    </span>
                  )}
                </Label>
              );
            })}
          </div>
        ) : (
          <RadioGroup
            value={singleValue}
            onValueChange={(value) => handleToggleOption(value, true)}
            disabled={disabled}
            className="gap-0.5 pr-2"
          >
            {filteredOptions.map((option) => {
              const OptionIcon = option.icon;
              const optionId = `${id}-${option.value}`;
              return (
                <Label
                  key={option.value}
                  htmlFor={optionId}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal',
                    'hover:bg-accent/50 transition-colors',
                    disabled && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <RadioGroupItem value={option.value} id={optionId} disabled={disabled} />
                  {OptionIcon && <OptionIcon className="size-3.5 text-muted-foreground" />}
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {option.count}
                    </span>
                  )}
                </Label>
              );
            })}
          </RadioGroup>
        )}
      </ScrollArea>

      {!validation.isValid && validation.error && selectedValues.length > 0 && (
        <p className="px-1 text-xs text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
