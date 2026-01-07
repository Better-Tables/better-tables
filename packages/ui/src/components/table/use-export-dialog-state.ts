'use client';

/**
 * @fileoverview Shared hook for export dialog state management.
 *
 * @module components/table/use-export-dialog-state
 */

import type { CsvExportOptions, ExportFormat, SqlExportOptions } from '@better-tables/core';
import * as React from 'react';

/**
 * Options for the useExportDialogState hook.
 */
export interface UseExportDialogStateOptions {
  /** Default filename */
  defaultFilename: string;

  /** Available formats */
  formats: ExportFormat[];

  /** Whether dialog is open */
  isOpen: boolean;

  /** Whether there's a last result */
  hasLastResult: boolean;
}

/**
 * Return type for the useExportDialogState hook.
 */
export interface UseExportDialogStateReturn {
  /** Selected format */
  selectedFormat: ExportFormat;

  /** Set selected format */
  setSelectedFormat: (format: ExportFormat) => void;

  /** Filename */
  filename: string;

  /** Set filename */
  setFilename: (filename: string) => void;

  /** CSV options */
  csvOptions: CsvExportOptions;

  /** Set CSV options */
  setCsvOptions: (options: CsvExportOptions) => void;

  /** SQL options */
  sqlOptions: SqlExportOptions;

  /** Set SQL options */
  setSqlOptions: (options: SqlExportOptions) => void;

  /** Batch size */
  batchSize: number;

  /** Set batch size */
  setBatchSize: (size: number) => void;
}

/**
 * Shared hook for managing export dialog state.
 */
export function useExportDialogState({
  defaultFilename,
  formats,
  isOpen,
  hasLastResult,
}: UseExportDialogStateOptions): UseExportDialogStateReturn {
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>(
    formats.includes('csv') ? 'csv' : formats[0] || 'csv'
  );
  const [filename, setFilename] = React.useState(defaultFilename);
  const [csvOptions, setCsvOptions] = React.useState<CsvExportOptions>({});
  const [sqlOptions, setSqlOptions] = React.useState<SqlExportOptions>({});
  const [batchSize, setBatchSize] = React.useState(1000);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen && !hasLastResult) {
      setSelectedFormat(formats.includes('csv') ? 'csv' : formats[0] || 'csv');
      setFilename(defaultFilename);
      setCsvOptions({});
      setSqlOptions({});
      setBatchSize(1000);
    }
  }, [isOpen, hasLastResult, defaultFilename, formats]);

  return {
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
  };
}
