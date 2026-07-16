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

/** Inline size so icons render correctly even when Tailwind utilities are not scanned. */
const FILTER_MENU_ICON_SIZE = 14;

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
  /**
   * How columns not assigned to any group are shown. `'group'` (default)
   * buckets them into a collapsible drill-in group; `'inline'` lists them
   * directly at the top level.
   */
  ungroupedMode?: 'group' | 'inline';
  /** Label for the auto-generated bucket of ungrouped columns. */
  ungroupedLabel?: string;
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
  ungroupedMode = 'group',
  ungroupedLabel = 'Other',
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

  const matchesSearch = React.useCallback(
    (col: ColumnDefinition<TData>) => {
      if (!searchable || !search) return true;
      const q = search.toLowerCase();
      return col.displayName.toLowerCase().includes(q) || col.id.toLowerCase().includes(q);
    },
    [search, searchable]
  );

  // The top-level overview: an ordered, MIXED list of directly-selectable
  // columns and drill-in groups. A group renders inline (its columns flat at
  // the top level) when `group.inline` is set; otherwise it renders as a
  // drill-in row. Columns in no group follow `ungroupedMode`.
  type OverviewEntry =
    | { kind: 'column'; column: ColumnDefinition<TData> }
    | {
        kind: 'group';
        id: string;
        label: string;
        icon?: React.ComponentType<{ className?: string }>;
        description?: string;
        columns: ColumnDefinition<TData>[];
      };

  const overviewEntries = React.useMemo<OverviewEntry[]>(() => {
    if (!groups || groups.length === 0) return [];

    const entries: OverviewEntry[] = [];
    const assigned = new Set<string>();

    for (const group of groups) {
      // Assign against ALL of the group's columns (not just search hits) so a
      // non-matching column never leaks into the ungrouped bucket.
      for (const col of columns) {
        if (group.columns.includes(col.id)) assigned.add(col.id);
      }

      const groupColumns = columns.filter(
        (col) => group.columns.includes(col.id) && matchesSearch(col)
      );
      if (groupColumns.length === 0) continue;

      if (group.inline) {
        for (const column of groupColumns) entries.push({ kind: 'column', column });
      } else {
        entries.push({
          kind: 'group',
          id: group.id,
          label: group.label,
          columns: groupColumns,
          ...(group.icon !== undefined && {
            icon: group.icon as React.ComponentType<{ className?: string }>,
          }),
          ...(group.description !== undefined && { description: group.description }),
        });
      }
    }

    const ungrouped = columns.filter((col) => !assigned.has(col.id) && matchesSearch(col));
    if (ungrouped.length > 0) {
      if (ungroupedMode === 'inline') {
        for (const column of ungrouped) entries.push({ kind: 'column', column });
      } else {
        entries.push({ kind: 'group', id: 'other', label: ungroupedLabel, columns: ungrouped });
      }
    }

    return entries;
  }, [groups, columns, matchesSearch, ungroupedMode, ungroupedLabel]);

  // The subset of overview entries that are drill-in groups — used by the
  // detail view and keyboard navigation to resolve a group's columns.
  const drillInGroups = React.useMemo(
    () =>
      overviewEntries.filter(
        (entry): entry is Extract<OverviewEntry, { kind: 'group' }> => entry.kind === 'group'
      ),
    [overviewEntries]
  );

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
      // Flat list: no groups, or an active search collapses to filtered columns.
      if (!groups || groups.length === 0 || (searchable && !!search)) {
        const column = filteredColumns[index];
        if (column) handleSelect(column.id);
        return;
      }

      if (currentView.type === 'groups') {
        const entry = overviewEntries[index];
        if (!entry) return;
        if (entry.kind === 'column') {
          handleSelect(entry.column.id);
        } else {
          handleGroupSelect(entry.id, entry.label);
        }
      } else {
        // Navigate to a column within the drilled-in group.
        const currentGroup = drillInGroups.find((g) => g.id === currentView.groupId);
        const column = currentGroup?.columns[index];
        if (column) handleSelect(column.id);
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
                  className="cursor-pointer pl-4 hover:bg-accent/50 transition-colors"
                >
                  <Check size={FILTER_MENU_ICON_SIZE} className="opacity-0" />
                  {Icon && <Icon className="size-3.5 text-muted-foreground" />}
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
                  className="cursor-pointer pl-4 hover:bg-accent/50 transition-colors"
                >
                  <Check size={FILTER_MENU_ICON_SIZE} className="opacity-0" />
                  {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                  <span>{column.displayName}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      );
    }

    // Otherwise, show the mixed overview: top-level columns + drill-in groups.
    return (
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {overviewEntries.map((entry) => {
            if (entry.kind === 'column') {
              const Icon = entry.column.icon;
              return (
                <CommandItem
                  key={`col:${entry.column.id}`}
                  value={entry.column.id}
                  onSelect={() => handleSelect(entry.column.id)}
                  disabled={disabled}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                  <span>{entry.column.displayName}</span>
                </CommandItem>
              );
            }

            const Icon = entry.icon;
            const columnCount = entry.columns.length;
            return (
              <CommandItem
                key={`grp:${entry.id}`}
                value={entry.id}
                onSelect={() => handleGroupSelect(entry.id, entry.label)}
                disabled={disabled}
                className="cursor-pointer"
              >
                {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{entry.label}</span>
                  {entry.description && (
                    <span className="text-xs text-muted-foreground">{entry.description}</span>
                  )}
                </div>
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  {columnCount}
                  <ChevronRight size={FILTER_MENU_ICON_SIZE} strokeWidth={2} />
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    );
  }, [
    groups,
    overviewEntries,
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

    const currentGroup = drillInGroups.find((g) => g.id === currentView.groupId);
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
            <ArrowLeft size={FILTER_MENU_ICON_SIZE} strokeWidth={2} />
          </Button>
          <div className="flex-1">
            <h3 className="text-sm font-semibold tracking-tight">{currentView.groupLabel}</h3>
            <p className="text-xs text-muted-foreground tabular-nums">
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
                  className="cursor-pointer pl-4 hover:bg-accent/50 transition-colors"
                >
                  <Check size={FILTER_MENU_ICON_SIZE} className="opacity-0" />
                  {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                  <span>{column.displayName}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </div>
    );
  }, [currentView, drillInGroups, disabled, handleBackToGroups, handleSelect]);

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
        <DialogTrigger
          disabled={disabled}
          render={
            React.isValidElement(children) ? (
              React.cloneElement(children, {
                tabIndex: disabled ? -1 : 0,
                onKeyDown: createMergedKeyboardHandler(getExistingOnKeyDown(children)),
                ...keyboardNavigation.ariaAttributes,
              } as React.HTMLAttributes<HTMLElement>)
            ) : (
              <Button disabled={disabled} />
            )
          }
        />
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
      <PopoverTrigger
        disabled={disabled}
        render={
          React.isValidElement(children) ? (
            React.cloneElement(children, {
              tabIndex: disabled ? -1 : 0,
              onKeyDown: createMergedKeyboardHandler(getExistingOnKeyDown(children)),
              ...keyboardNavigation.ariaAttributes,
            } as React.HTMLAttributes<HTMLElement>)
          ) : (
            <Button disabled={disabled} />
          )
        }
      />
      <PopoverContent className="w-64 p-0" align="start">
        {commandContent}
      </PopoverContent>
    </Popover>
  );
}
