/**
 * @fileoverview `httpAdapter` — a browser-safe `TableAdapter` that proxies
 * every read to an HTTP endpoint (paired with {@link handleAdapterRequest} on
 * the server). This closes the "server-only adapter, client-side table" gap:
 * a real adapter wrapping a native DB binding can't be called from the
 * browser, so client components (e.g. `useFacets`, faceted sidebars) otherwise
 * force the app to hand-write a fetch shim. `httpAdapter(url)` is that shim,
 * once, for everyone.
 */

import { recordsToCsv, recordsToJson } from '../lib/export-format';
import type {
  AdapterMeta,
  CellWriteTarget,
  ExportParams,
  ExportResult,
  FacetBatchResult,
  FacetQueryParams,
  FacetRequest,
  FetchDataParams,
  FetchDataResult,
  InferredColumnSpec,
  MutationOptions,
  TableAdapter,
} from '../types/adapter';
import { DEFAULT_EXPORT_ROW_CAP } from '../types/adapter';
import { COLUMN_TYPES, type ColumnType } from '../types/column';
import type { FilterOperator, FilterOption } from '../types/filter';
import type { AdapterRequestBody, AdapterResponseBody } from './http-protocol';

const ALL_COLUMN_TYPES: ColumnType[] = [...COLUMN_TYPES];

/**
 * Default `meta` for an HTTP adapter. Capabilities actually live on the SERVER
 * adapter this proxies to; this only advertises "reads over the wire" and a
 * permissive column-type surface (the filter UI derives operators from column
 * types, not from `adapter.meta`). Override via `HttpAdapterConfig.meta` if you
 * mirror the server's real capabilities client-side.
 */
function defaultHttpAdapterMeta(): AdapterMeta {
  return {
    name: 'http',
    version: '1.0.0',
    features: {
      create: false,
      read: true,
      update: false,
      delete: false,
      bulkOperations: false,
      realTimeUpdates: false,
      // Export is a CLIENT-side capability here: `exportData` reuses the fetch
      // proxy to pull the (filtered) rows, then formats them in the browser
      // (CSV/JSON) — no server export route required.
      export: true,
      transactions: false,
    },
    supportedColumnTypes: [...ALL_COLUMN_TYPES],
    supportedOperators: Object.fromEntries(
      ALL_COLUMN_TYPES.map((type) => [type, [] as FilterOperator[]])
    ) as Record<ColumnType, FilterOperator[]>,
  };
}

/** Minimal `fetch` shape — lets callers inject a custom fetch (tests, auth). */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Configuration for {@link httpAdapter}. */
export interface HttpAdapterConfig {
  /**
   * The endpoint that {@link handleAdapterRequest} is mounted on (e.g.
   * `/api/tables/tickets`). Every read is a `POST` of an
   * {@link AdapterRequestBody} to this URL.
   */
  url: string;

  /**
   * Custom `fetch` implementation. Defaults to the global `fetch`. Supply one
   * to add auth headers per request, use a base client, or test without a
   * network.
   */
  fetch?: FetchLike;

  /**
   * Extra headers to send with every request — a static object, or a function
   * (sync or async) invoked per request (e.g. to attach a fresh token).
   */
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);

  /**
   * Override the adapter `meta` (capabilities). Defaults to a read-only HTTP
   * transport meta — the real capabilities live on the server adapter.
   */
  meta?: AdapterMeta;

  /** TTL for facet-read dedup/cache; `0`/`false` disables. @default 2000 */
  cacheTtlMs?: number | false;

  /**
   * Opt in to proxied cell-edit WRITES (plan 055). The server side must opt
   * in too (`writes` on `createAdapterRouteHandler`) — this is a deliberate
   * double opt-in. When true, the adapter implements `updateRecord` (single
   * field per call — cell edits are singular) over the `cellEdit` wire
   * method and advertises `features.update`. Absent/false keeps the
   * read-only shape byte-identical to pre-055.
   *
   * Only for genuinely separated frontend/backend deployments — monoliths
   * should use `tables.cellEditAction` through their framework's server
   * boundary instead.
   */
  writes?: boolean;
}

/**
 * Error thrown when the HTTP transport itself fails (non-2xx response, or the
 * server envelope reports `ok: false`). Distinct from a validation/query error
 * so callers can branch on transport vs. domain failures.
 */
export class HttpAdapterError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'HttpAdapterError';
  }
}

/**
 * Create a client-side {@link TableAdapter} that proxies its read methods
 * (`fetchData`, `getFilterOptions`, `getFacetedValues`, `getMinMaxValues`,
 * and the batched `getFacets`) to an HTTP endpoint. Mount
 * {@link handleAdapterRequest} at that endpoint, backed by your real
 * (server-only) adapter.
 *
 * @example
 * ```tsx
 * // client
 * const adapter = httpAdapter<Ticket>({ url: '/api/tables/tickets' });
 * const { facets } = useFacets({ adapter, columnIds: ['status'], filters });
 *
 * // server — app/api/tables/tickets/route.ts
 * import { createAdapterRouteHandler } from '@better-tables/core';
 * export const POST = createAdapterRouteHandler(() => getTicketsAdapter());
 * ```
 *
 * Mutation methods (`createRecord` etc.) are intentionally NOT proxied — they
 * are optional on `TableAdapter` and writes deserve an explicit, app-owned
 * endpoint rather than a generic passthrough.
 */
export function httpAdapter<TData = unknown>(config: HttpAdapterConfig): TableAdapter<TData> {
  const doFetch = config.fetch ?? (globalThis.fetch as unknown as FetchLike);
  if (!doFetch) {
    throw new HttpAdapterError('No fetch implementation available; pass `fetch` in the config.');
  }

  const cacheTtlMs =
    config.cacheTtlMs === false || config.cacheTtlMs === 0 ? 0 : (config.cacheTtlMs ?? 2000);
  /**
   * One shared underlying request per identical body. Followers with an
   * `AbortSignal` get per-caller abort semantics (their promise rejects
   * immediately) without cancelling the shared request out from under other
   * callers — it is aborted only when every follower has aborted and no
   * signal-less caller pinned it.
   */
  interface InFlightEntry {
    promise: Promise<unknown>;
    controller: AbortController;
    /** Followers whose signal has not (yet) aborted. */
    activeWaiters: number;
    /** A signal-less caller joined — never abort the shared request. */
    pinned: boolean;
  }
  const inFlight = new Map<string, InFlightEntry>();
  const resultCache = new Map<string, { result: unknown; expiresAt: number }>();
  // Bound the TTL cache. Filter-varied reads produce a fresh JSON key each
  // time, so without a cap a long-lived table session accretes one entry per
  // param combination forever (the TTL only blocks stale HITS, it never frees
  // keys). Map preserves insertion order, so the first key is the
  // least-recently-used (reads re-insert on hit — see `sendCacheable`).
  const MAX_CACHE_ENTRIES = 100;
  function evictOverCap(): void {
    while (resultCache.size > MAX_CACHE_ENTRIES) {
      const oldest = resultCache.keys().next().value;
      if (oldest === undefined) break;
      resultCache.delete(oldest);
    }
  }

  async function resolveHeaders(): Promise<Record<string, string>> {
    const base = { 'content-type': 'application/json' };
    if (!config.headers) return base;
    const extra = typeof config.headers === 'function' ? await config.headers() : config.headers;
    return { ...base, ...extra };
  }

  async function performFetch(body: AdapterRequestBody, signal?: AbortSignal): Promise<unknown> {
    const response = await doFetch(config.url, {
      method: 'POST',
      headers: await resolveHeaders(),
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });

    let envelope: AdapterResponseBody;
    try {
      envelope = (await response.json()) as AdapterResponseBody;
    } catch {
      throw new HttpAdapterError(
        `Adapter endpoint returned a non-JSON response (status ${response.status}).`,
        response.status
      );
    }

    if (!response.ok || !envelope.ok) {
      const message = !envelope.ok ? envelope.error : `Request failed (status ${response.status}).`;
      throw new HttpAdapterError(message, response.status);
    }

    return envelope.result;
  }

  async function send(body: AdapterRequestBody, signal?: AbortSignal): Promise<unknown> {
    return performFetch(body, signal);
  }

  function abortError(): Error {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }

  /**
   * TTL cache + in-flight dedup for idempotent reads. A caller's
   * `AbortSignal` no longer routes around the cache (the pre-fix behavior
   * made every `useFacets` read a fresh POST): a fresh cached result is
   * returned regardless of signal, and concurrent identical reads share one
   * underlying request while keeping per-caller abort semantics.
   */
  async function sendCacheable(body: AdapterRequestBody, signal?: AbortSignal): Promise<unknown> {
    if (cacheTtlMs <= 0) return performFetch(body, signal);
    if (signal?.aborted) throw abortError();

    const cacheKey = JSON.stringify(body);
    const cached = resultCache.get(cacheKey);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        // LRU touch: re-insert so this key becomes most-recently-used.
        resultCache.delete(cacheKey);
        resultCache.set(cacheKey, cached);
        return cached.result;
      }
      // Expired — free it now rather than leaving it resident until eviction.
      resultCache.delete(cacheKey);
    }

    let entry = inFlight.get(cacheKey);
    if (!entry) {
      const controller = new AbortController();
      const created: InFlightEntry = {
        promise: Promise.resolve<unknown>(undefined),
        controller,
        activeWaiters: 0,
        pinned: false,
      };
      created.promise = performFetch(body, controller.signal)
        .then((result) => {
          // Cache only if this exact request is still the live entry AND wasn't
          // aborted — a late settle from an evicted/aborted request must never
          // populate or overwrite a NEWER entry's cache under the same key.
          if (!controller.signal.aborted && inFlight.get(cacheKey) === created) {
            resultCache.set(cacheKey, { result, expiresAt: Date.now() + cacheTtlMs });
            evictOverCap();
          }
          return result;
        })
        .catch((error) => {
          // Only clear cache for OUR live entry, for the same reason — a late
          // failure from an evicted request must not delete a newer result.
          if (inFlight.get(cacheKey) === created) {
            resultCache.delete(cacheKey);
          }
          throw error;
        })
        .finally(() => {
          // Only remove OUR entry — an all-aborted entry is evicted early so a
          // fresh caller may already have replaced it under the same key.
          if (inFlight.get(cacheKey) === created) {
            inFlight.delete(cacheKey);
          }
        });
      entry = created;
      inFlight.set(cacheKey, entry);
    }

    if (!signal) {
      entry.pinned = true;
      return entry.promise;
    }

    const shared = entry;
    shared.activeWaiters += 1;
    return new Promise((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        shared.activeWaiters -= 1;
        if (shared.activeWaiters <= 0 && !shared.pinned) {
          shared.controller.abort();
          // Evict immediately: a caller arriving after this must start a
          // fresh request, not join a doomed one.
          if (inFlight.get(cacheKey) === shared) {
            inFlight.delete(cacheKey);
          }
        }
        reject(abortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      // Both handlers are attached for every follower, so a late settlement
      // after this caller aborted is still "handled" (the settled guard
      // no-ops it) — no unhandled-rejection noise.
      shared.promise.then(
        (result) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          shared.activeWaiters -= 1;
          resolve(result);
        },
        (error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          shared.activeWaiters -= 1;
          reject(error);
        }
      );
    });
  }

  // Default meta advertises the real capability surface: update flips on
  // with the write opt-in (plan 055). A caller-supplied `meta` always wins.
  const meta = config.meta ?? defaultHttpAdapterMeta();
  if (!config.meta && config.writes) {
    meta.features.update = true;
  }

  return {
    meta,

    async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
      // `signal` drives THIS fetch's cancellation; it's not sent over the wire.
      const { signal, ...serializable } = params;
      const result = (await send(
        { method: 'fetchData', params: serializable },
        signal
      )) as FetchDataResult<TData> & {
        faceted?: Record<string, [string, number][] | Map<string, number>>;
      };
      if (result.faceted) {
        const rebuilt: Record<string, Map<string, number>> = {};
        for (const [key, value] of Object.entries(result.faceted)) {
          rebuilt[key] = value instanceof Map ? value : new Map(value);
        }
        return { ...result, faceted: rebuilt };
      }
      return result;
    },

    /**
     * Export the current view as CSV/JSON. Reuses the fetch proxy to pull the
     * (filtered, sorted) rows — bounded by `maxRows`/{@link DEFAULT_EXPORT_ROW_CAP}
     * — then formats them client-side. Excel is not supported over HTTP.
     */
    async exportData(params: ExportParams): Promise<ExportResult> {
      if (params.format === 'excel') {
        throw new Error('Excel export is not supported over the HTTP adapter.');
      }
      if (params.ids && params.ids.length > 0) {
        // Selected-row export isn't implemented — reject rather than silently
        // returning the whole (filtered) view, which would violate the contract.
        throw new Error('Exporting specific record ids is not supported over the HTTP adapter.');
      }
      const limit = params.maxRows ?? DEFAULT_EXPORT_ROW_CAP;
      const fetchBody = {
        method: 'fetchData' as const,
        params: {
          columns: params.columns ?? [],
          filters: params.filters ?? [],
          sorting: params.sorting ?? [],
          pagination: { page: 1, limit },
        },
      };
      const result = (await send(fetchBody)) as FetchDataResult<TData>;
      const rows = result.data as Record<string, unknown>[];
      const isJson = params.format === 'json';
      return {
        data: isJson
          ? recordsToJson(rows)
          : recordsToCsv(rows, { includeHeaders: params.includeHeaders !== false }),
        filename: `export.${params.format}`,
        mimeType: isJson ? 'application/json' : 'text/csv',
      };
    },

    async getFilterOptions(columnId: string, params?: FacetQueryParams): Promise<FilterOption[]> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = {
        method: 'getFilterOptions' as const,
        columnId,
        ...(hasParams ? { params: serializable } : {}),
      };
      const result = await sendCacheable(body, signal);
      return result as FilterOption[];
    },

    async getFacetedValues(
      columnId: string,
      params?: FacetQueryParams
    ): Promise<Map<string, number>> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = {
        method: 'getFacetedValues' as const,
        columnId,
        ...(hasParams ? { params: serializable } : {}),
      };
      const result = await sendCacheable(body, signal);
      return new Map(result as [string, number][]);
    },

    async getMinMaxValues(columnId: string, params?: FacetQueryParams): Promise<[number, number]> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = {
        method: 'getMinMaxValues' as const,
        columnId,
        ...(hasParams ? { params: serializable } : {}),
      };
      const result = await sendCacheable(body, signal);
      return result as [number, number];
    },

    /**
     * Batched facet reads — one POST for a whole sidebar refresh instead of
     * one per column. Cached/deduped like the singular facet reads.
     */
    async getFacets(
      requests: FacetRequest[],
      params?: FacetQueryParams
    ): Promise<FacetBatchResult> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = {
        method: 'getFacets' as const,
        requests,
        ...(hasParams ? { params: serializable } : {}),
      };
      const raw = (await sendCacheable(body, signal)) as {
        values?: Record<string, [string, number][]>;
        ranges?: Record<string, [number, number]>;
      };
      const values: FacetBatchResult['values'] = {};
      for (const [id, entries] of Object.entries(raw.values ?? {})) {
        values[id] = new Map(entries);
      }
      return { values, ranges: raw.ranges ?? {} };
    },

    async describeColumns(table?: string): Promise<InferredColumnSpec[]> {
      // A schema answer is stable — route through the same TTL cache/dedup
      // as the facet reads (plan 041) so repeated mounts don't refetch.
      const body = {
        method: 'describeColumns' as const,
        ...(table !== undefined ? { table } : {}),
      };
      const result = await sendCacheable(body);
      return result as InferredColumnSpec[];
    },

    async resolveCellWriteTarget(
      columnId: string,
      table?: string
    ): Promise<CellWriteTarget | null> {
      // A READ (schema/relationship introspection, plan 055) — independent
      // of the write opt-in, cached like describeColumns.
      const body = {
        method: 'resolveCellWriteTarget' as const,
        columnId,
        ...(table !== undefined ? { table } : {}),
      };
      const result = await sendCacheable(body);
      return result as CellWriteTarget | null;
    },

    // Proxied writes are DOUBLE opt-in (plan 055): without `writes: true`
    // here the adapter's shape stays byte-identical to the read-only pre-055
    // surface (no updateRecord, meta advertises update: false).
    ...(config.writes
      ? {
          async updateRecord(
            id: string,
            data: Partial<TData>,
            options?: MutationOptions
          ): Promise<TData> {
            const keys = Object.keys(data as Record<string, unknown>);
            const field = keys[0];
            if (keys.length !== 1 || !field) {
              throw new HttpAdapterError(
                'httpAdapter cell edits are singular — pass exactly one field per updateRecord call.'
              );
            }
            const raw = (data as Record<string, unknown>)[field];
            const value = raw instanceof Date ? raw.toISOString() : raw;
            // Bug fix: `field` here is the STORAGE field (the `data` key —
            // the related table's field for a relationship-path column).
            // Allow-lists and `resolveCellWriteTarget` are keyed by COLUMN
            // id, so prefer `options.columnId` (set by the editable-cells
            // save path) on the wire when present; falls back to `field`
            // for own-table columns, where storage field === column id.
            const wireField = options?.columnId ?? field;
            const body = {
              method: 'cellEdit' as const,
              id,
              field: wireField,
              value,
              ...(options?.table !== undefined ? { table: options.table } : {}),
            };
            // Writes are never cached/deduped.
            const result = await send(body);
            return result as TData;
          },
        }
      : {}),
  };
}
