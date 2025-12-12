'use client';

import { Filter } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

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
    const [isMounted, setIsMounted] = React.useState(false);

    // Only render Badge after mount to avoid hydration mismatch
    React.useEffect(() => {
      setIsMounted(true);
    }, []);

    return (
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        disabled={disabled}
        className={cn('h-8 border-dashed', hasFilters && 'border-solid', className)}
        {...props}
      >
        <Filter className="mr-1 h-4 w-4" />
        {label}
        {isMounted && hasFilters && (
          <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
            Active
          </Badge>
        )}
      </Button>
    );
  }
);

FilterButton.displayName = 'FilterButton';
