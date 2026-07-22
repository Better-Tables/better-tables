import { recordsToCsv, recordsToJson } from '../lib/export-format';
import type { FetchDataResult } from '../types/adapter';
import type { TableDefPlugin } from '../types/factory';

/**
 * A {@link csvExport} plugin instance. Beyond the base plugin, it exposes the
 * most-recent fetch result and formatters for it. Retain the object you pass to
 * `betterTables({ plugins })` to call these (see the ergonomics note in
 * `plans/design/table-definition-dx.md` §5).
 */
export interface CsvExportPlugin extends TableDefPlugin {
  name: 'csvExport';
  /** The most recent fetch result this plugin observed, or `null`. */
  getLastResult(): FetchDataResult<unknown> | null;
  /** The most recent fetched rows as CSV (formula-escaped). Empty when none. */
  toCsv(): string;
  /** The most recent fetched rows as pretty JSON. */
  toJson(): string;
}

/**
 * A thin core-tier export plugin — the first real consumer of the 049 hook seam
 * beyond `logPlugin`. It captures each fetch's result via `afterFetch` (without
 * modifying it) and lets a consumer format that result as CSV/JSON.
 *
 * Scope: it formats the MOST RECENT fetched result set — i.e. the current page.
 * For a full (filtered, sorted, row-capped) export, use the adapter's
 * `exportData` / the `ExportButton` UI module instead.
 *
 * @example
 * ```ts
 * const csv = csvExport();
 * const tables = betterTables({ database: adapter, plugins: [csv] });
 * await tables.fetchData(usersTable, { pagination: { page: 1, limit: 20 } });
 * const text = csv.toCsv(); // CSV of that page
 * ```
 */
export function csvExport(): CsvExportPlugin {
  let lastResult: FetchDataResult<unknown> | null = null;

  return {
    name: 'csvExport',
    afterFetch({ result }) {
      lastResult = result;
      return result;
    },
    getLastResult() {
      return lastResult;
    },
    toCsv() {
      const rows = (lastResult?.data ?? []) as Record<string, unknown>[];
      return recordsToCsv(rows);
    },
    toJson() {
      return recordsToJson(lastResult?.data ?? []);
    },
  };
}
