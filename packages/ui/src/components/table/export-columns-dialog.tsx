'use client';

/**
 * @fileoverview Export columns dialog component for exporting with column selection.
 *
 * @module components/table/export-columns-dialog
 */

import type {
  ColumnDefinition,
  ExportConfig,
  ExportFormat,
  ExportProgress,
  SchemaInfo,
  TableAdapter,
} from '@better-tables/core';
import { Download } from 'lucide-react';
import * as React from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { CsvOptionsPanel } from './csv-options-panel';
import { ExportFormatSelector } from './export-format-selector';
import { ExportProgressSection } from './export-progress-section';
import { ExportResultSection } from './export-result-section';
import { useExportDialogState } from './use-export-dialog-state';
import { SqlOptionsPanel } from './sql-options-panel';

/**
 * Props for the ExportColumnsDialog component.
 */
export interface ExportColumnsDialogProps<TData = unknown> {
  /** Column definitions for column selection */
  columns: ColumnDefinition<TData>[];

  /** Total number of rows to export */
  totalRows: number;

  /** Callback when export is confirmed */
  onExport: (config: ExportConfig & { exportSelectedOnly?: boolean }) => void;

  /** Whether an export is in progress */
  isExporting?: boolean;

  /** Current export progress */
  progress?: ExportProgress | null;

  /** Last export result */
  lastResult?: {
    success: boolean;
    filename: string;
    rowCount: number;
    fileSize?: number;
    duration?: number;
    error?: string;
  } | null;

  /** Callback to cancel export */
  onCancel?: () => void;

  /** Callback to reset state for new export */
  onReset?: () => void;

  /** Available export formats */
  formats?: ExportFormat[];

  /** Default filename */
  defaultFilename?: string;

  /** Whether dialog is open */
  open?: boolean;

  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;

  /** Number of selected rows (if any) */
  selectedRowCount?: number;

  /** Whether to export only selected rows */
  exportSelectedOnly?: boolean;

  /** Callback when export selected toggle changes */
  onExportSelectedChange?: (exportSelected: boolean) => void;

  /** Adapter for dialect detection in SQL options */
  adapter?: TableAdapter<unknown>;

  /** Schema info for dialect detection in SQL options */
  schemaInfo?: SchemaInfo;
}

/**
 * Export columns dialog component.
 */
export function ExportColumnsDialog<TData = unknown>({
  columns,
  totalRows,
  onExport,
  isExporting = false,
  progress,
  lastResult,
  onCancel,
  onReset,
  formats = ['csv', 'excel', 'json'],
  defaultFilename = 'export',
  open: controlledOpen,
  onOpenChange,
  selectedRowCount = 0,
  exportSelectedOnly = false,
  onExportSelectedChange,
  adapter,
  schemaInfo: providedSchemaInfo,
}: ExportColumnsDialogProps<TData>): React.ReactElement {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(
    new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id))
  );
  const [exportSelected, setExportSelected] = React.useState(exportSelectedOnly);

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const hasSelectedRows = selectedRowCount > 0;
  const rowsToExport = exportSelected && hasSelectedRows ? selectedRowCount : totalRows;

  // Use shared state hook
  const {
    selectedFormat,
    setSelectedFormat,
    filename,
    setFilename,
    csvOptions,
    setCsvOptions,
    sqlOptions,
    setSqlOptions,
    batchSize,
    setBatchSize,
  } = useExportDialogState({
    defaultFilename,
    formats,
    isOpen,
    hasLastResult: !!lastResult,
  });

  // Reset column selection when dialog opens
  React.useEffect(() => {
    if (isOpen && !lastResult) {
      setSelectedColumns(
        new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id))
      );
      setExportSelected(exportSelectedOnly);
    }
  }, [isOpen, lastResult, columns, exportSelectedOnly]);

  const handleColumnToggle = React.useCallback((columnId: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  const handleSelectAllColumns = React.useCallback(() => {
    setSelectedColumns(new Set(columns.map((c) => c.id)));
  }, [columns]);

  const handleDeselectAllColumns = React.useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

  const handleExportSelectedToggle = React.useCallback(
    (checked: boolean) => {
      setExportSelected(checked);
      onExportSelectedChange?.(checked);
    },
    [onExportSelectedChange]
  );

  const handleExport = React.useCallback(() => {
    const config: ExportConfig & { exportSelectedOnly?: boolean } = {
      format: selectedFormat,
      filename,
      mode: 'columns',
      columns: Array.from(selectedColumns).map((id) => ({ columnId: id })),
      batch: { batchSize },
      exportSelectedOnly: exportSelected && hasSelectedRows,
      csv: selectedFormat === 'csv' ? csvOptions : undefined,
      sql: selectedFormat === 'sql' ? sqlOptions : undefined,
    };
    onExport(config);
  }, [
    selectedFormat,
    filename,
    selectedColumns,
    batchSize,
    csvOptions,
    sqlOptions,
    onExport,
    exportSelected,
    hasSelectedRows,
  ]);

  const handleNewExport = React.useCallback(() => {
    onReset?.();
    setSelectedColumns(new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id)));
    setExportSelected(exportSelectedOnly);
  }, [columns, exportSelectedOnly, onReset]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            {hasSelectedRows && exportSelected
              ? `Export ${selectedRowCount.toLocaleString()} selected rows to your preferred format.`
              : `Export ${totalRows.toLocaleString()} rows to your preferred format.`}
          </DialogDescription>
        </DialogHeader>

        {/* Export Progress */}
        {isExporting && progress && (
          <ExportProgressSection progress={progress} onCancel={onCancel} />
        )}

        {/* Export Result */}
        {!isExporting && lastResult && <ExportResultSection result={lastResult} />}

        {/* Configuration Form */}
        {!isExporting && !lastResult && (
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Format Selection */}
            <ExportFormatSelector
              formats={formats}
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />

            <Separator />

            {/* Export Selected Rows Toggle */}
            {hasSelectedRows && (
              <>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <div className="font-medium">Export Selected Rows Only</div>
                    <div className="text-xs text-muted-foreground">
                      Export {selectedRowCount.toLocaleString()} selected row
                      {selectedRowCount !== 1 ? 's' : ''} instead of all{' '}
                      {totalRows.toLocaleString()}
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={exportSelected}
                      onChange={(e) => handleExportSelectedToggle(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-muted peer-checked:bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary peer-focus:ring-offset-2 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>
                <Separator />
              </>
            )}

            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="filename">Filename</Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter filename"
              />
            </div>

            <Separator />

            {/* Column Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Columns ({selectedColumns.size} selected)</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllColumns}>
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAllColumns}
                  >
                    None
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-3 space-y-2">
                  {columns.map((column) => (
                    <div key={column.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`column-${column.id}`}
                        checked={selectedColumns.has(column.id)}
                        onCheckedChange={() => handleColumnToggle(column.id)}
                      />
                      <label
                        htmlFor={`column-${column.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {column.displayName}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Format-specific Options */}
            <Separator />
            <details className="space-y-2">
              <summary className="cursor-pointer text-sm font-medium">
                {selectedFormat.toUpperCase()} Options
              </summary>
              <div className="pt-2 space-y-2">
                {selectedFormat === 'csv' && (
                  <CsvOptionsPanel options={csvOptions} onOptionsChange={setCsvOptions} />
                )}
                {selectedFormat === 'sql' && (
                  <SqlOptionsPanel
                    options={sqlOptions}
                    detectedDialect={providedSchemaInfo?.dialect}
                    onOptionsChange={setSqlOptions}
                  />
                )}
                {selectedFormat === 'json' && (
                  <p className="text-sm text-muted-foreground">JSON options: as is</p>
                )}
              </div>
            </details>

            {/* Advanced Options */}
            <details className="space-y-2">
              <summary className="cursor-pointer text-sm font-medium">Advanced Options</summary>
              <div className="pt-2 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="batchSize">Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    min={100}
                    max={10000}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of rows to process at once. Lower values use less memory.
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          {isExporting ? (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : lastResult ? (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
              <Button onClick={handleNewExport}>
                <Download className="mr-2 h-4 w-4" />
                Export Another
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={selectedColumns.size === 0 || !filename}>
                <Download className="mr-2 h-4 w-4" />
                Export {rowsToExport.toLocaleString()} Row{rowsToExport !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
