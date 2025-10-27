'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { CalendarIcon, Clock } from 'lucide-react';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { useFilterValidation, useKeyboardNavigation } from '../../../hooks';
import { type DatePreset, getCommonPresets, getDatePresetConfig } from '../../../lib/date-presets';
import { formatDateRange, formatDateWithConfig } from '../../../lib/date-utils';
import { getFilterValueAsDate } from '../../../lib/filter-value-utils';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Calendar } from '../../ui/calendar';
import { Label } from '../../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Separator } from '../../ui/separator';

export interface DateFilterInputProps<TData = unknown> {
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
 * Date filter input component
 *
 * Pattern: Controlled component with local UI state
 * - Data state comes from parent (filter.values as dates)
 * - UI state (selected dates in calendar) managed locally
 * - Updates sent back to parent immediately (no debounce needed)
 * - Syncs from parent only when date values actually change
 */
export function DateFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: DateFilterInputProps<TData>) {
  const needsDateRange = filter.operator === 'between' || filter.operator === 'notBetween';
  const needsNoValues = [
    'isToday',
    'isYesterday',
    'isThisWeek',
    'isThisMonth',
    'isThisYear',
    'isNull',
    'isNotNull',
  ].includes(filter.operator);

  // Get date formatting configuration from column filter config
  const dateFormat = React.useMemo(() => {
    const filterConfig = column.filter;
    return {
      format: filterConfig?.format || 'PPP',
      locale: 'en-US',
      showTime: filterConfig?.includeTime || false,
      showRelative: false,
      timeZone: undefined,
      relativeOptions: undefined,
    };
  }, [column.filter]);

  // Get date preset configuration
  const presetConfig = React.useMemo(() => getDatePresetConfig(column.meta), [column.meta]);

  // Get presets to show
  const presets = React.useMemo(() => {
    if (presetConfig.presets && presetConfig.presets.length > 0) {
      return presetConfig.presets.slice(0, presetConfig.maxPresets || 12);
    }
    return getCommonPresets();
  }, [presetConfig]);

  // Store onChange in ref to prevent effect dependencies
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // UI-only state: selected dates in calendar
  const [singleDate, setSingleDate] = React.useState<Date | undefined>(() => {
    return getFilterValueAsDate(filter, 0) || undefined;
  });

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (filter.values.length >= 2) {
      const from = getFilterValueAsDate(filter, 0);
      const to = getFilterValueAsDate(filter, 1);
      if (from && to) {
        return { from, to };
      }
    }
    return undefined;
  });

  // Auto-open popover when there's no date value
  const [isOpen, setIsOpen] = React.useState(() => {
    return needsNoValues ? false : needsDateRange ? !dateRange?.from : !singleDate;
  });

  // Keyboard navigation
  const keyboardNavigation = useKeyboardNavigation({
    onEscape: () => {
      setSingleDate(undefined);
      setDateRange(undefined);
    },
  });

  // Prepare values for validation
  const validationValues = React.useMemo(() => {
    if (needsNoValues) return [];
    if (needsDateRange) {
      const values = [];
      if (dateRange?.from) values.push(dateRange.from);
      if (dateRange?.to) values.push(dateRange.to);
      return values;
    }
    return singleDate ? [singleDate] : [];
  }, [singleDate, dateRange, needsDateRange, needsNoValues]);

  // Validate the current values
  // For date ranges, only validate when both dates are selected (prevents error while user is selecting)
  const shouldValidate = React.useMemo(() => {
    if (needsNoValues) return true;
    if (needsDateRange) {
      // Only validate if we have both dates
      return validationValues.length === 2;
    }
    return validationValues.length > 0;
  }, [needsDateRange, needsNoValues, validationValues.length]);

  const validation = useFilterValidation({
    filter,
    column,
    values: validationValues,
    immediate: shouldValidate,
  });

  // Sync TO parent when dates change
  React.useEffect(() => {
    if (needsNoValues) {
      onChangeRef.current([]);
    } else if (needsDateRange) {
      // For date range, only send values when BOTH dates are selected
      if (dateRange?.from && dateRange?.to) {
        onChangeRef.current([dateRange.from, dateRange.to]);
        // Close popover when both dates are selected
        setIsOpen(false);
      } else {
        // Don't send partial ranges - will show validation error
        onChangeRef.current([]);
      }
    } else {
      onChangeRef.current(singleDate ? [singleDate] : []);
      // Close popover when date is selected
      if (singleDate) {
        setIsOpen(false);
      }
    }
  }, [singleDate, dateRange, needsDateRange, needsNoValues]);

  // Sync FROM parent when filter values change
  // Get external values and compare timestamps to detect actual changes
  const externalFrom = getFilterValueAsDate(filter, 0);
  const externalTo = getFilterValueAsDate(filter, 1);

  React.useEffect(() => {
    if (needsDateRange && filter.values.length >= 2) {
      const from = externalFrom;
      const to = externalTo;

      // Only update if dates actually changed (compare timestamps)
      if (from && to) {
        setDateRange((prev) => {
          const needsUpdate =
            !prev?.from ||
            !prev?.to ||
            prev.from.getTime() !== from.getTime() ||
            prev.to.getTime() !== to.getTime();

          return needsUpdate ? { from, to } : prev;
        });
      }
    } else if (!needsDateRange) {
      const date = externalFrom;

      // Only update if date actually changed
      setSingleDate((prev) => {
        const needsUpdate =
          (!prev && date) || (prev && !date) || (prev && date && prev.getTime() !== date.getTime());

        return needsUpdate ? date || undefined : prev;
      });
    }
  }, [externalFrom, externalTo, needsDateRange, filter.values.length]);

  // Handle preset selection
  const handlePresetSelect = React.useCallback(
    (preset: DatePreset) => {
      const range = preset.getRange();

      if (needsDateRange) {
        setDateRange({ from: range.from, to: range.to });
      } else {
        setSingleDate(range.from);
      }
    },
    [needsDateRange]
  );

  // Preset component
  const PresetButtons = React.useMemo(
    () => (
      <div className="flex flex-col gap-1 p-2">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs font-medium text-muted-foreground">Quick Select</Label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant="ghost"
              size="sm"
              onClick={() => handlePresetSelect(preset)}
              className="justify-start text-xs h-8 px-2 py-1"
              title={preset.description}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    ),
    [presets, handlePresetSelect]
  );

  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">
        This filter doesn't require a date selection.
      </div>
    );
  }

  if (needsDateRange) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Date Range</Label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !dateRange && 'text-muted-foreground',
                !validation.isValid && validationValues.length > 0 && 'border-destructive'
              )}
              disabled={disabled}
              onKeyDown={keyboardNavigation.onKeyDown}
              {...keyboardNavigation.ariaAttributes}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                <span>{formatDateRange(dateRange.from, dateRange.to, dateFormat)}</span>
              ) : (
                <span>Pick a date range{dateFormat.showTime ? ' and time' : ''}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              {PresetButtons}
              <Separator orientation="vertical" className="h-auto" />
              <Calendar
                autoFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={disabled ? undefined : setDateRange}
                numberOfMonths={2}
                disabled={disabled}
              />
            </div>
          </PopoverContent>
        </Popover>
        {!validation.isValid && validation.error && validationValues.length > 0 && (
          <p className="text-sm text-destructive">{validation.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Date</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !singleDate && 'text-muted-foreground',
              !validation.isValid && validationValues.length > 0 && 'border-destructive'
            )}
            disabled={disabled}
            onKeyDown={keyboardNavigation.onKeyDown}
            {...keyboardNavigation.ariaAttributes}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {singleDate ? (
              <span>{formatDateWithConfig(singleDate, dateFormat)}</span>
            ) : (
              <span>Pick a date{dateFormat.showTime ? ' and time' : ''}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {PresetButtons}
            <Separator orientation="vertical" className="h-auto" />
            <Calendar
              mode="single"
              selected={singleDate}
              onSelect={disabled ? undefined : setSingleDate}
              initialFocus
              disabled={disabled}
            />
          </div>
        </PopoverContent>
      </Popover>
      {!validation.isValid && validation.error && validationValues.length > 0 && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
