'use client';

/**
 * @fileoverview Table browser panel for selecting schemas and tables for export.
 *
 * @module components/table/table-browser-panel
 */

import type { SchemaInfo, SchemaTableInfo } from '@better-tables/core';
import { ChevronDown, ChevronRight, Database } from 'lucide-react';
import * as React from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';

/**
 * Props for the TableBrowserPanel component.
 */
export interface TableBrowserPanelProps {
  /** Schema information from adapter */
  schemaInfo: SchemaInfo;

  /** Selected table names */
  selectedTables: Set<string>;

  /** Callback when table selection changes */
  onTableSelectionChange: (tableName: string, selected: boolean) => void;

  /** Callback to select all tables */
  onSelectAll?: () => void;

  /** Callback to deselect all tables */
  onDeselectAll?: () => void;
}

/**
 * Table browser panel component for selecting tables to export.
 *
 * Displays a tree view of schemas and tables with checkboxes for selection.
 */
export function TableBrowserPanel({
  schemaInfo,
  selectedTables,
  onTableSelectionChange,
  onSelectAll,
  onDeselectAll,
}: TableBrowserPanelProps): React.ReactElement {
  const [expandedSchemas, setExpandedSchemas] = React.useState<Set<string>>(
    new Set(Object.keys(schemaInfo.schemas))
  );

  const toggleSchema = React.useCallback((schemaName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }
      return next;
    });
  }, []);

  const allTables = React.useMemo(() => {
    const tables: Array<{ schema: string; table: SchemaTableInfo }> = [];
    for (const [schemaName, schemaTables] of Object.entries(schemaInfo.schemas)) {
      for (const table of schemaTables) {
        tables.push({ schema: schemaName, table });
      }
    }
    // Also include tables from the flat tables array if they're not in schemas
    for (const table of schemaInfo.tables) {
      if (!tables.some((t) => t.table.name === table.name)) {
        tables.push({ schema: table.schema || 'default', table });
      }
    }
    return tables;
  }, [schemaInfo]);

  const handleTableToggle = React.useCallback(
    (tableName: string) => {
      const isSelected = selectedTables.has(tableName);
      onTableSelectionChange(tableName, !isSelected);
    },
    [selectedTables, onTableSelectionChange]
  );

  const handleSelectAll = React.useCallback(() => {
    for (const { table } of allTables) {
      if (!selectedTables.has(table.name)) {
        onTableSelectionChange(table.name, true);
      }
    }
    onSelectAll?.();
  }, [allTables, selectedTables, onTableSelectionChange, onSelectAll]);

  const handleDeselectAll = React.useCallback(() => {
    for (const tableName of selectedTables) {
      onTableSelectionChange(tableName, false);
    }
    onDeselectAll?.();
  }, [selectedTables, onTableSelectionChange, onDeselectAll]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Tables ({selectedTables.size} selected)</Label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
            All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleDeselectAll}>
            None
          </Button>
        </div>
      </div>
      <ScrollArea className="h-64 rounded-md border">
        <div className="p-3 space-y-2">
          {Object.entries(schemaInfo.schemas).map(([schemaName, tables]) => {
            const isExpanded = expandedSchemas.has(schemaName);
            const schemaTableCount = tables.length;
            const selectedCount = tables.filter((t) => selectedTables.has(t.name)).length;

            return (
              <div key={schemaName} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSchema(schemaName)}
                  className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded px-2 py-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {schemaName === 'default' ? 'Tables' : `Schema: ${schemaName}`}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedCount}/{schemaTableCount}
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-6 space-y-1">
                    {tables.map((table) => {
                      const isSelected = selectedTables.has(table.name);
                      return (
                        <div
                          key={table.name}
                          className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`table-${table.name}`}
                            checked={isSelected}
                            onCheckedChange={() => handleTableToggle(table.name)}
                          />
                          <label
                            htmlFor={`table-${table.name}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            {table.name}
                          </label>
                          <span className="text-xs text-muted-foreground">
                            ({table.columnCount} columns)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {schemaInfo.tables.length > 0 && Object.keys(schemaInfo.schemas).length === 0 && (
            <div className="space-y-1">
              {schemaInfo.tables.map((table) => {
                const isSelected = selectedTables.has(table.name);
                return (
                  <div
                    key={table.name}
                    className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`table-${table.name}`}
                      checked={isSelected}
                      onCheckedChange={() => handleTableToggle(table.name)}
                    />
                    <label
                      htmlFor={`table-${table.name}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {table.name}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      ({table.columnCount} columns)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
