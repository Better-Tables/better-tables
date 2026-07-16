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
      params?: FacetQueryParams;
    };

/**
 * The response envelope. `result` is the method's return value already made
 * JSON-safe: a `getFacetedValues` `Map` is sent as its `[value, count][]`
 * entries and rebuilt into a `Map` on the client.
 */
export type AdapterResponseBody = { ok: true; result: unknown } | { ok: false; error: string };
