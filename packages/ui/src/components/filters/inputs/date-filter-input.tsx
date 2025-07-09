'use client';

import * as React from 'react';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { useFilterValidation } from '@/hooks/use-filter-validation';
import { formatDateWithConfig, formatDateRange } from '@/lib/date-utils';

export interface DateFilterInputProps<TData = any> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: any[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function DateFilterInput<TData = any>({
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

  // Get date formatting configuration from column metadata
  const dateFormat = React.useMemo(() => {
    const format = column.meta?.dateFormat;
    return {
      format: format?.format || 'PPP', // Default to date-fns 'PPP' format
      locale: format?.locale || 'en-US',
      showTime: format?.showTime || false,
      showRelative: format?.showRelative || false,
      timeZone: format?.timeZone,
      relativeOptions: format?.relativeOptions,
    };
  }, [column.meta?.dateFormat]);

  const [singleDate, setSingleDate] = React.useState<Date | undefined>(() => {
    return filter.values[0] ? new Date(filter.values[0]) : undefined;
  });

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (filter.values.length >= 2) {
      return {
        from: new Date(filter.values[0]),
        to: new Date(filter.values[1]),
      };
    }
    return undefined;
  });

  // Prepare values for validation
  const validationValues = React.useMemo(() => {
    if (needsNoValues) return [];
    if (needsDateRange) {
      const values = [];
      if (dateRange?.from) values.push(dateRange.from);
      if (dateRange?.to) values.push(dateRange.to);
      return values;
    } else {
      return singleDate ? [singleDate] : [];
    }
  }, [singleDate, dateRange, needsDateRange, needsNoValues]);

  // Validate the current values
  const validation = useFilterValidation({
    filter,
    column,
    values: validationValues,
    immediate: validationValues.length > 0 || needsNoValues,
  });

  // Update parent when dates change
  React.useEffect(() => {
    if (needsNoValues) {
      onChange([]);
    } else if (needsDateRange) {
      if (dateRange?.from && dateRange?.to) {
        onChange([dateRange.from, dateRange.to]);
      } else if (dateRange?.from) {
        onChange([dateRange.from]);
      } else {
        onChange([]);
      }
    } else {
      onChange(singleDate ? [singleDate] : []);
    }
  }, [singleDate, dateRange, onChange, needsDateRange, needsNoValues]);

  // Sync local dates when filter values change externally
  React.useEffect(() => {
    if (needsDateRange && filter.values.length >= 2) {
      setDateRange({
        from: new Date(filter.values[0]),
        to: new Date(filter.values[1]),
      });
    } else if (!needsDateRange && filter.values[0]) {
      setSingleDate(new Date(filter.values[0]));
    }
  }, [filter.values, needsDateRange]);

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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !dateRange && 'text-muted-foreground',
                !validation.isValid && validationValues.length > 0 && 'border-destructive',
              )}
              disabled={disabled}
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
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={disabled ? undefined : setDateRange}
              numberOfMonths={2}
              disabled={disabled}
            />
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
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !singleDate && 'text-muted-foreground',
              !validation.isValid && validationValues.length > 0 && 'border-destructive',
            )}
            disabled={disabled}
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
          <Calendar
            mode="single"
            selected={singleDate}
            onSelect={disabled ? undefined : setSingleDate}
            initialFocus
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
      {!validation.isValid && validation.error && validationValues.length > 0 && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
