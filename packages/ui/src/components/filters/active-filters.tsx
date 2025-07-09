'use client';

import * as React from 'react';
import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { getOperatorDefinition } from '@better-tables/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { X, Lock } from 'lucide-react';
import { FilterOperatorSelect } from './filter-operator-select';
import { FilterValueInput } from './filter-value-input';
import { formatDateWithConfig, formatDateRange } from '@/lib/date-utils';
import {
  getFormatterForType,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatEmail,
  formatUrl,
  formatPhone,
  truncateText,
} from '@/lib/format-utils';

export interface ActiveFiltersProps<TData = any> {
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

function ActiveFiltersComponent<TData = any>({
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
        {filters.map(filter => {
          const column = columns.find(col => col.id === filter.columnId);
          if (!column) return null;

          const isProtected = isFilterProtected?.(filter) ?? false;

          return (
            <div key={filter.columnId} className="flex-shrink-0">
              <MemoizedFilterBadge
                filter={filter}
                column={column}
                onUpdate={updates => onUpdateFilter(filter.columnId, updates)}
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

interface FilterBadgeProps<TData = any> {
  filter: FilterState;
  column: ColumnDefinition<TData>;
  onUpdate: (updates: Partial<FilterState>) => void;
  onRemove: () => void;
  isProtected: boolean;
  disabled?: boolean;
}

function FilterBadge<TData = any>({
  filter,
  column,
  onUpdate,
  onRemove,
  isProtected,
  disabled = false,
}: FilterBadgeProps<TData>) {
  const Icon = column.icon;
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

  return (
    <div
      className={cn(
        'flex items-center rounded-2xl border bg-background text-xs shadow-sm',
        disabled && 'opacity-50 cursor-not-allowed',
        isProtected && 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
      )}
    >
      {/* Column Name */}
      <div className="flex items-center gap-1 px-2 py-1">
        {Icon && <Icon className="h-3 w-3" />}
        <span className="font-medium">{column.displayName}</span>
        {isProtected && <Lock className="ml-1 h-3 w-3 text-amber-600 dark:text-amber-400" />}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Operator */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'h-full rounded-none px-2 py-1 text-xs hover:bg-muted',
              isProtected && 'cursor-not-allowed opacity-75',
            )}
            disabled={disabled || isProtected}
          >
            {operatorLabel}
            {isProtected && <Lock className="ml-1 h-3 w-3" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <FilterOperatorSelect
            column={column}
            value={filter.operator}
            onChange={operator => onUpdate({ operator })}
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

      {/* Value */}
      {isMobile ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'h-full rounded-none px-2 py-1 text-xs hover:bg-muted',
                isProtected && 'cursor-not-allowed opacity-75',
              )}
              disabled={disabled || isProtected}
            >
              <FilterValueDisplay filter={filter} column={column} />
              {isProtected && <Lock className="ml-1 h-3 w-3" />}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle>Edit Filter Value</DialogTitle>
            </DialogHeader>
            <FilterValueInput
              filter={filter}
              column={column}
              onChange={values => onUpdate({ values })}
              onIncludeNullChange={includeNull => onUpdate({ includeNull })}
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
                'h-full rounded-none px-2 py-1 text-xs hover:bg-muted',
                isProtected && 'cursor-not-allowed opacity-75',
              )}
              disabled={disabled || isProtected}
            >
              <FilterValueDisplay filter={filter} column={column} />
              {isProtected && <Lock className="ml-1 h-3 w-3" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <FilterValueInput
              filter={filter}
              column={column}
              onChange={values => onUpdate({ values })}
              onIncludeNullChange={includeNull => onUpdate({ includeNull })}
              disabled={disabled || isProtected}
            />
            {isProtected && (
              <div className="mt-2 text-xs text-muted-foreground">
                This filter is protected and cannot be modified
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      <Separator orientation="vertical" className="h-6" />

      {/* Remove Button */}
      {isProtected ? (
        <div className="flex h-full items-center px-2 text-muted-foreground">
          <Lock className="h-3 w-3" />
        </div>
      ) : (
        <Button
          variant="ghost"
          className="h-full rounded-none rounded-r-2xl px-2 py-1 hover:bg-muted"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// Memoize FilterBadge for performance
const MemoizedFilterBadge = React.memo(FilterBadge) as typeof FilterBadge;

interface FilterValueDisplayProps<TData = any> {
  filter: FilterState;
  column: ColumnDefinition<TData>;
}

function FilterValueDisplay<TData = any>({ filter, column }: FilterValueDisplayProps<TData>) {
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
          {truncateText(filter.values[0], 30)}
          {nullIndicator}
        </span>
      );

    case 'email':
      return (
        <span className="text-blue-600">
          {formatEmail(filter.values[0])}
          {nullIndicator}
        </span>
      );

    case 'url':
      return (
        <span className="text-blue-600 underline">
          {truncateText(formatUrl(filter.values[0]), 25)}
        </span>
      );

    case 'phone':
      return <span className="font-mono text-sm">{formatPhone(filter.values[0])}</span>;

    case 'number':
      if (filter.operator === 'between' || filter.operator === 'notBetween') {
        return (
          <span>
            {formatNumber(filter.values[0], column.meta?.numberFormat)} -{' '}
            {formatNumber(filter.values[1], column.meta?.numberFormat)}
          </span>
        );
      }
      return <span>{formatNumber(filter.values[0], column.meta?.numberFormat)}</span>;

    case 'currency':
      if (filter.operator === 'between' || filter.operator === 'notBetween') {
        return (
          <span>
            {formatCurrency(filter.values[0], {
              ...column.meta?.numberFormat,
              ...column.meta?.currencyFormat,
            })}{' '}
            -{' '}
            {formatCurrency(filter.values[1], {
              ...column.meta?.numberFormat,
              ...column.meta?.currencyFormat,
            })}
          </span>
        );
      }
      return (
        <span>
          {formatCurrency(filter.values[0], {
            ...column.meta?.numberFormat,
            ...column.meta?.currencyFormat,
          })}
        </span>
      );

    case 'percentage':
      if (filter.operator === 'between' || filter.operator === 'notBetween') {
        return (
          <span>
            {formatPercentage(filter.values[0], column.meta?.numberFormat)} -{' '}
            {formatPercentage(filter.values[1], column.meta?.numberFormat)}
          </span>
        );
      }
      return <span>{formatPercentage(filter.values[0], column.meta?.numberFormat)}</span>;

    case 'date':
      // Get date formatting configuration from column metadata
      const dateFormat = {
        format: column.meta?.dateFormat?.format || 'PPP',
        locale: column.meta?.dateFormat?.locale || 'en-US',
        showTime: column.meta?.dateFormat?.showTime || false,
        showRelative: column.meta?.dateFormat?.showRelative || false,
        timeZone: column.meta?.dateFormat?.timeZone,
        relativeOptions: column.meta?.dateFormat?.relativeOptions,
      };

      if (filter.values.length === 2) {
        const start = new Date(filter.values[0]);
        const end = new Date(filter.values[1]);
        return <span>{formatDateRange(start, end, dateFormat)}</span>;
      }
      const date = new Date(filter.values[0]);
      return (
        <span>
          {formatDateWithConfig(date, dateFormat)}
          {nullIndicator}
        </span>
      );

    // TODO: I dont like declaring color styles here
    case 'boolean':
      return (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            filter.values[0]
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
          }`}
        >
          {filter.values[0] ? 'True' : 'False'}
        </span>
      );

    case 'option':
      const option = column.filter?.options?.find(o => o.value === filter.values[0]);
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          {truncateText(option?.label ?? filter.values[0], 20)}
          {nullIndicator}
        </span>
      );

    case 'multiOption':
      const selectedOptions =
        column.filter?.options?.filter(o => filter.values.includes(o.value)) ?? [];

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
