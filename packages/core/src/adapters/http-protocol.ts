/**
 * @fileoverview Wire protocol shared by the client {@link httpAdapter} and the
 * server {@link handleAdapterRequest}. A single request/response envelope lets
 * a browser-side `TableAdapter` proxy every read to a server-only adapter (one
 * that wraps a native DB binding) over HTTP, without either side hand-rolling
 * fetch plumbing or `Map` (de)serialization.
 */

import type { FacetQueryParams, FacetRequest, FetchDataParams } from '../types/adapter';

/**
 * The methods the HTTP transport proxies: the reads (always available) plus
 * `cellEdit` — the ONE write, available only behind double opt-in
 * (`writes` on the route handler AND on `httpAdapter`; plan 055).
 */
export type AdapterMethod =
  | 'fetchData'
  | 'getFilterOptions'
  | 'getFacetedValues'
  | 'getMinMaxValues'
  | 'getFacets'
  | 'describeColumns'
  | 'listTables'
  | 'resolveCellWriteTarget'
  | 'cellEdit';

/**
 * Upper bound on entries in one `getFacets` batch. Far above any real
 * sidebar (a handful of facets); exists so a malicious body can't fan a
 * single POST out into thousands of adapter queries.
 */
export const MAX_FACET_BATCH_SIZE = 50;

/**
 * A single request over the wire. `fetchData` carries a `params` object
 * (minus the non-serializable `AbortSignal`); the three column-scoped facet
 * methods carry a `columnId` plus optional `params`; `describeColumns`
 * (plan 054) carries an optional `table`; `listTables` (plan 065) carries
 * no fields at all — each a plain-JSON read, same envelope.
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
    }
  | {
      method: 'getFacets';
      /**
       * Batched facet reads answered in one round-trip. At most
       * {@link MAX_FACET_BATCH_SIZE} entries; the server rejects larger
       * batches as `bad_request`.
       */
      requests: FacetRequest[];
      /** {@link FacetQueryParams} without `signal` (handled client-side). */
      params?: Omit<FacetQueryParams, 'signal'>;
    }
  | {
      method: 'describeColumns';
      /** Table to describe — same resolution as `FetchDataParams.primaryTable`. */
      table?: string;
    }
  | {
      /** List every table the adapter can serve (plan 065 Phase 5/7) — no arguments. */
      method: 'listTables';
    }
  | {
      method: 'resolveCellWriteTarget';
      /** The column id to resolve (may be dotted, e.g. 'customer.company'). */
      columnId: string;
      /** Primary-table context — same resolution as `FetchDataParams.primaryTable`. */
      table?: string;
    }
  | {
      method: 'cellEdit';
      /** TARGET row id (the RELATED row's id for relationship-path columns). */
      id: string;
      /**
       * The COLUMN id (cell-oriented, singular — NOT a free-form data
       * record): the server re-resolves column → (table, field) through
       * `resolveCellWriteTarget`, so the client can never redirect a write.
       */
      field: string;
      /** Wire-safe value (dates as ISO strings). */
      value: unknown;
      /** Primary-table context — same resolution as `FetchDataParams.primaryTable`. */
      table?: string;
    };

/**
 * The response envelope. `result` is the method's return value already made
 * JSON-safe:
 * - a `getFacetedValues` `Map` is sent as its `[value, count][]` entries
 * - a `getFacets` result's `values` maps are sent the same way
 *   (`{ values: Record<columnId, [value, count][]>, ranges: ... }`)
 * - `fetchData` result's optional `faceted` maps are sent the same way
 *   (`Record<string, [value, count][]>`) and rebuilt into `Map`s on the client
 * - `Date` values in filter params / rows serialize as ISO strings (JSON)
 *
 * Failure envelopes carry a `kind` so transports can map `bad_request` → 400,
 * `forbidden` → 403 (writes not enabled / not authorized), and
 * `server_error` → 500 without leaking adapter/DB messages to clients.
 */
export type AdapterResponseBody =
  | { ok: true; result: unknown }
  | { ok: false; error: string; kind: 'bad_request' | 'forbidden' | 'server_error' };
