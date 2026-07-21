import type { FetchDataParams } from '../types/adapter';
import type { TableDefPlugin } from '../types/factory';

/**
 * Summary passed to {@link LogPluginOptions.onFetch} after each table-scoped
 * fetch.
 */
export interface LogPluginFetchInfo {
  /** The table the fetch was scoped to. */
  table: string;
  /** Rows returned on this page. */
  rowCount: number;
  /** Total rows across all pages (from the adapter result). */
  total: number;
  /** The params sent to the adapter (after any earlier plugins' edits). */
  params: FetchDataParams;
}

/** Options for {@link logPlugin}. */
export interface LogPluginOptions {
  /**
   * Called after every table-scoped fetch with a summary. When omitted, the
   * plugin logs a one-line `console.debug` per fetch.
   */
  onFetch?: (info: LogPluginFetchInfo) => void;
}

/**
 * A minimal, real plugin: observe every table-scoped fetch (plan 049's first
 * consumer of the `afterFetch` hook). Useful for telemetry/debugging, and the
 * proof that the plugin hook seam runs.
 *
 * It reads the result but returns it unchanged, so it never alters query
 * behavior.
 *
 * @example
 * ```ts
 * const tables = betterTables({
 *   database: adapter,
 *   plugins: [logPlugin({ onFetch: ({ table, rowCount, total }) =>
 *     metrics.record(`${table}: ${rowCount}/${total}`) })],
 * });
 * ```
 */
export function logPlugin(options: LogPluginOptions = {}): TableDefPlugin {
  return {
    name: 'log',
    afterFetch({ params, result, table }) {
      const info: LogPluginFetchInfo = {
        table: table.tableName,
        rowCount: result.data.length,
        total: result.total,
        params,
      };
      if (options.onFetch) {
        options.onFetch(info);
      } else {
        // biome-ignore lint/suspicious/noConsole: opt-in observability plugin — logging is its purpose
        console.debug(`[better-tables] fetch ${info.table}: ${info.rowCount}/${info.total} rows`);
      }
      return result;
    },
  };
}
