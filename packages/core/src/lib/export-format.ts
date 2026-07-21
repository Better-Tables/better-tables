/**
 * @fileoverview Record → export-string formatters (CSV/JSON) shared by
 * core-tier export (the `csvExport()` plugin). Kept small and dependency-free.
 *
 * NOTE: the Drizzle adapter has its own copy of this logic
 * (`packages/adapters/drizzle/src/export-format.ts`). Consolidating both into
 * `@better-tables/adapters-toolkit` is plan 061's job (its export-format lift);
 * until then this core copy is intentionally standalone.
 */

/** Serialize records as pretty-printed JSON. */
export function recordsToJson(data: unknown[]): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Serialize records as CSV, with CSV formula-injection escaping: a cell whose
 * string value starts with `= + - @` is prefixed with a single quote inside the
 * quoted field so spreadsheet apps don't evaluate it as a formula.
 *
 * Column order follows the keys of the first record.
 */
export function recordsToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const firstRecord = data[0];
  if (!firstRecord || typeof firstRecord !== 'object') return '';

  const headers = Object.keys(firstRecord);
  const rows = [headers.join(',')];

  for (const record of data) {
    const cells = headers.map((header) => {
      const value = record[header];
      if (typeof value === 'string') {
        const escaped = value.replace(/"/g, '""');
        return /^[=+\-@]/.test(value) ? `"'${escaped}"` : `"${escaped}"`;
      }
      if (value == null) return '';
      return String(value);
    });
    rows.push(cells.join(','));
  }

  return rows.join('\n');
}
