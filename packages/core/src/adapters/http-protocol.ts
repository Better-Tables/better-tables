/**
 * @fileoverview Wire protocol shared by the client {@link httpAdapter} and the
 * server {@link handleAdapterRequest}. A single request/response envelope lets
 * a browser-side `TableAdapter` proxy every read to a server-only adapter (one
 * that wraps a native DB binding) over HTTP, without either side hand-rolling
 * fetch plumbing or `Map` (de)serialization.
 */

import type { FacetQueryParams, FetchDataParams } from '../types/adapter';

/** The four read methods of `TableAdapter` the HTTP transport proxies. */
export type AdapterMethod =
  | 'fetchData'
  | 'getFilterOptions'
  | 'getFacetedValues'
  | 'getMinMaxValues';

/**
 * A single request over the wire. `fetchData` carries a `params` object
 * (minus the non-serializable `AbortSignal`); the three column-scoped facet
 * methods carry a `columnId` plus optional `params`.
 */
export type AdapterRequestBody =
  | {
      method: 'fetchData';
      /** {@link FetchDataParams} without `signal` (handled client-side). */
      params: Omit<FetchDataParams, 'signal'>;
    }
  | {
      method: 'getFilterOptions' | 'getFacetedValues' | 'getMinMaxValues';
      columnId: string;
      /** {@link FacetQueryParams} without `signal` (handled client-side). */
      params?: Omit<FacetQueryParams, 'signal'>;
    };

/**
 * The response envelope. `result` is the method's return value already made
 * JSON-safe:
 * - a `getFacetedValues` `Map` is sent as its `[value, count][]` entries
 * - `fetchData` result's optional `faceted` maps are sent the same way
 *   (`Record<string, [value, count][]>`) and rebuilt into `Map`s on the client
 * - `Date` values in filter params / rows serialize as ISO strings (JSON)
 *
 * Failure envelopes carry a `kind` so transports can map `bad_request` → 400
 * and `server_error` → 500 without leaking adapter/DB messages to clients.
 */
export type AdapterResponseBody =
  | { ok: true; result: unknown }
  | { ok: false; error: string; kind: 'bad_request' | 'server_error' };
