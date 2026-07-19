import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from 'drizzle-orm/logger';

export interface CapturedQuery {
  query: string;
  params: unknown[];
}

// Kept on globalThis so dev-server HMR can't split the store: the logger
// closure captured by the long-lived drizzle singleton and freshly reloaded
// modules must share one AsyncLocalStorage instance.
const globalCapture = globalThis as typeof globalThis & {
  __btSqlCaptureStore?: AsyncLocalStorage<CapturedQuery[]>;
};
if (!globalCapture.__btSqlCaptureStore) {
  globalCapture.__btSqlCaptureStore = new AsyncLocalStorage<CapturedQuery[]>();
}
const captureStore = globalCapture.__btSqlCaptureStore;

/**
 * Drizzle logger that records statements into the active capture scope.
 * Outside a scope it is a no-op, so regular traffic pays nothing.
 */
export const sqlCaptureLogger: Logger = {
  logQuery(query: string, params: unknown[]) {
    captureStore.getStore()?.push({ query, params: params ?? [] });
  },
};

/**
 * Run `fn` and collect every SQL statement drizzle executes on its behalf.
 * Used by the homepage demo to show visitors the exact queries the adapter
 * generated for their current filters.
 */
export async function withSqlCapture<T>(
  fn: () => Promise<T>
): Promise<{ result: T; queries: CapturedQuery[] }> {
  const queries: CapturedQuery[] = [];
  const result = await captureStore.run(queries, fn);
  return { result, queries };
}
