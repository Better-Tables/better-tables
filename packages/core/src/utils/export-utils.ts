/**
 * @fileoverview Export utility functions for CSV and data transformation.
 *
 * This module provides low-level utilities for export operations including
 * streaming CSV generation, data transformation, and file handling.
 *
 * @module utils/export-utils
 */

import type { ColumnDefinition } from '../types/column';
import type { CsvExportOptions, ExportFormat, ExportValueTransformer } from '../types/export';
import { DEFAULT_CSV_OPTIONS } from '../types/export';

/**
 * Stream-based CSV generator for memory-efficient export of large datasets.
 *
 * Uses a generator pattern to process data incrementally, making it suitable
 * for exporting millions of rows without running out of memory.
 *
 * @template TData - The type of data being exported
 *
 * @example
 * ```typescript
 * const generator = new CsvStreamGenerator<User>(columns, {
 *   delimiter: ',',
 *   includeHeaders: true
 * });
 *
 * // Process data in chunks
 * for (const chunk of dataChunks) {
 *   for (const line of generator.generateLines(chunk)) {
 *     await writeToStream(line);
 *   }
 * }
 * ```
 */
export class CsvStreamGenerator<TData = unknown> {
  private readonly columns: ColumnDefinition<TData>[];
  private readonly options: Required<CsvExportOptions>;
  private readonly valueTransformer?: ExportValueTransformer<TData>;
  private headerWritten: boolean = false;

  constructor(
    columns: ColumnDefinition<TData>[],
    options?: CsvExportOptions,
    valueTransformer?: ExportValueTransformer<TData>
  ) {
    this.columns = columns;
    this.options = { ...DEFAULT_CSV_OPTIONS, ...options };
    this.valueTransformer = valueTransformer;
  }

  /**
   * Generate CSV lines for a batch of data.
   * Yields individual lines for streaming output.
   */
  *generateLines(data: TData[]): Generator<string, void, unknown> {
    // Yield header line if not yet written
    if (!this.headerWritten && this.options.includeHeaders) {
      yield this.generateHeaderLine();
      this.headerWritten = true;
    }
    // Yield data lines
    for (const row of data) {
      yield this.generateDataLine(row);
    }
  }

  /**
   * Generate the complete CSV content for a batch.
   * More efficient for smaller datasets or when streaming is not needed.
   */
  generateBatch(data: TData[], includeHeader = true): string {
    const lines: string[] = [];
    if (includeHeader && this.options.includeHeaders) {
      lines.push(this.generateHeaderLine());
    }
    for (const row of data) {
      lines.push(this.generateDataLine(row));
    }
    return lines.join(this.options.lineEnding);
  }

  /**
   * Get the BOM (Byte Order Mark) for UTF-8 if enabled.
   */
  getBom(): string {
    return this.options.includeBom ? '\uFEFF' : '';
  }

  /**
   * Reset the generator state for reuse.
   */
  reset(): void {
    this.headerWritten = false;
  }

  private generateHeaderLine(): string {
    return this.columns
      .map((col) => this.escapeValue(col.displayName))
      .join(this.options.delimiter);
  }

  private generateDataLine(row: TData): string {
    return this.columns
      .map((col) => {
        const rawValue = col.accessor(row);
        const value = this.valueTransformer ? this.valueTransformer(rawValue, row, col) : rawValue;
        return this.escapeValue(value);
      })
      .join(this.options.delimiter);
  }

  private escapeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return this.options.nullValue;
    }
    let stringValue = String(value);
    // Check if value needs quoting
    const needsQuoting =
      this.options.quoteStrings &&
      (stringValue.includes(this.options.delimiter) ||
        stringValue.includes('"') ||
        stringValue.includes('\n') ||
        stringValue.includes('\r'));
    if (needsQuoting) {
      stringValue = stringValue.replace(/"/g, '""');
      return `"${stringValue}"`;
    }
    return stringValue;
  }
}

/**
 * Process data in batches with a callback.
 *
 * Utility function for batch processing large datasets with progress tracking
 * and optional delays for UI responsiveness.
 *
 * @template TData - The type of data being processed
 *
 * @example
 * ```typescript
 * await processBatches(
 *   largeDataset,
 *   1000,
 *   async (batch, batchIndex, totalBatches) => {
 *     await processChunk(batch);
 *     updateProgress(batchIndex / totalBatches);
 *   },
 *   { delayMs: 10, signal: abortController.signal }
 * );
 * ```
 */
export async function processBatches<TData>(
  data: TData[],
  batchSize: number,
  processor: (batch: TData[], batchIndex: number, totalBatches: number) => Promise<void>,
  options?: { delayMs?: number; signal?: AbortSignal }
): Promise<void> {
  const totalBatches = Math.ceil(data.length / batchSize);
  for (let i = 0; i < totalBatches; i++) {
    if (options?.signal?.aborted) {
      break;
    }
    const start = i * batchSize;
    const end = Math.min(start + batchSize, data.length);
    const batch = data.slice(start, end);
    await processor(batch, i, totalBatches);
    if (options?.delayMs && i < totalBatches - 1) {
      await delay(options.delayMs);
    }
  }
}

/**
 * Calculate export file size estimate.
 *
 * Provides a rough estimate of the final file size based on sample data,
 * useful for progress indicators and user feedback.
 *
 * @param sampleRow - A sample row of data
 * @param totalRows - Total number of rows to export
 * @param format - Export format
 * @returns Estimated file size in bytes
 */
export function estimateExportSize<TData>(
  columns: ColumnDefinition<TData>[],
  sampleRow: TData,
  totalRows: number,
  format: ExportFormat
): number {
  // Calculate average row size from sample
  const values = columns.map((col) => col.accessor(sampleRow));
  const totalCellSize = values.reduce<number>((sum, val) => {
    if (val === null || val === undefined) return sum + 1;
    return sum + String(val).length;
  }, 0);
  const avgCellSize = totalCellSize / columns.length;
  const avgRowSize = avgCellSize * columns.length;
  // Add format-specific overhead
  const overheadMultiplier = {
    csv: 1.1, // Delimiters and quotes
    excel: 2.5, // XML overhead
    json: 1.5, // JSON syntax
  };
  const headerSize = columns.reduce((sum, col) => sum + col.displayName.length, 0);
  return Math.round((headerSize + avgRowSize * totalRows) * overheadMultiplier[format]);
}

/**
 * Format file size for display.
 *
 * @param bytes - File size in bytes
 * @returns Human-readable file size string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Format duration for display.
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Generate a timestamped filename.
 *
 * @param baseName - Base filename without extension
 * @param format - Export format for extension
 * @returns Filename with timestamp
 */
export function generateExportFilename(baseName: string, format: ExportFormat): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const extensions = { csv: '.csv', excel: '.xlsx', json: '.json' };
  return `${baseName}-${timestamp}${extensions[format]}`;
}

/**
 * Validate export configuration.
 *
 * @param config - Export configuration to validate
 * @returns Validation result with any errors
 */
export function validateExportConfig(config: {
  format?: string;
  columns?: { columnId: string }[];
  batchSize?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.format && !['csv', 'excel', 'json'].includes(config.format)) {
    errors.push(`Invalid export format: ${config.format}`);
  }
  if (config.batchSize !== undefined && (config.batchSize < 1 || config.batchSize > 100000)) {
    errors.push('Batch size must be between 1 and 100,000');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize filename for safe file system use.
 *
 * @param filename - Raw filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 200);
}

/**
 * Delay utility for async operations.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a download trigger for blob data.
 *
 * @param blob - Data blob to download
 * @param filename - Filename for the download
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Delay revocation to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Check if the current environment supports file downloads.
 *
 * @returns Whether downloads are supported
 */
export function isDownloadSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof document === 'undefined') return false;
  const link = document.createElement('a');
  return 'download' in link;
}
