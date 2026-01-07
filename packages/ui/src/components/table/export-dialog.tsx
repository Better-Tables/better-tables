'use client';

/**
 * @fileoverview Export dialog component for advanced export configuration.
 *
 * This component provides a dialog for configuring export options including
 * format selection, column selection, and batch settings.
 *
 * @module components/table/export-dialog
 */

import type {
  ColumnDefinition,
  CsvExportOptions,
  ExportConfig,
  ExportFormat,
  ExportMode,
  ExportProgress,
  SchemaInfo,
  SqlExportOptions,
  TableAdapter,
} from '@better-tables/core';
import { formatDuration, formatFileSize } from '@better-tables/core';
import {
  CheckCircle2,
  Download,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
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
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { CsvOptionsPanel } from './csv-options-panel';
import { SqlOptionsPanel } from './sql-options-panel';
import { TableBrowserPanel } from './table-browser-panel';

/**
 * Props for the ExportDialog component.
 */
export interface ExportDialogProps<TData = unknown> {
  /** Column definitions for column selection */
  columns: ColumnDefinition<TData>[];

  /** Total number of rows to export */
  totalRows: number;

  /** Callback when export is confirmed */
  onExport: (config: ExportConfig) => void;

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

  /** Trigger element */
  trigger?: React.ReactNode;

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

  /** Adapter instance for schema information (optional, for table export mode) */
  adapter?: TableAdapter<unknown>;

  /** Schema information (optional, if provided directly) */
  schemaInfo?: SchemaInfo;

  /** Initial export mode when dialog opens */
  initialMode?: ExportMode;
}

/**
 * Format option configuration.
 */
interface FormatOption {
  value: ExportFormat;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'csv',
    label: 'CSV',
    icon: FileText,
  },
  {
    value: 'excel',
    label: 'Excel',
    icon: FileSpreadsheet,
  },
  {
    value: 'json',
    label: 'JSON',
    icon: FileJson,
  },
  {
    value: 'sql',
    label: 'SQL',
    icon: FileCode,
  },
];

/**
 * Export dialog with advanced configuration options.
 *
 * @example
 * ```tsx
 * function TableToolbar() {
 *   const { startExport, isExporting, progress, cancelExport, lastResult } = useExport({
 *     columns,
 *     adapter,
 *   });
 *
 *   return (
 *     <ExportDialog
 *       columns={columns}
 *       totalRows={1500}
 *       onExport={startExport}
 *       isExporting={isExporting}
 *       progress={progress}
 *       lastResult={lastResult}
 *       onCancel={cancelExport}
 *       trigger={
 *         <Button variant="outline">
 *           <Download className="mr-2 h-4 w-4" />
 *           Export Data
 *         </Button>
 *       }
 *     />
 *   );
 * }
 * ```
 */
export function ExportDialog<TData = unknown>({
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
  trigger,
  open: controlledOpen,
  onOpenChange,
  selectedRowCount = 0,
  exportSelectedOnly = false,
  onExportSelectedChange,
  adapter,
  schemaInfo: providedSchemaInfo,
  initialMode = 'columns',
}: ExportDialogProps<TData>): React.ReactElement {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [exportMode, setExportMode] = React.useState<ExportMode>(initialMode);
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>('csv');
  const [filename, setFilename] = React.useState(defaultFilename);
  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(
    new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id))
  );
  const [selectedTables, setSelectedTables] = React.useState<Set<string>>(new Set());
  const [batchSize, setBatchSize] = React.useState(1000);
  const [exportSelected, setExportSelected] = React.useState(exportSelectedOnly);
  const [csvOptions, setCsvOptions] = React.useState<CsvExportOptions>({});
  const [sqlOptions, setSqlOptions] = React.useState<SqlExportOptions>({});
  const [schemaInfo, setSchemaInfo] = React.useState<SchemaInfo | null>(providedSchemaInfo || null);

  // Load schema info from adapter if available
  React.useEffect(() => {
    if (adapter && !schemaInfo && adapter.getSchemaInfo) {
      const info = adapter.getSchemaInfo();
      if (info instanceof Promise) {
        info.then(setSchemaInfo).catch(() => {
          // Silently fail - table export mode just won't be available
        });
      } else {
        setSchemaInfo(info);
      }
    }
  }, [adapter, schemaInfo]);

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const hasSelectedRows = selectedRowCount > 0;
  const rowsToExport = exportSelected && hasSelectedRows ? selectedRowCount : totalRows;

  // Update export mode when initialMode prop changes (e.g., when user selects different option from dropdown)
  React.useEffect(() => {
    setExportMode(initialMode);
  }, [initialMode]);

  // Reset state when dialog opens OR when lastResult is cleared (for new export)
  React.useEffect(() => {
    if (isOpen && !lastResult) {
      setSelectedFormat('csv');
      setFilename(defaultFilename);
      setExportMode(initialMode);
      setSelectedColumns(
        new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id))
      );
      setSelectedTables(new Set());
      setCsvOptions({});
      setSqlOptions({});
    }
  }, [isOpen, columns, defaultFilename, lastResult, initialMode]);

  // Handler to start a new export after completion
  const handleNewExport = React.useCallback(() => {
    // Clear parent state and reset local state
    onReset?.();
    setSelectedFormat('csv');
    setFilename(defaultFilename);
    setExportMode(initialMode);
    setSelectedColumns(new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id)));
    setSelectedTables(new Set());
    setExportSelected(false);
    setCsvOptions({});
    setSqlOptions({});
  }, [columns, defaultFilename, onReset, initialMode]);

  // Handle export selected toggle
  const handleExportSelectedToggle = React.useCallback(
    (checked: boolean) => {
      setExportSelected(checked);
      onExportSelectedChange?.(checked);
    },
    [onExportSelectedChange]
  );

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

  const handleTableSelectionChange = React.useCallback((tableName: string, selected: boolean) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(tableName);
      } else {
        next.delete(tableName);
      }
      return next;
    });
  }, []);

  const handleExport = React.useCallback(() => {
    const config: ExportConfig & { exportSelectedOnly?: boolean } = {
      format: selectedFormat,
      filename,
      mode: exportMode,
      columns:
        exportMode === 'columns'
          ? Array.from(selectedColumns).map((id) => ({ columnId: id }))
          : undefined,
      batch: { batchSize },
      exportSelectedOnly: exportSelected && hasSelectedRows,
      csv: selectedFormat === 'csv' ? csvOptions : undefined,
      sql:
        selectedFormat === 'sql'
          ? {
              ...sqlOptions,
              selectedTables: exportMode === 'tables' ? Array.from(selectedTables) : undefined,
            }
          : undefined,
    };
    onExport(config);
  }, [
    selectedFormat,
    filename,
    exportMode,
    selectedColumns,
    selectedTables,
    batchSize,
    csvOptions,
    sqlOptions,
    onExport,
    exportSelected,
    hasSelectedRows,
  ]);

  const availableFormats = FORMAT_OPTIONS.filter((f) => formats.includes(f.value));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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
            {/* Mode Selection */}
            {schemaInfo && (
              <>
                <div className="space-y-2">
                  <Label>Export Mode</Label>
                  <Select
                    value={exportMode}
                    onValueChange={(value) => setExportMode(value as ExportMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="columns">Export with Column Selection</SelectItem>
                      <SelectItem value="tables">Export Tables</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
              </>
            )}

            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Format</Label>
              <div
                className={`grid gap-2 ${availableFormats.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
              >
                {availableFormats.map((format) => {
                  const Icon = format.icon;
                  const isSelected = selectedFormat === format.value;
                  return (
                    <button
                      key={format.value}
                      type="button"
                      onClick={() => setSelectedFormat(format.value)}
                      className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <div className="font-medium">{format.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Rows Option */}
            {hasSelectedRows && (
              <>
                <Separator />
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
              </>
            )}

            <Separator />

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

            {/* Table Browser or Column Selection based on mode */}
            {exportMode === 'tables' && schemaInfo ? (
              <TableBrowserPanel
                schemaInfo={schemaInfo}
                selectedTables={selectedTables}
                onTableSelectionChange={handleTableSelectionChange}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Columns ({selectedColumns.size} selected)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllColumns}
                    >
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
            )}

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
                    detectedDialect={schemaInfo?.dialect}
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
              <Button
                onClick={handleExport}
                disabled={
                  (exportMode === 'columns' && selectedColumns.size === 0) ||
                  (exportMode === 'tables' && selectedTables.size === 0) ||
                  !filename
                }
              >
                <Download className="mr-2 h-4 w-4" />
                {exportMode === 'tables'
                  ? `Export ${selectedTables.size} Table${selectedTables.size !== 1 ? 's' : ''}`
                  : `Export ${rowsToExport.toLocaleString()} Row${rowsToExport !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Export progress section within dialog.
 */
function ExportProgressSection({
  progress,
  onCancel,
}: {
  progress: ExportProgress;
  onCancel?: () => void;
}): React.ReactElement {
  return (
    <div className="py-8 text-center">
      <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
      <div className="mt-4">
        <div className="text-lg font-medium">Exporting...</div>
        <div className="text-sm text-muted-foreground">
          {progress.processedRows.toLocaleString()} of {progress.totalRows.toLocaleString()} rows
        </div>
      </div>
      <div className="mt-4 mx-auto h-2 w-64 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {progress.percentage}% complete
        {progress.estimatedTimeRemaining && (
          <> • ~{formatDuration(progress.estimatedTimeRemaining)} remaining</>
        )}
      </div>
      {onCancel && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}

/**
 * Export result section within dialog.
 */
function ExportResultSection({
  result,
}: {
  result: {
    success: boolean;
    filename: string;
    rowCount: number;
    fileSize?: number;
    duration?: number;
    error?: string;
  };
}): React.ReactElement {
  if (!result.success) {
    return (
      <div className="py-8 text-center">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <div className="mt-4">
          <div className="text-lg font-medium">Export Failed</div>
          <div className="text-sm text-muted-foreground">
            {result.error ?? 'An unknown error occurred'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
      <div className="mt-4">
        <div className="text-lg font-medium">Export Complete</div>
        <div className="text-sm text-muted-foreground">{result.filename}</div>
      </div>
      <div className="mt-4 flex justify-center gap-4 text-sm text-muted-foreground">
        <span>{result.rowCount.toLocaleString()} rows</span>
        {result.fileSize && <span>{formatFileSize(result.fileSize)}</span>}
        {result.duration && <span>{formatDuration(result.duration)}</span>}
      </div>
    </div>
  );
}
