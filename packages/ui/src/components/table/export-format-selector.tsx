'use client';

/**
 * @fileoverview Shared export format selector component.
 *
 * @module components/table/export-format-selector
 */

import type { ExportFormat } from '@better-tables/core';
import { FileCode, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import type * as React from 'react';

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
 * Props for the ExportFormatSelector component.
 */
export interface ExportFormatSelectorProps {
  /** Available export formats */
  formats: ExportFormat[];

  /** Selected format */
  selectedFormat: ExportFormat;

  /** Callback when format changes */
  onFormatChange: (format: ExportFormat) => void;
}

/**
 * Export format selector component.
 */
export function ExportFormatSelector({
  formats,
  selectedFormat,
  onFormatChange,
}: ExportFormatSelectorProps): React.ReactElement {
  const availableFormats = FORMAT_OPTIONS.filter((f) => formats.includes(f.value));

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Format</div>
      <div className="w-full flex flex-row gap-2">
        {availableFormats.map((format) => {
          const Icon = format.icon;
          const isSelected = selectedFormat === format.value;
          return (
            <button
              key={format.value}
              type="button"
              onClick={() => onFormatChange(format.value)}
              className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
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
  );
}
