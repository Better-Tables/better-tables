'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { getNumberFormat, getOperatorDefinition } from '@better-tables/core';
import { Lock, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { formatDateRange, formatDateWithConfig } from '@/lib/date-utils';
import { getFilterValueAsDate, getFilterValueAsNumber } from '@/lib/filter-value-utils';
import {
  formatCurrency,
  formatEmail,
  formatNumber,
  formatPercentage,
  formatPhone,
  formatUrl,
  getFormatterForType,
  truncateText,
} from '@/lib/format-utils';
import { cn } from '@/lib/utils';
import { FilterOperatorSelect } from './filter-operator-select';
import { FilterValueInput } from './filter-value-input';

export interface ActiveFiltersProps<TData = unknown> {
  /** Column definitions */
  columns: ColumnDefinition<TData>[];
  /** Current filters */
  filters: FilterState[];
  /** Callback to update a filter */
  onUpdateFilter: (columnId: string, updates: Partial<FilterState>) => void;
  /** Callback to remove a filter */
  onRemoveFilter: (columnId: string) => void;
  /** Callback to check if a filter is protected */
  isFilterProtected?: (filter: FilterState) => boolean;
  /** Whether the filters are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function ActiveFiltersComponent<TData = unknown>({
  columns,
  filters,
  onUpdateFilter,
  onRemoveFilter,
  isFilterProtected,
  disabled = false,
  className,
}: ActiveFiltersProps<TData>) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex gap-2', className)}>
      {/* Mobile: horizontal scrolling, Desktop: flex-wrap */}
      <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:overflow-x-visible sm:flex-wrap">
        {filters.map((filter) => {
          const column = columns.find((col) => col.id === filter.columnId);
          if (!column) return null;

          const isProtected = isFilterProtected?.(filter) ?? false;

          return (
            <div key={filter.columnId} className="flex-shrink-0">
              <MemoizedFilterBadge
                filter={filter}
                column={column}
                onUpdate={(updates) => onUpdateFilter(filter.columnId, updates)}
                onRemove={() => onRemoveFilter(filter.columnId)}
                isProtected={isProtected}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Export memoized version with proper typing
export const ActiveFilters = React.memo(ActiveFiltersComponent) as typeof ActiveFiltersComponent;

interface FilterBadgeProps<TData = unknown> {
  filter: FilterState;
  column: ColumnDefinition<TData>;
  onUpdate: (updates: Partial<FilterState>) => void;
  onRemove: () => void;
  isProtected: boolean;
  disabled?: boolean;
}

function FilterBadge<TData = unknown>({
  filter,
  column,
  onUpdate,
  onRemove,
  isProtected,
  disabled = false,
}: FilterBadgeProps<TData>) {
  const icon = column.icon;
  const Icon = icon;
  const [isMobile, setIsMobile] = React.useState(false);

  // Check if mobile viewport
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get operator label from core package - memoized
  const operatorLabel = React.useMemo(() => {
    const operatorDef = getOperatorDefinition(filter.operator);
    return operatorDef?.label ?? filter.operator;
  }, [filter.operator]);

  // Check if operator needs no values (like isEmpty, isNotEmpty, isNull, isNotNull)
  const needsNoValues = React.useMemo(() => {
    const operatorDef = getOperatorDefinition(filter.operator);
    return operatorDef?.valueCount === 0;
  }, [filter.operator]);

  return (
    <div
      className={cn(
        'flex items-center rounded-2xl border bg-background text-sm shadow-sm h-8',
        disabled && 'opacity-50 cursor-not-allowed',
        isProtected && 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
      )}
    >
      {/* Column Name */}
      <div className="flex items-center gap-1 px-3 py-2">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="font-medium">{column.displayName}</span>
        {isProtected && <Lock className="ml-1 h-4 w-4 text-amber-600 dark:text-amber-400" />}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Operator */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'h-full rounded-none px-3 py-2 text-sm hover:bg-muted',
              isProtected && 'cursor-not-allowed opacity-75'
            )}
            disabled={disabled || isProtected}
          >
            {operatorLabel}
            {isProtected && <Lock className="ml-1 h-4 w-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <FilterOperatorSelect
            column={column}
            value={filter.operator}
            onChange={(operator) => onUpdate({ operator })}
            disabled={disabled || isProtected}
          />
          {isProtected && (
            <div className="mt-2 text-xs text-muted-foreground">
              This filter is protected and cannot be modified
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6" />

      {/* Value - only show if operator needs values */}
      {!needsNoValues &&
        (isMobile ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'h-full rounded-none px-3 py-2 text-sm hover:bg-muted',
                  isProtected && 'cursor-not-allowed opacity-75'
                )}
                disabled={disabled || isProtected}
              >
                <FilterValueDisplay filter={filter} column={column} />
                {isProtected && <Lock className="ml-1 h-4 w-4" />}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto backdrop-blur-sm">
              <DialogHeader>
                <DialogTitle>Edit Filter Value</DialogTitle>
              </DialogHeader>
              <FilterValueInput
                filter={filter}
                column={column}
                onChange={(values) => onUpdate({ values })}
                onIncludeNullChange={(includeNull) => onUpdate({ includeNull })}
                disabled={disabled || isProtected}
              />
              {isProtected && (
                <div className="mt-2 text-xs text-muted-foreground">
                  This filter is protected and cannot be modified
                </div>
              )}
            </DialogContent>
          </Dialog>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'h-full rounded-none px-3 py-2 text-sm hover:bg-muted',
                  isProtected && 'cursor-not-allowed opacity-75'
                )}
                disabled={disabled || isProtected}
              >
                <FilterValueDisplay filter={filter} column={column} />
                {isProtected && <Lock className="ml-1 h-4 w-4" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <FilterValueInput
                filter={filter}
                column={column}
                onChange={(values) => onUpdate({ values })}
                onIncludeNullChange={(includeNull) => onUpdate({ includeNull })}
                disabled={disabled || isProtected}
              />
              {isProtected && (
                <div className="mt-2 text-xs text-muted-foreground">
                  This filter is protected and cannot be modified
                </div>
              )}
            </PopoverContent>
          </Popover>
        ))}

      <Separator orientation="vertical" className="h-6" />

      {/* Remove Button */}
      {isProtected ? (
        <div className="flex h-full items-center px-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
        </div>
      ) : (
        <Button
          variant="ghost"
          className="h-full rounded-none rounded-r-2xl px-3 py-2 hover:bg-muted"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Memoize FilterBadge for performance
const MemoizedFilterBadge = React.memo(FilterBadge) as typeof FilterBadge;

interface FilterValueDisplayProps<TData = unknown> {
  filter: FilterState;
  column: ColumnDefinition<TData>;
}

function FilterValueDisplay<TData = unknown>({ filter, column }: FilterValueDisplayProps<TData>) {
  if (!filter.values || filter.values.length === 0) {
    return <span className="text-muted-foreground">Empty</span>;
  }

  // Check if includeNull is active and render an indicator
  const includesNull = filter.includeNull === true;
  const nullIndicator = includesNull ? (
    <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 ml-1">
      +null
    </span>
  ) : null;

  switch (column.type) {
    case 'text':
      return (
        <span>
          {truncateText(
            typeof filter.values[0] === 'string'
              ? filter.values[0]
              : String(filter.values[0] || ''),
            30
          )}
          {nullIndicator}
        </span>
      );

    case 'email':
      return (
        <span className="text-blue-600">
          {formatEmail(typeof filter.values[0] === 'string' ? filter.values[0] : null)}
          {nullIndicator}
        </span>
      );

    case 'url':
      return (
        <span className="text-blue-600 underline">
          {truncateText(
            formatUrl(typeof filter.values[0] === 'string' ? filter.values[0] : null),
            25
          )}
        </span>
      );

    case 'phone':
      return (
        <span className="font-mono text-sm">
          {formatPhone(typeof filter.values[0] === 'string' ? filter.values[0] : null)}
        </span>
      );

    case 'number':
      if (filter.operator === 'between' || filter.operator === 'notBetween') {
        return (
          <span>
            {formatNumber(
              typeof filter.values[0] === 'number' ? filter.values[0] : null,
              column.meta?.numberFormat as Record<string, unknown>
            )}{' '}
            -{' '}
            {formatNumber(
              typeof filter.values[1] === 'number' ? filter.values[1] : null,
              column.meta?.numberFormat as Record<string, unknown>
            )}
          </span>
        );
      }
      return (
        <span>
          {formatNumber(
            typeof filter.values[0] === 'number' ? filter.values[0] : null,
            column.meta?.numberFormat as Record<string, unknown>
          )}
        </span>
      );

    case 'currency':
      if (filter.operator === 'between' || filter.operator === 'notBetween') {
        return (
          <span>
            {formatCurrency(typeof filter.values[0] === 'number' ? filter.values[0] : null, {
              ...((column.meta?.numberFormat as Record<string, unknown>) || {}),
              ...((column.meta?.currencyFormat as Record<string, unknown>) || {}),
            })}{' '}
            -{' '}
            {formatCurrency(typeof filter.values[1] === 'number' ? filter.values[1] : null, {
              ...((column.meta?.numberFormat as Record<string, unknown>) || {}),
              ...((column.meta?.currencyFormat as Record<string, unknown>) || {}),
            })}
          </span>
        );
      }
      return (
        <span>
          {formatCurrency(typeof filter.values[0] === 'number' ? filter.values[0] : null, {
            ...((column.meta?.numberFormat as Record<string, unknown>) || {}),
            ...((column.meta?.currencyFormat as Record<string, unknown>) || {}),
          })}
        </span>
      );

    case 'percentage': {
      const val0 = getFilterValueAsNumber(filter, 0);
      const val1 = getFilterValueAsNumber(filter, 1);
      const numFormat = getNumberFormat(column.meta);

      if (filter.operator === 'between' || filter.operator === 'notBetween') {
        return (
          <span>
            {formatPercentage(val0, numFormat)} - {formatPercentage(val1, numFormat)}
          </span>
        );
      }
      return <span>{formatPercentage(val0, numFormat)}</span>;
    }

    case 'date': {
      // Get date formatting configuration from column filter config
      const dateFormat = {
        format: column.filter?.format || 'PPP',
        locale: 'en-US',
        showTime: column.filter?.includeTime || false,
        showRelative: false,
        timeZone: undefined,
        relativeOptions: undefined,
      };

      const startDate = getFilterValueAsDate(filter, 0);
      const endDate = getFilterValueAsDate(filter, 1);

      if (startDate && endDate) {
        return <span>{formatDateRange(startDate, endDate, dateFormat)}</span>;
      }
      if (startDate) {
        return (
          <span>
            {formatDateWithConfig(startDate, dateFormat)}
            {nullIndicator}
          </span>
        );
      }
      return <span>Invalid date</span>;
    }

    case 'boolean':
      return (
        <span
          className={cn(
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
            filter.values[0]
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
          )}
        >
          {filter.values[0] ? 'True' : 'False'}
        </span>
      );

    case 'option': {
      // Handle single value operators (is, isNot)
      if (filter.values.length === 1) {
        const option = column.filter?.options?.find((o) => o.value === filter.values[0]);
        const displayValue = option?.label ?? String(filter.values[0] ?? '');
        return (
          <span>
            {truncateText(displayValue, 20)}
            {nullIndicator}
          </span>
        );
      }

      // Handle multiple value operators (isAnyOf, isNoneOf)
      const selectedOptions =
        column.filter?.options?.filter((o) => (filter.values as string[]).includes(o.value)) ?? [];

      if (selectedOptions.length === 0) {
        return (
          <span>
            {filter.values.length} selected
            {nullIndicator}
          </span>
        );
      }

      if (selectedOptions.length === 1) {
        return (
          <span>
            {truncateText(selectedOptions[0].label, 20)}
            {nullIndicator}
          </span>
        );
      }

      // Show all selected values as comma-separated text
      const displayText = selectedOptions.map((option) => option.label).join(', ');

      return (
        <span>
          {truncateText(displayText, 40)}
          {nullIndicator}
        </span>
      );
    }

    case 'multiOption': {
      const values = filter.values as string[];
      const selectedOptions = column.filter?.options?.filter((o) => values.includes(o.value)) ?? [];

      if (selectedOptions.length === 0) {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {filter.values.length} selected
          </span>
        );
      }

      if (selectedOptions.length === 1) {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
            {truncateText(selectedOptions[0].label, 20)}
          </span>
        );
      }

      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
          {selectedOptions.length} selected
        </span>
      );
    }

    case 'json':
      return (
        <span className="font-mono text-sm">
          {truncateText(JSON.stringify(filter.values[0]), 30)}
        </span>
      );

    default:
      return <span>{getFormatterForType(column.type, filter.values[0], column.meta)}</span>;
  }
}
