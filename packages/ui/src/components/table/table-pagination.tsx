import type { PaginationConfig } from '@better-tables/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
          <span key={key} className="px-2 py-1 text-sm text-muted-foreground">
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
          className="w-8 h-8 p-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-current={currentPage === page ? 'page' : undefined}
        >
          {page}
        </Button>
      );
    });
  };

  return (
    <div className={cn('flex items-center justify-between px-2', className)}>
      <div className="flex items-center gap-4">
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value, 10))}
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
            <span className="text-sm text-muted-foreground">entries</span>
          </div>
        )}

        {showPageInfo && totalItems && (
          <div className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {totalItems} entries
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-1">{renderPageNumbers()}</div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
