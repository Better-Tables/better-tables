'use client';

/**
 * @fileoverview Shared export result section component.
 *
 * @module components/table/export-result-section
 */

import { formatDuration, formatFileSize } from '@better-tables/core';
import { CheckCircle2, XCircle } from 'lucide-react';
import type * as React from 'react';

/**
 * Props for the ExportResultSection component.
 */
export interface ExportResultSectionProps {
  /** Export result */
  result: {
    success: boolean;
    filename: string;
    rowCount: number;
    fileSize?: number;
    duration?: number;
    error?: string;
  };
}

/**
 * Export result section component.
 */
export function ExportResultSection({ result }: ExportResultSectionProps): React.ReactElement {
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
