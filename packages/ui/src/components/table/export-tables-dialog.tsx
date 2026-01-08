'use client';

/**
 * @fileoverview Export tables dialog component for exporting entire database tables.
 *
 * @module components/table/export-tables-dialog
 */

import type {
  CsvExportOptions,
  ExportConfig,
  ExportFormat,
  ExportProgress,
  SchemaInfo,
  SchemaTableInfo,
  SqlExportOptions,
  TableAdapter,
} from '@better-tables/core';
import { getSchemaInfoSafe, supportsSchemaIntrospection } from '@better-tables/core';
import { ChevronDown, ChevronRight, Database, Download, Loader2, XCircle } from 'lucide-react';
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
import { ERDDialog } from './erd-dialog';
import { ExportFormatSelector } from './export-format-selector';
import { ExportProgressSection } from './export-progress-section';
import { ExportResultSection } from './export-result-section';
import { SqlOptionsPanel } from './sql-options-panel';

/**
 * Props for the ExportTablesDialog component.
 */
export interface ExportTablesDialogProps {
  /** Total number of rows (for display) */
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

  /** Whether dialog is open */
  open?: boolean;

  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;

  /** Adapter instance for schema information */
  adapter?: TableAdapter<unknown>;

  /** Schema information (optional, if provided directly) */
  schemaInfo?: SchemaInfo;
}

/**
 * Table selection state with SQL-specific options per table.
 */
interface TableSelectionState {
  selected: boolean;
  includeStructure?: boolean;
  includeDrop?: boolean;
  includeData?: boolean;
}

/**
 * Export tables dialog component.
 */
export function ExportTablesDialog({
  onExport,
  isExporting = false,
  progress,
  lastResult,
  onCancel,
  onReset,
  formats = ['csv', 'excel', 'json', 'sql'],
  defaultFilename = 'export',
  open: controlledOpen,
  onOpenChange,
  adapter,
  schemaInfo: providedSchemaInfo,
}: ExportTablesDialogProps): React.ReactElement {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>(formats[0] || 'csv');
  const [filename, setFilename] = React.useState(defaultFilename);
  const [csvOptions, setCsvOptions] = React.useState<CsvExportOptions>({});
  const [sqlOptions, setSqlOptions] = React.useState<SqlExportOptions>({});
  const [batchSize, setBatchSize] = React.useState(1000);
  const [schemaInfo, setSchemaInfo] = React.useState<SchemaInfo | null>(providedSchemaInfo || null);
  const [isLoadingSchema, setIsLoadingSchema] = React.useState(false);
  const [schemaError, setSchemaError] = React.useState<string | null>(null);
  const [expandedSchemas, setExpandedSchemas] = React.useState<Set<string>>(new Set());
  const [tableSelections, setTableSelections] = React.useState<Map<string, TableSelectionState>>(
    new Map()
  );
  const [viewMode, setViewMode] = React.useState<'list' | 'erd'>('list');
  const [useZipForMultiFile, setUseZipForMultiFile] = React.useState(true);

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const isSqlFormat = selectedFormat === 'sql';

  // Load schema info from adapter if available
  React.useEffect(() => {
    setSchemaError(null);

    if (providedSchemaInfo) {
      setSchemaInfo(providedSchemaInfo);
      setIsLoadingSchema(false);
      return;
    }

    if (!adapter) {
      setSchemaError('No adapter provided');
      setIsLoadingSchema(false);
      return;
    }

    if (!supportsSchemaIntrospection(adapter)) {
      setSchemaError('Adapter does not support schema introspection');
      setIsLoadingSchema(false);
      return;
    }

    setIsLoadingSchema(true);
    getSchemaInfoSafe(adapter)
      .then((info) => {
        if (info) {
          setSchemaInfo(info);
          setSchemaError(null);
          // Expand all schemas by default
          setExpandedSchemas(new Set(Object.keys(info.schemas)));
        } else {
          setSchemaError('Failed to load schema information');
        }
        setIsLoadingSchema(false);
      })
      .catch((error) => {
        setSchemaError(error instanceof Error ? error.message : 'Failed to load schema');
        setIsLoadingSchema(false);
      });
  }, [adapter, providedSchemaInfo]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen && !lastResult) {
      setTableSelections(new Map());
      setFilename(defaultFilename);
      setSelectedFormat(formats[0] || 'csv');
    }
  }, [isOpen, lastResult, defaultFilename, formats]);

  // Initialize SQL options from global sqlOptions
  React.useEffect(() => {
    if (isSqlFormat && schemaInfo) {
      // Initialize table selections with global SQL options
      const newSelections = new Map<string, TableSelectionState>();
      for (const table of schemaInfo.tables) {
        newSelections.set(table.name, {
          selected: false,
          includeStructure: sqlOptions.includeStructure ?? true,
          includeDrop: sqlOptions.includeDrop ?? false,
          includeData: sqlOptions.includeData ?? true,
        });
      }
      setTableSelections(newSelections);
    }
  }, [
    isSqlFormat,
    schemaInfo,
    sqlOptions.includeStructure,
    sqlOptions.includeDrop,
    sqlOptions.includeData,
  ]);

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

  const handleTableToggle = React.useCallback(
    (tableName: string) => {
      setTableSelections((prev) => {
        const next = new Map(prev);
        const current = next.get(tableName);
        next.set(tableName, {
          selected: !current?.selected,
          includeStructure: current?.includeStructure ?? sqlOptions.includeStructure ?? true,
          includeDrop: current?.includeDrop ?? sqlOptions.includeDrop ?? false,
          includeData: current?.includeData ?? sqlOptions.includeData ?? true,
        });
        return next;
      });
    },
    [sqlOptions]
  );

  const handleSelectAll = React.useCallback(() => {
    if (!schemaInfo) return;
    setTableSelections((prev) => {
      const next = new Map(prev);
      for (const table of schemaInfo.tables) {
        const current = next.get(table.name);
        next.set(table.name, {
          selected: true,
          includeStructure: current?.includeStructure ?? sqlOptions.includeStructure ?? true,
          includeDrop: current?.includeDrop ?? sqlOptions.includeDrop ?? false,
          includeData: current?.includeData ?? sqlOptions.includeData ?? true,
        });
      }
      return next;
    });
  }, [schemaInfo, sqlOptions]);

  const handleDeselectAll = React.useCallback(() => {
    setTableSelections((prev) => {
      const next = new Map(prev);
      for (const [tableName, state] of prev.entries()) {
        next.set(tableName, { ...state, selected: false });
      }
      return next;
    });
  }, []);

  const selectedTables = React.useMemo(() => {
    return Array.from(tableSelections.entries())
      .filter(([_, state]) => state.selected)
      .map(([tableName]) => tableName);
  }, [tableSelections]);

  const handleExport = React.useCallback(() => {
    const config: ExportConfig = {
      format: selectedFormat,
      filename,
      mode: 'tables',
      batch: { batchSize },
      csv: selectedFormat === 'csv' ? csvOptions : undefined,
      sql:
        selectedFormat === 'sql'
          ? {
              ...sqlOptions,
              selectedTables,
              // For SQL, we can include per-table options if needed
              // For now, use global options
            }
          : undefined,
      // Always pass selectedTables and schemaInfo for tables mode (required for all formats)
      selectedTables,
      schemaInfo: schemaInfo || undefined,
      // Pass ZIP option for CSV/JSON multi-file exports
      useZipForMultiFile:
        selectedFormat === 'csv' || selectedFormat === 'json' ? useZipForMultiFile : undefined,
    };
    onExport(config);
  }, [
    selectedFormat,
    filename,
    selectedTables,
    batchSize,
    csvOptions,
    sqlOptions,
    useZipForMultiFile,
    schemaInfo,
    onExport,
  ]);

  const handleNewExport = React.useCallback(() => {
    onReset?.();
    setTableSelections(new Map());
    setFilename(defaultFilename);
  }, [onReset, defaultFilename]);

  // Group tables by schema - avoid duplicates
  const tablesBySchema = React.useMemo(() => {
    if (!schemaInfo) return [];
    const grouped: Array<{ schema: string; tables: SchemaTableInfo[] }> = [];
    const tableNamesInSchemas = new Set<string>();

    // First, add all tables from schemas
    for (const [schemaName, tables] of Object.entries(schemaInfo.schemas)) {
      const uniqueTables = tables.filter((table) => {
        if (tableNamesInSchemas.has(table.name)) {
          return false; // Skip duplicates
        }
        tableNamesInSchemas.add(table.name);
        return true;
      });
      if (uniqueTables.length > 0) {
        grouped.push({ schema: schemaName, tables: uniqueTables });
      }
    }

    // Only add tables from schemaInfo.tables that are NOT already in schemas
    for (const table of schemaInfo.tables) {
      if (tableNamesInSchemas.has(table.name)) {
        continue; // Skip if already in a schema
      }
      tableNamesInSchemas.add(table.name);
      const schemaName = table.schema || 'default';
      const existingGroup = grouped.find((g) => g.schema === schemaName);
      if (existingGroup) {
        existingGroup.tables.push(table);
      } else {
        grouped.push({ schema: schemaName, tables: [table] });
      }
    }

    return grouped;
  }, [schemaInfo]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="!max-w-2/3 !h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Export Tables</DialogTitle>
          <DialogDescription>
            Export entire tables from your database to your preferred format.
          </DialogDescription>
        </DialogHeader>

        {/* Export Progress */}
        {isExporting && progress && (
          <div className="px-6">
            <ExportProgressSection progress={progress} onCancel={onCancel} />
          </div>
        )}

        {/* Export Result */}
        {!isExporting && lastResult && (
          <div className="px-6 flex-1 flex items-center justify-center">
            <ExportResultSection result={lastResult} />
          </div>
        )}

        {/* Configuration Form */}
        {!isExporting && !lastResult && (
          <div className="flex-1 flex flex-col min-h-0 px-6 pb-4">
            {/* Format Selection */}
            <div className="mb-4">
              <ExportFormatSelector
                formats={formats}
                selectedFormat={selectedFormat}
                onFormatChange={setSelectedFormat}
              />
            </div>

            <Separator className="mb-4" />

            {/* Main Content: Tables on left, Options on right */}
            <div className="flex-1 flex gap-6 min-h-0">
              {/* Left Side: Tables or ERD */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-auto py-1 px-3"
                    >
                      <span className="text-base font-semibold">Tables</span>
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === 'erd' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('erd')}
                      className="h-auto py-1 px-3"
                    >
                      <Database className="mr-2 h-4 w-4" />
                      <span className="text-base font-semibold">ERD</span>
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
                      All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleDeselectAll}>
                      None
                    </Button>
                  </div>
                </div>

                {viewMode === 'erd' && schemaInfo ? (
                  <div className="flex-1 min-h-0 relative border rounded-md overflow-hidden">
                    <ERDDialog
                      schemaInfo={schemaInfo}
                      selectedTables={Array.from(tableSelections.entries())
                        .filter(([_, selection]) => selection?.selected)
                        .map(([tableName]) => tableName)}
                      onTableToggle={handleTableToggle}
                    />
                  </div>
                ) : isLoadingSchema ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Loading schema information...</p>
                    </div>
                  </div>
                ) : schemaError ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-1">
                      <XCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
                      <div className="text-sm font-medium text-destructive">
                        Schema information not available
                      </div>
                      <div className="text-xs text-muted-foreground">{schemaError}</div>
                    </div>
                  </div>
                ) : schemaInfo ? (
                  <ScrollArea className="flex-1 border rounded-md">
                    <div className="p-3 space-y-2">
                      {tablesBySchema.map(({ schema, tables }) => (
                        <div key={schema} className="space-y-1">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm font-semibold w-full text-left py-1.5 px-2 hover:bg-muted rounded-md"
                            onClick={() => toggleSchema(schema)}
                          >
                            {expandedSchemas.has(schema) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Database className="h-4 w-4 text-muted-foreground" />
                            {schema} ({tables.length} tables)
                          </button>
                          {expandedSchemas.has(schema) && (
                            <div className="pl-6 space-y-1">
                              {tables.map((table) => {
                                const selection = tableSelections.get(table.name);
                                const isSelected = selection?.selected ?? false;

                                return (
                                  <div
                                    key={table.name}
                                    className={`flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted ${
                                      isSelected ? 'bg-muted/50' : ''
                                    }`}
                                  >
                                    {/* Table selection checkbox */}
                                    <Checkbox
                                      id={`table-${table.name}`}
                                      checked={isSelected}
                                      onCheckedChange={() => handleTableToggle(table.name)}
                                    />
                                    <label
                                      htmlFor={`table-${table.name}`}
                                      className="flex-1 text-sm font-medium cursor-pointer"
                                    >
                                      {table.name}
                                    </label>

                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    No schema information available
                  </div>
                )}
              </div>

              {/* Right Side: Format Options */}
              <div className="w-80 flex flex-col min-h-0 border-l pl-6">
                <ScrollArea className="flex-1">
                  {/* ZIP option for CSV/JSON multi-file exports */}
                  {(selectedFormat === 'csv' || selectedFormat === 'json') && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Multi-file Export</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="useZip"
                            checked={useZipForMultiFile}
                            onCheckedChange={(checked) => setUseZipForMultiFile(checked === true)}
                          />
                          <label
                            htmlFor="useZip"
                            className="text-sm text-muted-foreground cursor-pointer"
                          >
                            Download as ZIP archive (when exporting multiple tables)
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {useZipForMultiFile
                            ? 'Multiple tables will be packaged into a single ZIP file.'
                            : 'Each table will be downloaded as a separate file.'}
                        </p>
                      </div>
                      <Separator className="my-4" />
                    </>
                  )}
                  <div className="space-y-4">
                    {selectedFormat === 'csv' && (
                      <CsvOptionsPanel options={csvOptions} onOptionsChange={setCsvOptions} />
                    )}
                    {selectedFormat === 'excel' && (
                      <p className="text-sm text-muted-foreground">
                        Excel options: default settings
                      </p>
                    )}
                    {selectedFormat === 'json' && (
                      <p className="text-sm text-muted-foreground">JSON options: as is</p>
                    )}
                    {selectedFormat === 'sql' && (
                      <SqlOptionsPanel
                        options={sqlOptions}
                        detectedDialect={schemaInfo?.dialect}
                        onOptionsChange={setSqlOptions}
                      />
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t">
          {isExporting ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex-1" />
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          ) : lastResult ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex-1" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Close
                </Button>
                <Button onClick={handleNewExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="filename" className="text-sm font-medium whitespace-nowrap">
                    Filename:
                  </Label>
                  <Input
                    id="filename"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="Enter filename"
                    className="w-48"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="batchSize" className="text-sm font-medium whitespace-nowrap">
                    Batch Size:
                  </Label>
                  <Input
                    id="batchSize"
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    min={100}
                    max={10000}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExport} disabled={selectedTables.length === 0 || !filename}>
                  <Download className="mr-2 h-4 w-4" />
                  Export {selectedTables.length} Table{selectedTables.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
