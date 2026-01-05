import type { PaginationConfig } from '@better-tables/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
  const [pageInputValue, setPageInputValue] = useState<string>(currentPage.toString());
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showPageJumpOnly = totalPages > 100;

  const baseWidth = `${String(totalPages).length + 2}ch`;
  const expandedWidth = '100px';

  // Update input value when current page changes externally
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const handlePageJump = (): void => {
    const pageNumber = parseInt(pageInputValue, 10);
    if (!Number.isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
      setPageInputValue(pageNumber.toString());
    } else {
      // Reset to current page if invalid
      setPageInputValue(currentPage.toString());
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handlePageJump();
    }
  };

  const handlePageInputBlur = (): void => {
    setIsFocused(false);
    // Validate and reset if invalid on blur
    const pageNumber = parseInt(pageInputValue, 10);
    if (Number.isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
      setPageInputValue(currentPage.toString());
    } else {
      onPageChange(pageNumber);
    }
  };

  const renderPageNumbers = () => {
    // For large page counts, show simplified pagination
    if (totalPages > 10) {
      const pages: (number | -1)[] = [];

      // Always show first page
      pages.push(1);

      // Show ellipsis if current page is far from start
      if (currentPage > 3) {
        pages.push(-1);
      }

      // Show pages around current
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        }
      }

      // Show ellipsis if current page is far from end
      if (currentPage < totalPages - 2) {
        pages.push(-1);
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }

      return pages.map((page, index) => {
        if (page === -1) {
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
    }

    // For smaller page counts, show all or most pages
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
            Showing {startItem} to {endItem} of {Intl.NumberFormat('en-US').format(totalItems)}{' '}
            entries
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showPageJumpOnly ? (
          // Only show page jump input for large page counts
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm text-muted-foreground">Page</span>
            <Input
              ref={inputRef}
              type="number"
              min={1}
              max={totalPages}
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onKeyDown={handlePageInputKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={handlePageInputBlur}
              className="h-8 text-center text-sm font-mono transition-all duration-500 focus:ring-2 focus:ring-ring focus:ring-offset-1"
              style={{
                width: isFocused ? expandedWidth : baseWidth,
              }}
              aria-label="Page number"
            />
            <span className="text-sm text-muted-foreground">
              of {Intl.NumberFormat('en-US').format(totalPages)}
            </span>
          </div>
        ) : (
          // Show normal pagination with buttons for smaller page counts
          <>
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

            {totalPages > 10 && (
              <div className="flex items-center gap-1 px-2">
                <span className="text-sm text-muted-foreground">Page</span>
                <Input
                  ref={inputRef}
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  onKeyDown={handlePageInputKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={handlePageInputBlur}
                  className="h-8 text-center text-sm font-mono transition-all duration-500 focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  style={{
                    width: isFocused ? expandedWidth : baseWidth,
                  }}
                  aria-label="Page number"
                />
                <span className="text-sm text-muted-foreground">
                  of {Intl.NumberFormat('en-US').format(totalPages)}
                </span>
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
