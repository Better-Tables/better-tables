'use client';

/**
 * @fileoverview Shared export progress section component.
 *
 * @module components/table/export-progress-section
 */

import type { ExportProgress } from '@better-tables/core';
import { formatDuration } from '@better-tables/core';
import { Loader2 } from 'lucide-react';
import type * as React from 'react';
import { Button } from '../ui/button';

/**
 * Props for the ExportProgressSection component.
 */
export interface ExportProgressSectionProps {
  /** Current export progress */
  progress: ExportProgress;

  /** Callback to cancel export */
  onCancel?: () => void;
}

/**
 * Export progress section component.
 */
export function ExportProgressSection({
  progress,
  onCancel,
}: ExportProgressSectionProps): React.ReactElement {
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
