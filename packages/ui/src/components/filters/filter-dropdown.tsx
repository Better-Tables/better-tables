'use client';

import type { ColumnDefinition, FilterGroup } from '@better-tables/core';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useFilterDropdownNavigation, useKeyboardNavigation } from '../../hooks';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export interface FilterDropdownProps<TData = unknown> {
  /** Available columns to filter */
  columns: ColumnDefinition<TData>[];
  /** Optional grouping for columns */
  groups?: FilterGroup[];
  /** Callback when a column is selected */
  onSelect: (columnId: string) => void;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** The trigger element */
  children: React.ReactNode;
  /** Whether search is enabled */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Controlled search term */
  searchTerm?: string;
  /** Callback when search term changes */
  onSearchChange?: (search: string) => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

// Internal state for tracking the current view
type ViewState = { type: 'groups' } | { type: 'group'; groupId: string; groupLabel: string };

export function FilterDropdown<TData = unknown>({
  columns,
  groups,
  onSelect,
  open,
  onOpenChange,
  children,
  searchable = true,
  searchPlaceholder = 'Search columns...',
  searchTerm,
  onSearchChange,
  disabled = false,
  emptyMessage = 'No columns found.',
}: FilterDropdownProps<TData>) {
  const [internalSearch, setInternalSearch] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<ViewState>({
    type: 'groups',
  });

  // Check if mobile viewport
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use controlled search if provided, otherwise use internal state
  const search = searchTerm !== undefined ? searchTerm : internalSearch;
  const setSearch = onSearchChange || setInternalSearch;

  // Reset view when dropdown opens/closes
  React.useEffect(() => {
    if (open) {
      setCurrentView({ type: 'groups' });
      // Don't reset search when opening - keep the search term
    } else {
      // Clear search when popover closes
      setSearch('');
    }
  }, [open, setSearch]);

  // Filter columns based on search
  const filteredColumns = React.useMemo(() => {
    if (!searchable || !search) return columns;

    const searchLower = search.toLowerCase();
    return columns.filter(
      (column) =>
        column.displayName.toLowerCase().includes(searchLower) ||
        column.id.toLowerCase().includes(searchLower)
    );
  }, [columns, search, searchable]);

  // Group columns if groups are provided - enhanced for slide navigation
  const groupedColumns = React.useMemo(() => {
    // If no groups, return empty array - columns will be shown directly
    if (!groups || groups.length === 0) {
      return [];
    }

    const grouped: Array<{
      id: string;
      label: string;
      icon?: React.ComponentType<{ className?: string }>;
      columns: ColumnDefinition<TData>[];
      description?: string;
    }> = [];
    const assignedColumnIds = new Set<string>();

    // Process each group - filter columns within each group based on search
    groups.forEach((group) => {
      // Get all columns that belong to this group (from original columns)
      const groupColumnIds = group.columns;
      const groupColumns = columns.filter((col) => groupColumnIds.includes(col.id));

      // Apply search filter to the group's columns
      const filteredGroupColumns =
        !searchable || !search
          ? groupColumns
          : groupColumns.filter((col) => {
              const searchLower = search.toLowerCase();
              return (
                col.displayName.toLowerCase().includes(searchLower) ||
                col.id.toLowerCase().includes(searchLower)
              );
            });

      if (filteredGroupColumns.length > 0) {
        grouped.push({
          id: group.id,
          label: group.label,
          icon: group.icon as React.ComponentType<{ className?: string }>,
          columns: filteredGroupColumns,
          description: group.description,
        });

        filteredGroupColumns.forEach((col) => {
          assignedColumnIds.add(col.id);
        });
      }
    });

    // Add ungrouped columns
    const ungroupedColumns =
      !searchable || !search
        ? columns.filter((col) => !assignedColumnIds.has(col.id))
        : columns.filter((col) => {
            const searchLower = search.toLowerCase();
            return (
              !assignedColumnIds.has(col.id) &&
              (col.displayName.toLowerCase().includes(searchLower) ||
                col.id.toLowerCase().includes(searchLower))
            );
          });

    if (ungroupedColumns.length > 0) {
      grouped.push({
        id: 'other',
        label: 'Other',
        columns: ungroupedColumns,
        description: 'Miscellaneous columns',
      });
    }

    return grouped;
  }, [groups, columns, filteredColumns, search, searchable]);

  const handleSelect = React.useCallback(
    (columnId: string) => {
      if (disabled) return;
      onSelect(columnId);
      // Clear search when selecting a column
      setSearch('');
      onOpenChange?.(false);
    },
    [disabled, onSelect, onOpenChange, setSearch]
  );

  const handleGroupSelect = React.useCallback((groupId: string, groupLabel: string) => {
    setCurrentView({ type: 'group', groupId, groupLabel });
    // Keep search active when navigating to group
  }, []);

  const handleBackToGroups = React.useCallback(() => {
    setCurrentView({ type: 'groups' });
  }, []);

  // Keyboard navigation for dropdown
  const dropdownNavigation = useFilterDropdownNavigation(
    open || false,
    () => onOpenChange?.(true),
    () => onOpenChange?.(false),
    (index) => {
      // If no groups, navigate directly to columns
      if (!groups || groups.length === 0) {
        const column = filteredColumns[index];
        if (column) {
          handleSelect(column.id);
        }
        return;
      }

      if (currentView.type === 'groups') {
        // Navigate to group
        const group = groupedColumns[index];
        if (group) {
          handleGroupSelect(group.id, group.label);
        }
      } else {
        // Navigate to column within group
        const currentGroup = groupedColumns.find((g) => g.id === currentView.groupId);
        const column = currentGroup?.columns[index];
        if (column) {
          handleSelect(column.id);
        }
      }
    }
  );

  // Keyboard shortcut handlers
  const handleOpenShortcut = React.useCallback(() => {
    onOpenChange?.(true);
  }, [onOpenChange]);

  const handleBackspaceShortcut = React.useCallback(() => {
    if (currentView.type === 'group') {
      handleBackToGroups();
    }
  }, [currentView.type, handleBackToGroups]);

  // Enhanced keyboard navigation
  const keyboardNavigation = useKeyboardNavigation({
    onEscape: () => {
      if (currentView.type === 'group') {
        handleBackToGroups();
      } else {
        onOpenChange?.(false);
      }
    },
    onEnter: () => {
      if (!open) {
        onOpenChange?.(true);
      }
    },
    shortcuts: {
      'Ctrl+k': handleOpenShortcut,
      'Ctrl+f': handleOpenShortcut,
      Backspace: handleBackspaceShortcut,
    },
  });

  // Render groups overview
  const groupsOverview = React.useMemo(() => {
    // If no groups, show columns directly
    if (!groups || groups.length === 0) {
      return (
        <CommandList>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {filteredColumns.map((column) => {
              const Icon = column.icon;
              return (
                <CommandItem
                  key={column.id}
                  value={column.id}
                  onSelect={() => handleSelect(column.id)}
                  disabled={disabled}
                  className="flex items-center pl-4 hover:bg-accent/50 transition-colors"
                >
                  <Check className={cn('mr-2 h-4 w-4', 'opacity-0')} />
                  {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                  <span>{column.displayName}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      );
    }

    // If there's a search term, show filtered columns directly
    if (searchable && search && search.trim() !== '') {
      return (
        <CommandList>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {filteredColumns.map((column) => {
              const Icon = column.icon;
              return (
                <CommandItem
                  key={column.id}
                  value={column.id}
                  onSelect={() => handleSelect(column.id)}
                  disabled={disabled}
                  className="flex items-center pl-4 hover:bg-accent/50 transition-colors"
                >
                  <Check className={cn('mr-2 h-4 w-4', 'opacity-0')} />
                  {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                  <span>{column.displayName}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      );
    }

    // Otherwise, show groups as before
    return (
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {groupedColumns.map((group) => {
            const Icon = group.icon;
            const columnCount = group.columns.length;

            return (
              <CommandItem
                key={group.id}
                value={group.id}
                onSelect={() => handleGroupSelect(group.id, group.label)}
                disabled={disabled}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center">
                  {Icon && <Icon className="mr-3 h-4 w-4 text-muted-foreground" />}
                  <div className="flex flex-col">
                    <span className="font-medium">{group.label}</span>
                    {group.description && (
                      <span className="text-xs text-muted-foreground">{group.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <span className="text-xs mr-1">{columnCount}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    );
  }, [
    groups,
    groupedColumns,
    filteredColumns,
    disabled,
    emptyMessage,
    handleGroupSelect,
    handleSelect,
    searchable,
    search,
  ]);

  // Render individual group view
  const groupView = React.useMemo(() => {
    if (currentView.type !== 'group') return null;

    const currentGroup = groupedColumns.find((g) => g.id === currentView.groupId);
    if (!currentGroup) return null;

    return (
      <div className="h-full">
        {/* Back button header */}
        <div className="flex items-center px-2 py-2 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToGroups}
            className="mr-2 h-8 w-8 p-0 hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h3 className="font-medium text-sm">{currentView.groupLabel}</h3>
            <p className="text-xs text-muted-foreground">
              {currentGroup.columns.length} column
              {currentGroup.columns.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Group columns */}
        <CommandList>
          <CommandEmpty>No columns found in this group.</CommandEmpty>
          <CommandGroup>
            {currentGroup.columns.map((column) => {
              const Icon = column.icon;
              return (
                <CommandItem
                  key={column.id}
                  value={column.id}
                  onSelect={() => handleSelect(column.id)}
                  disabled={disabled}
                  className="flex items-center pl-4 hover:bg-accent/50 transition-colors"
                >
                  <Check className={cn('mr-2 h-4 w-4', 'opacity-0')} />
                  {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                  <span>{column.displayName}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </div>
    );
  }, [currentView, groupedColumns, disabled, handleBackToGroups, handleSelect]);

  // Command content component for reuse
  const commandContent = (
    <Command onKeyDown={dropdownNavigation.handleKeyDown} shouldFilter={false}>
      {/* Only show search in groups overview */}
      {searchable && currentView.type === 'groups' && (
        <CommandInput
          placeholder={searchPlaceholder}
          value={search}
          onValueChange={setSearch}
          disabled={disabled}
          className="focus:outline-hidden focus-visible:outline-hidden focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-transparent focus-visible:bg-transparent"
        />
      )}

      {/* Slide container for smooth transitions */}
      <div className="relative overflow-hidden">
        <div
          className={cn(
            'flex transition-transform duration-300 ease-in-out',
            currentView.type === 'groups' ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Groups overview panel */}
          <div className="w-full shrink-0">{groupsOverview}</div>

          {/* Group details panel */}
          <div className="w-full shrink-0">{groupView}</div>
        </div>
      </div>
    </Command>
  );

  // Create merged keyboard handler that preserves consumer's onKeyDown
  const createMergedKeyboardHandler = React.useCallback(
    (existingOnKeyDown?: React.KeyboardEventHandler<HTMLElement>) => {
      return (event: React.KeyboardEvent<HTMLElement>) => {
        // Call consumer's handler first
        existingOnKeyDown?.(event);

        // Only call internal handler if event wasn't handled/prevented
        if (!event.defaultPrevented) {
          keyboardNavigation.onKeyDown(event);
        }
      };
    },
    [keyboardNavigation.onKeyDown]
  );

  // Helper to safely extract onKeyDown from children props
  const getExistingOnKeyDown = React.useCallback((child: React.ReactElement) => {
    const props = child.props as Record<string, unknown>;
    return typeof props.onKeyDown === 'function'
      ? (props.onKeyDown as React.KeyboardEventHandler<HTMLElement>)
      : undefined;
  }, []);

  // Mobile: Use Dialog, Desktop: Use Popover
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={disabled ? undefined : onOpenChange}>
        <DialogTrigger asChild disabled={disabled}>
          {React.isValidElement(children)
            ? React.cloneElement(children, {
                tabIndex: disabled ? -1 : 0,
                onKeyDown: createMergedKeyboardHandler(getExistingOnKeyDown(children)),
                ...keyboardNavigation.ariaAttributes,
              } as React.HTMLAttributes<HTMLElement>)
            : children}
        </DialogTrigger>
        <DialogContent className="max-w-sm backdrop-blur-xs">
          <DialogHeader>
            <DialogTitle className="text-left">
              {currentView.type === 'groups' ? 'Add Filter' : currentView.groupLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto -mx-6 px-6">{commandContent}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : onOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              tabIndex: disabled ? -1 : 0,
              onKeyDown: createMergedKeyboardHandler(getExistingOnKeyDown(children)),
              ...keyboardNavigation.ariaAttributes,
            } as React.HTMLAttributes<HTMLElement>)
          : children}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {commandContent}
      </PopoverContent>
    </Popover>
  );
}
