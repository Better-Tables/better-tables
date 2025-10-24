'use client';

import { Filter } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether there are active filters */
  hasFilters?: boolean;
  /** Custom label */
  label?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export const FilterButton = React.forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ hasFilters = false, label = 'Filter', disabled = false, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        disabled={disabled}
        className={cn('h-8 border-dashed', hasFilters && 'border-solid', className)}
        {...props}
      >
        <Filter className="mr-2 h-4 w-4" />
        {label}
        {hasFilters && (
          <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
            Active
          </Badge>
        )}
      </Button>
    );
  }
);

FilterButton.displayName = 'FilterButton';
