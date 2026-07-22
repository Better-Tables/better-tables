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

/** Options for {@link recordsToCsv}. */
export interface RecordsToCsvOptions {
  /** Emit a header row from the first record's keys. Default `true`. */
  includeHeaders?: boolean;
}

/**
 * Encode one CSV cell. Non-string values are serialized first (objects/arrays
 * as JSON, everything else via `String`), then the value is quoted+escaped only
 * when it needs it (contains a comma, quote, or newline — or is a
 * formula-injection payload). A value starting with `= + - @` is prefixed with
 * a single quote so spreadsheet apps don't evaluate it as a formula.
 */
function encodeCsvCell(value: unknown): string {
  if (value == null) return '';
  let str =
    typeof value === 'string'
      ? value
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  const isFormula = /^[=+\-@]/.test(str);
  if (isFormula) str = `'${str}`;
  if (isFormula || /[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize records as CSV. Column order follows the keys of the first record;
 * every header and cell is CSV-encoded (see {@link encodeCsvCell}) so commas,
 * quotes, newlines, and formula payloads in either can't corrupt the output.
 */
export function recordsToCsv(
  data: Record<string, unknown>[],
  options?: RecordsToCsvOptions
): string {
  if (data.length === 0) return '';
  const firstRecord = data[0];
  if (!firstRecord || typeof firstRecord !== 'object') return '';

  const headers = Object.keys(firstRecord);
  const rows: string[] = [];
  if (options?.includeHeaders !== false) {
    rows.push(headers.map(encodeCsvCell).join(','));
  }
  for (const record of data) {
    rows.push(headers.map((header) => encodeCsvCell(record[header])).join(','));
  }

  return rows.join('\n');
}
