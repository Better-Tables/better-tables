import type { ErrorStateProps as CoreErrorStateProps } from '@better-tables/core';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

export interface ErrorStateProps extends CoreErrorStateProps {
  /** Custom error title */
  title?: string;

  /** Custom error message */
  message?: string;

  /** Whether to show error details */
  showDetails?: boolean;

  /** Additional className */
  className?: string;
}

export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  message,
  showDetails = false,
  className,
}: ErrorStateProps) {
  const errorMessage = message || error.message || 'Failed to load data';

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
        <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>

      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>

      <p className="text-sm text-muted-foreground mb-4 max-w-md">{errorMessage}</p>

      {showDetails && error.stack && (
        <details className="mb-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Show error details</summary>
          <pre className="mt-2 p-2 bg-muted rounded text-left overflow-x-auto">{error.stack}</pre>
        </details>
      )}

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="text-sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  );
}
