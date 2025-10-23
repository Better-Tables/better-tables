import { EmptyStateProps as CoreEmptyStateProps } from '@better-tables/core';
import { Database, Search } from 'lucide-react';
import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

export interface EmptyStateProps extends CoreEmptyStateProps {
  /** Empty state message */
  message?: string;

  /** Custom icon */
  icon?: React.ComponentType<any>;

  /** Custom action */
  action?: React.ReactNode;

  /** Additional className */
  className?: string;
}

export function EmptyState({
  message = 'No data available',
  hasFilters = false,
  onClearFilters,
  icon = hasFilters ? Search : Database,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted/20 mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-medium text-foreground mb-2">
        {hasFilters ? 'No matching results' : 'No data to display'}
      </h3>

      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {hasFilters
          ? 'Try adjusting your filters to see more results, or clear all filters to see all data.'
          : message}
      </p>

      {action || (hasFilters && onClearFilters) ? (
        <div className="flex gap-2">
          {action}
          {hasFilters && onClearFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters} className="text-sm">
              Clear filters
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
