'use client';

import * as React from 'react';
import type { ColumnDefinition, FilterGroup } from '@better-tables/core';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useKeyboardNavigation, useFilterDropdownNavigation } from '@/hooks';

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
  
  // Filter columns based on search
  const filteredColumns = React.useMemo(() => {
    if (!searchable || !search) return columns;
    
    const searchLower = search.toLowerCase();
    return columns.filter(column =>
      column.displayName.toLowerCase().includes(searchLower) ||
      column.id.toLowerCase().includes(searchLower)
    );
  }, [columns, search, searchable]);
  
  // Group columns if groups are provided - optimized with deeper dependencies
  const groupedColumns = React.useMemo(() => {
    if (!groups || groups.length === 0) {
      return [{ id: 'all', label: 'All Columns', columns: filteredColumns }];
    }
    
    const grouped: Array<{ id: string; label: string; icon?: React.ComponentType<any>; columns: ColumnDefinition<TData>[] }> = [];
    const assignedColumnIds = new Set<string>();
    
    // Process each group
    groups.forEach(group => {
      const groupColumns = filteredColumns.filter(col => 
        group.columns.includes(col.id)
      );
      
      if (groupColumns.length > 0) {
        grouped.push({
          id: group.id,
          label: group.label,
          icon: group.icon as React.ComponentType<any>,
          columns: groupColumns,
        });
        
        groupColumns.forEach(col => assignedColumnIds.add(col.id));
      }
    });
    
    // Add ungrouped columns
    const ungroupedColumns = filteredColumns.filter(col => 
      !assignedColumnIds.has(col.id)
    );
    
    if (ungroupedColumns.length > 0) {
      grouped.push({
        id: 'other',
        label: 'Other',
        columns: ungroupedColumns,
      });
    }
    
    return grouped;
  }, [groups, filteredColumns]);
  
  const handleSelect = React.useCallback((columnId: string) => {
    if (disabled) return;
    onSelect(columnId);
    if (onSearchChange) {
      onSearchChange('');
    } else {
      setInternalSearch('');
    }
    onOpenChange?.(false);
  }, [disabled, onSelect, onSearchChange, onOpenChange]);

  // Keyboard navigation for dropdown
  const dropdownNavigation = useFilterDropdownNavigation(
    open || false,
    () => onOpenChange?.(true),
    () => onOpenChange?.(false),
    (index) => {
      // Find the column at the given index
      const allColumns = groupedColumns.reduce((acc, group) => acc.concat(group.columns), [] as ColumnDefinition<TData>[]);
      const column = allColumns[index];
      if (column) {
        handleSelect(column.id);
      }
    }
  );

  // Enhanced keyboard navigation
  const keyboardNavigation = useKeyboardNavigation({
    onEscape: () => onOpenChange?.(false),
    onEnter: () => {
      if (!open) {
        onOpenChange?.(true);
      }
    },
    shortcuts: {
      'Ctrl+k': () => onOpenChange?.(true),
      'Ctrl+f': () => onOpenChange?.(true),
    },
  });
  
  // Command content component for reuse
  const CommandContent = (
    <Command onKeyDown={dropdownNavigation.handleKeyDown}>
      {searchable && (
        <CommandInput
          placeholder={searchPlaceholder}
          value={search}
          onValueChange={setSearch}
          disabled={disabled}
        />
      )}
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {groupedColumns.map((group, index) => (
          <React.Fragment key={group.id}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group.label}>
              {group.columns.map(column => {
                const Icon = column.icon;
                return (
                  <CommandItem
                    key={column.id}
                    value={column.id}
                    onSelect={() => handleSelect(column.id)}
                    disabled={disabled}
                    className="flex items-center"
                  >
                    <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    <span>{column.displayName}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
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
            <DialogTitle>Add Filter</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {CommandContent}
          </div>
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
      <PopoverContent className="w-[200px] p-0" align="start">
        {CommandContent}
      </PopoverContent>
    </Popover>
  );
} 