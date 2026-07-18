/**
 * @fileoverview Export format conversion utilities for Drizzle adapter
 * @module @better-tables/drizzle-adapter/export-format
 */

/**
 * Convert fetched data to the requested export format.
 */
export function convertToExportFormat(
  data: Record<string, unknown>[],
  format: string
): Blob | string {
  switch (format) {
    case 'csv':
      return convertToCSV(data);
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'excel':
      // Would need a library like xlsx for this
      throw new Error('Excel export not implemented');
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Convert records to CSV with formula-injection escaping.
 */
export function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const firstRecord = data[0];
  if (!firstRecord || typeof firstRecord !== 'object') return '';

  const headers = Object.keys(firstRecord);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (typeof value === 'string') {
        // Prevent CSV formula injection by prefixing with quote if starts with formula characters
        const sanitizedValue = value.replace(/"/g, '""');
        if (/^[=+\-@]/.test(value)) {
          return `"'${sanitizedValue}"`;
        }
        return `"${sanitizedValue}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * MIME type for a given export format.
 */
export function getMimeType(format: string): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}
