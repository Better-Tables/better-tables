import type { PaginationConfig } from '@better-tables/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface TablePaginationProps
  extends Pick<PaginationConfig, 'pageSizeOptions' | 'showPageSizeSelector'> {
  /** Current page (1-indexed) */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;

  /** Page change handler */
  onPageChange: (page: number) => void;

  /** Current page size */
  pageSize: number;

  /** Page size change handler */
  onPageSizeChange: (pageSize: number) => void;

  /** Total number of items */
  totalItems?: number;

  /** Whether to show page info */
  showPageInfo?: boolean;

  /** Class name */
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  totalItems,
  showPageSizeSelector = true,
  showPageInfo = true,
  className,
}: TablePaginationProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems || 0);

  const renderPageNumbers = () => {
    const pages: (number | -1)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, and pages around current
      if (currentPage <= 3) {
        pages.push(1, 2, 3, -1, totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, -1, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages);
      }
    }

    return pages.map((page, index) => {
      if (page === -1) {
        // Use adjacent page as part of the key to avoid using index
        const prevPage = pages[index - 1];
        const nextPage = pages[index + 1];
        const key = `ellipsis-${prevPage ?? 'start'}-${nextPage ?? 'end'}`;
        return (
          <span key={key} className="px-2 py-1 text-xs text-muted-foreground">
            ...
          </span>
        );
      }

      return (
        <Button
          key={page}
          variant={currentPage === page ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPageChange(page)}
          className="w-8 h-8 p-0 text-xs tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-current={currentPage === page ? 'page' : undefined}
        >
          {page}
        </Button>
      );
    });
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Show</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                if (value != null) onPageSizeChange(parseInt(value, 10));
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">entries</span>
          </div>
        )}

        {showPageInfo && totalItems != null && totalItems > 0 && isClient && (
          <div className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {/* Full sentence needs room; small screens get the compact form. */}
            <span className="hidden md:inline">
              Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of{' '}
              {totalItems.toLocaleString()} entries
            </span>
            <span className="md:hidden">
              {startItem.toLocaleString()}–{endItem.toLocaleString()} of{' '}
              {totalItems.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronLeft className="h-4 w-4 lg:mr-1" />
          <span className="hidden lg:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1">{renderPageNumbers()}</div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="hidden lg:inline">Next</span>
          <ChevronRight className="h-4 w-4 lg:ml-1" />
        </Button>
      </div>
    </div>
  );
}
