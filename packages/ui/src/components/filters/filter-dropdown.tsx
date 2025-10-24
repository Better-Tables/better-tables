'use client';

import type { ColumnDefinition, FilterGroup } from '@better-tables/core';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFilterDropdownNavigation, useKeyboardNavigation } from '@/hooks';
import { cn } from '@/lib/utils';

export interface FilterDropdownProps<TData = any> {
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

export function FilterDropdown<TData = any>({
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

  // Reset view when dropdown opens/closes
  React.useEffect(() => {
    if (open) {
      setCurrentView({ type: 'groups' });
      if (onSearchChange) {
        onSearchChange('');
      } else {
        setInternalSearch('');
      }
    }
  }, [open, onSearchChange]);

  // Use controlled search if provided, otherwise use internal state
  const search = searchTerm !== undefined ? searchTerm : internalSearch;
  const setSearch = onSearchChange || setInternalSearch;

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
    if (!groups || groups.length === 0) {
      return [
        {
          id: 'all',
          label: 'All Columns',
          columns: filteredColumns,
          description: undefined,
          icon: undefined,
        },
      ];
    }

    const grouped: Array<{
      id: string;
      label: string;
      icon?: React.ComponentType<any>;
      columns: ColumnDefinition<TData>[];
      description?: string;
    }> = [];
    const assignedColumnIds = new Set<string>();

    // Process each group
    groups.forEach((group) => {
      const groupColumns = filteredColumns.filter((col) => group.columns.includes(col.id));

      if (groupColumns.length > 0) {
        grouped.push({
          id: group.id,
          label: group.label,
          icon: group.icon as React.ComponentType<any>,
          columns: groupColumns,
          description: group.description,
        });

        groupColumns.forEach((col) => assignedColumnIds.add(col.id));
      }
    });

    // Add ungrouped columns
    const ungroupedColumns = filteredColumns.filter((col) => !assignedColumnIds.has(col.id));

    if (ungroupedColumns.length > 0) {
      grouped.push({
        id: 'other',
        label: 'Other',
        columns: ungroupedColumns,
        description: 'Miscellaneous columns',
      });
    }

    return grouped;
  }, [groups, filteredColumns]);

  const handleSelect = React.useCallback(
    (columnId: string) => {
      if (disabled) return;
      onSelect(columnId);
      if (onSearchChange) {
        onSearchChange('');
      } else {
        setInternalSearch('');
      }
      onOpenChange?.(false);
    },
    [disabled, onSelect, onSearchChange, onOpenChange]
  );

  const handleGroupSelect = React.useCallback(
    (groupId: string, groupLabel: string) => {
      setCurrentView({ type: 'group', groupId, groupLabel });
      // Clear search when navigating to group
      if (onSearchChange) {
        onSearchChange('');
      } else {
        setInternalSearch('');
      }
    },
    [onSearchChange]
  );

  const handleBackToGroups = React.useCallback(() => {
    setCurrentView({ type: 'groups' });
  }, []);

  // Keyboard navigation for dropdown
  const dropdownNavigation = useFilterDropdownNavigation(
    open || false,
    () => onOpenChange?.(true),
    () => onOpenChange?.(false),
    (index) => {
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
      'Ctrl+k': () => onOpenChange?.(true),
      'Ctrl+f': () => onOpenChange?.(true),
      Backspace: () => {
        if (currentView.type === 'group') {
          handleBackToGroups();
        }
      },
    },
  });

  // Render groups overview
  const groupsOverview = React.useMemo(
    () => (
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
    ),
    [groupedColumns, disabled, emptyMessage, handleGroupSelect]
  );

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
    <Command onKeyDown={dropdownNavigation.handleKeyDown}>
      {/* Only show search in groups overview or when there's no grouping */}
      {searchable && currentView.type === 'groups' && (
        <CommandInput
          placeholder={searchPlaceholder}
          value={search}
          onValueChange={setSearch}
          disabled={disabled}
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
          <div className="w-full flex-shrink-0">{groupsOverview}</div>

          {/* Group details panel */}
          <div className="w-full flex-shrink-0">{groupView}</div>
        </div>
      </div>
    </Command>
  );

  // Mobile: Use Dialog, Desktop: Use Popover
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={disabled ? undefined : onOpenChange}>
        <DialogTrigger asChild disabled={disabled}>
          <div onKeyDown={keyboardNavigation.onKeyDown} {...keyboardNavigation.ariaAttributes}>
            {children}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-sm backdrop-blur-sm">
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
        <div onKeyDown={keyboardNavigation.onKeyDown} {...keyboardNavigation.ariaAttributes}>
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {commandContent}
      </PopoverContent>
    </Popover>
  );
}
