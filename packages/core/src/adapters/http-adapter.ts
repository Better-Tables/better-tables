/**
 * @fileoverview `httpAdapter` — a browser-safe `TableAdapter` that proxies
 * every read to an HTTP endpoint (paired with {@link handleAdapterRequest} on
 * the server). This closes the "server-only adapter, client-side table" gap:
 * a real adapter wrapping a native DB binding can't be called from the
 * browser, so client components (e.g. `useFacets`, faceted sidebars) otherwise
 * force the app to hand-write a fetch shim. `httpAdapter(url)` is that shim,
 * once, for everyone.
 */

import type {
  AdapterMeta,
  FacetQueryParams,
  FetchDataParams,
  FetchDataResult,
  TableAdapter,
} from '../types/adapter';
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
      export: false,
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
 * Create a client-side {@link TableAdapter} that proxies its four read methods
 * (`fetchData`, `getFilterOptions`, `getFacetedValues`, `getMinMaxValues`) to
 * an HTTP endpoint. Mount {@link handleAdapterRequest} at that endpoint,
 * backed by your real (server-only) adapter.
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

  const cacheTtlMs = config.cacheTtlMs === false || config.cacheTtlMs === 0 ? 0 : (config.cacheTtlMs ?? 2000);
  const inFlight = new Map<string, Promise<unknown>>();
  const resultCache = new Map<string, { result: unknown; expiresAt: number }>();

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

  async function sendCacheable(body: AdapterRequestBody): Promise<unknown> {
    const cacheKey = JSON.stringify(body);
    if (cacheTtlMs > 0) {
      const cached = resultCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.result;
      let pending = inFlight.get(cacheKey);
      if (pending) return pending;
      pending = performFetch(body);
      inFlight.set(cacheKey, pending);
      try {
        const result = await pending;
        resultCache.set(cacheKey, { result, expiresAt: Date.now() + cacheTtlMs });
        return result;
      } catch (error) {
        resultCache.delete(cacheKey);
        throw error;
      } finally {
        inFlight.delete(cacheKey);
      }
    }
    return performFetch(body);
  }

  return {
    meta: config.meta ?? defaultHttpAdapterMeta(),

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

    async getFilterOptions(columnId: string, params?: FacetQueryParams): Promise<FilterOption[]> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = { method: 'getFilterOptions' as const, columnId, ...(hasParams ? { params: serializable } : {}) };
      const result = signal ? await send(body, signal) : await sendCacheable(body);
      return result as FilterOption[];
    },

    async getFacetedValues(
      columnId: string,
      params?: FacetQueryParams
    ): Promise<Map<string, number>> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = { method: 'getFacetedValues' as const, columnId, ...(hasParams ? { params: serializable } : {}) };
      const result = signal ? await send(body, signal) : await sendCacheable(body);
      return new Map(result as [string, number][]);
    },

    async getMinMaxValues(columnId: string, params?: FacetQueryParams): Promise<[number, number]> {
      const { signal, ...serializable } = params ?? {};
      const hasParams = Object.keys(serializable).length > 0;
      const body = { method: 'getMinMaxValues' as const, columnId, ...(hasParams ? { params: serializable } : {}) };
      const result = signal ? await send(body, signal) : await sendCacheable(body);
      return result as [number, number];
    },
  };
}
