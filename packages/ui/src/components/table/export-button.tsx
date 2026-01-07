'use client';

/**
 * @fileoverview Export button component for table data export.
 *
 * This component provides a dropdown button for initiating exports
 * in various formats with progress indication.
 *
 * @module components/table/export-button
 */

import type { ExportFormat, ExportProgress } from '@better-tables/core';
import { Download, FileCode, FileJson, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/**
 * Props for the ExportButton component.
 */
export interface ExportButtonProps {
  /** Callback when export is requested */
  onExport: (format: ExportFormat) => void;

  /** Whether an export is currently in progress */
  isExporting?: boolean;

  /** Current export progress */
  progress?: ExportProgress | null;

  /** Callback to cancel export */
  onCancel?: () => void;

  /** Disabled state */
  disabled?: boolean;

  /** Available export formats (default: all) */
  formats?: ExportFormat[];

  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';

  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';

  /** Additional class name */
  className?: string;

  /** Custom label */
  label?: string;

  /** Show format icons */
  showIcons?: boolean;

  /** Show row count in menu items */
  totalRows?: number;
}

/**
 * Format configuration for display.
 */
interface FormatConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_CONFIG: Record<ExportFormat, FormatConfig> = {
  csv: {
    label: 'CSV',
    description: 'Comma-separated values',
    icon: FileText,
  },
  excel: {
    label: 'Excel',
    description: 'Microsoft Excel spreadsheet',
    icon: FileSpreadsheet,
  },
  json: {
    label: 'JSON',
    description: 'JavaScript Object Notation',
    icon: FileJson,
  },
  sql: {
    label: 'SQL',
    description: 'SQL dump file',
    icon: FileCode,
  },
};

/**
 * Export button with dropdown for format selection.
 *
 * @example
 * ```tsx
 * function TableToolbar() {
 *   const { startExport, isExporting, progress, cancelExport } = useExport({
 *     columns,
 *     adapter,
 *   });
 *
 *   return (
 *     <ExportButton
 *       onExport={(format) => startExport({ format })}
 *       isExporting={isExporting}
 *       progress={progress}
 *       onCancel={cancelExport}
 *       totalRows={1500}
 *     />
 *   );
 * }
 * ```
 */
export function ExportButton({
  onExport,
  isExporting = false,
  progress,
  onCancel,
  disabled = false,
  formats = ['csv', 'excel', 'json', 'sql'],
  variant = 'outline',
  size = 'default',
  className,
  label = 'Export',
  showIcons = true,
  totalRows,
}: ExportButtonProps): React.ReactElement {
  const handleExport = React.useCallback(
    (format: ExportFormat) => {
      onExport(format);
    },
    [onExport]
  );

  // Show progress state
  if (isExporting && progress) {
    return (
      <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        <Button variant={variant} size={size} disabled className="min-w-[120px]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {progress.percentage}%
        </Button>
        {onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel export">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {totalRows !== undefined && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {totalRows.toLocaleString()} rows to export
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {formats.map((format) => {
          const config = FORMAT_CONFIG[format];
          const Icon = config.icon;
          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              className="cursor-pointer"
            >
              {showIcons && <Icon className="mr-2 h-4 w-4" />}
              <div className="flex flex-col">
                <span>{config.label}</span>
                <span className="text-xs text-muted-foreground">{config.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Inline export progress indicator.
 *
 * @example
 * ```tsx
 * {isExporting && progress && (
 *   <ExportProgress progress={progress} onCancel={cancelExport} />
 * )}
 * ```
 */
export function ExportProgressIndicator({
  progress,
  onCancel,
  showDetails = false,
}: {
  progress: ExportProgress;
  onCancel?: () => void;
  showDetails?: boolean;
}): React.ReactElement {
  const estimatedTimeRemaining = progress.estimatedTimeRemaining
    ? formatTime(progress.estimatedTimeRemaining)
    : null;

  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Exporting... {progress.percentage}%</span>
          {onCancel && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onCancel}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {showDetails && (
          <span className="text-xs text-muted-foreground">
            {progress.processedRows.toLocaleString()} / {progress.totalRows.toLocaleString()} rows
            {estimatedTimeRemaining && ` • ~${estimatedTimeRemaining} remaining`}
          </span>
        )}
      </div>
      <div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Format milliseconds to human-readable time.
 */
function formatTime(ms: number): string {
  if (ms < 1000) return 'less than a second';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
