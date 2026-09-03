/**
 * @fileoverview Server counterpart to {@link httpAdapter}: dispatch a decoded
 * {@link AdapterRequestBody} to a real (server-only) `TableAdapter` and produce
 * a JSON-safe {@link AdapterResponseBody}. `handleAdapterRequest` is
 * framework-agnostic (plain in → plain out); `createAdapterRouteHandler` wraps
 * it in a web-standard `Request` → `Response` handler for app-router route
 * files, edge functions, etc.
 */

import { coerceCellValue } from '../lib/cell-edit-core';
import type { FacetBatchResult, FetchDataResult, TableAdapter } from '../types/adapter';
import type { AdapterRequestBody, AdapterResponseBody } from './http-protocol';
import { MAX_FACET_BATCH_SIZE } from './http-protocol';

/**
 * Opt-in write configuration (plan 055). Absent/false = writes disabled
 * (the pre-055 read-only behavior). `true` allows a `cellEdit` on any
 * column the adapter's schema says is writable; the `{ columns }` object
 * form narrows the allow-list to the app's ACTUAL editable columns —
 * RECOMMENDED, because the handler has no TableDefinition and
 * schema-writable alone is broader than app-editable.
 */
export type AdapterWritesOption = boolean | { columns: string[] };

/**
 * Context forwarded to lazy adapter factories when serving over HTTP.
 */
export interface AdapterSourceContext {
  /** The incoming web-standard Request, when serving over HTTP. */
  request?: Request;
}

/**
 * Provide the adapter to serve a request with. A function form lets the
 * adapter be constructed lazily / per-request (e.g. the memoized async getter
 * a native-DB-binding adapter needs so it isn't instantiated at module load —
 * see finding 13). The optional context is available when serving HTTP.
 */
export type AdapterSource<TData = unknown> =
  | TableAdapter<TData>
  | ((context?: AdapterSourceContext) => TableAdapter<TData> | Promise<TableAdapter<TData>>);

export interface HandleAdapterRequestOptions {
  /** Server-side error sink for `server_error` responses. */
  onError?: (error: unknown) => void;
  /** Opt-in write gate for `cellEdit` (plan 055) — see {@link AdapterWritesOption}. */
  writes?: AdapterWritesOption;
}

/**
 * Options for {@link createAdapterRouteHandler}.
 */
export interface AdapterRouteHandlerOptions {
  /**
   * Gate every request. Return `false` to reject (403 envelope), or a
   * `Response` to short-circuit with your own reply (e.g. 401 + WWW-Authenticate).
   */
  authorize?: (
    request: Request,
    body: AdapterRequestBody
  ) => boolean | Response | Promise<boolean | Response>;
  /**
   * Constrain the decoded request before dispatch — the place to pin
   * `primaryTable`, strip `columns`, or clamp pagination for this endpoint.
   * Return the (possibly replaced) body.
   */
  constrainRequest?: (body: AdapterRequestBody, request: Request) => AdapterRequestBody;
  /** Server-side error sink for `server_error` responses. */
  onError?: (error: unknown) => void;
  /**
   * Opt-in write gate for `cellEdit` (plan 055) — see
   * {@link AdapterWritesOption}. Enabling writes without an `authorize`
   * callback logs a dev warn at handler creation: every browser can reach
   * this endpoint, and row-level authorization is the APP's concern.
   */
  writes?: AdapterWritesOption;
}

async function resolveAdapter<TData>(
  source: AdapterSource<TData>,
  context?: AdapterSourceContext
): Promise<TableAdapter<TData>> {
  return typeof source === 'function'
    ? (
        source as (
          context?: AdapterSourceContext
        ) => TableAdapter<TData> | Promise<TableAdapter<TData>>
      )(context)
    : source;
}

function isValidBody(body: unknown): body is AdapterRequestBody {
  if (!body || typeof body !== 'object') return false;
  const method = (body as { method?: unknown }).method;
  if (method === 'fetchData') return true;
  if (
    method === 'getFilterOptions' ||
    method === 'getFacetedValues' ||
    method === 'getMinMaxValues'
  ) {
    return typeof (body as { columnId?: unknown }).columnId === 'string';
  }
  if (method === 'getFacets') {
    const requests = (body as { requests?: unknown }).requests;
    return (
      Array.isArray(requests) &&
      requests.length > 0 &&
      requests.length <= MAX_FACET_BATCH_SIZE &&
      requests.every(
        (entry: unknown) =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as { columnId?: unknown }).columnId === 'string' &&
          ((entry as { kind?: unknown }).kind === 'values' ||
            (entry as { kind?: unknown }).kind === 'minmax')
      )
    );
  }
  if (method === 'describeColumns') {
    const table = (body as { table?: unknown }).table;
    return table === undefined || typeof table === 'string';
  }
  if (method === 'listTables') return true;
  if (method === 'resolveCellWriteTarget') {
    const table = (body as { table?: unknown }).table;
    return (
      typeof (body as { columnId?: unknown }).columnId === 'string' &&
      (table === undefined || typeof table === 'string')
    );
  }
  if (method === 'cellEdit') {
    const candidate = body as { id?: unknown; field?: unknown; table?: unknown };
    return (
      typeof candidate.id === 'string' &&
      candidate.id.length > 0 &&
      typeof candidate.field === 'string' &&
      candidate.field.length > 0 &&
      'value' in (body as object) &&
      (candidate.table === undefined || typeof candidate.table === 'string')
    );
  }
  return false;
}

function serializeFaceted(
  faceted: NonNullable<FetchDataResult['faceted']>
): Record<string, [string, number][]> {
  return Object.fromEntries(
    Object.entries(faceted).map(([key, map]) => [key, Array.from(map.entries())])
  );
}

/**
 * Dispatch a decoded request body to `adapter` and return a JSON-safe
 * response envelope. Never throws for a domain/validation error — those are
 * captured into `{ ok: false, error, kind }` so the transport layer can send a
 * clean response. (Callers still choose the HTTP status; see
 * {@link createAdapterRouteHandler}.)
 *
 * @param source - The adapter (or a factory for it) to serve the request.
 * @param body - The parsed request body (from `httpAdapter`).
 * @param options - Optional `onError` sink for server failures.
 * @param context - Optional request context for lazy adapter factories.
 */
export async function handleAdapterRequest<TData = unknown>(
  source: AdapterSource<TData>,
  body: unknown,
  options?: HandleAdapterRequestOptions,
  context?: AdapterSourceContext
): Promise<AdapterResponseBody> {
  if (!isValidBody(body)) {
    return {
      ok: false,
      error: 'Malformed adapter request body.',
      kind: 'bad_request',
    };
  }

  try {
    const adapter = await resolveAdapter(source, context);

    switch (body.method) {
      case 'fetchData': {
        const result = await adapter.fetchData(body.params);
        if (result.faceted) {
          return {
            ok: true,
            result: {
              ...result,
              faceted: serializeFaceted(result.faceted),
            },
          };
        }
        return { ok: true, result };
      }
      case 'getFilterOptions': {
        const result = await adapter.getFilterOptions(body.columnId, body.params);
        return { ok: true, result };
      }
      case 'getFacetedValues': {
        const map = await adapter.getFacetedValues(body.columnId, body.params);
        // A `Map` isn't JSON-serializable — send its entries; the client
        // rebuilds the `Map`.
        return { ok: true, result: Array.from(map.entries()) };
      }
      case 'getMinMaxValues': {
        const result = await adapter.getMinMaxValues(body.columnId, body.params);
        return { ok: true, result };
      }
      case 'getFacets': {
        // One POST, K facet reads. Prefer the adapter's own batch when it has
        // one; otherwise fan out to the singular methods server-side — the
        // round-trips this saves are the client↔server ones, not the
        // adapter↔DB ones.
        let batch: FacetBatchResult;
        if (adapter.getFacets) {
          batch = await adapter.getFacets(body.requests, body.params);
        } else {
          const values: FacetBatchResult['values'] = {};
          const ranges: FacetBatchResult['ranges'] = {};
          await Promise.all(
            body.requests.map(async (entry) => {
              if (entry.kind === 'values') {
                values[entry.columnId] = await adapter.getFacetedValues(
                  entry.columnId,
                  body.params
                );
              } else {
                ranges[entry.columnId] = await adapter.getMinMaxValues(entry.columnId, body.params);
              }
            })
          );
          batch = { values, ranges };
        }
        return {
          ok: true,
          result: {
            values: Object.fromEntries(
              Object.entries(batch.values).map(([key, map]) => [key, Array.from(map.entries())])
            ),
            ranges: batch.ranges,
          },
        };
      }
      case 'describeColumns': {
        // Optional capability (plan 054): an adapter without it is a caller
        // mistake (mounting auto columns over a non-introspectable adapter),
        // not a server failure — report it as such.
        if (!adapter.describeColumns) {
          return {
            ok: false,
            error: 'Adapter does not support describeColumns.',
            kind: 'bad_request',
          };
        }
        const result = await adapter.describeColumns(body.table);
        return { ok: true, result };
      }
      case 'listTables': {
        // Optional capability (plan 065 Phase 5): an adapter without it is a
        // caller mistake (mounting <TableNavigator> over a non-introspectable
        // adapter), not a server failure — report it as such.
        if (!adapter.listTables) {
          return {
            ok: false,
            error: 'Adapter does not support listTables.',
            kind: 'bad_request',
          };
        }
        const result = await adapter.listTables();
        return { ok: true, result };
      }
      case 'resolveCellWriteTarget': {
        // A READ (pure introspection, plan 055) — independent of the write
        // opt-in; the UI needs it to gate relationship-path columns.
        if (!adapter.resolveCellWriteTarget) {
          return {
            ok: false,
            error: 'Adapter does not support resolveCellWriteTarget.',
            kind: 'bad_request',
          };
        }
        const result = await adapter.resolveCellWriteTarget(body.columnId, body.table);
        return { ok: true, result };
      }
      case 'cellEdit': {
        // The ONE proxied write (plan 055) — double opt-in, fail closed.
        const writes = options?.writes;
        if (!writes) {
          return {
            ok: false,
            error: 'Writes are not enabled on this endpoint.',
            kind: 'forbidden',
          };
        }
        // FAIL CLOSED: without schema introspection the server cannot
        // validate the target or the value — never trust the client.
        if (!adapter.resolveCellWriteTarget || !adapter.describeColumns) {
          return {
            ok: false,
            error: 'Adapter cannot validate writes (schema introspection unavailable).',
            kind: 'bad_request',
          };
        }
        // `body.field` is the COLUMN id — re-resolved server-side against
        // `body.table` so the client can never redirect a write (plan 055).
        const target = await adapter.resolveCellWriteTarget(body.field, body.table);
        if (!target || !target.writable || !target.single) {
          return {
            ok: false,
            error: `Column "${body.field}" is not writable.`,
            kind: 'bad_request',
          };
        }
        if (typeof writes === 'object') {
          if (!writes.columns.includes(body.field)) {
            return {
              ok: false,
              error: `Column "${body.field}" is not on the write allow-list.`,
              kind: 'bad_request',
            };
          }
          // Cross-table bypass guard (P1): `{ columns }` allow-list entries
          // are bare column ids, meaningful only relative to ONE canonical
          // table — but `body.table` is client-supplied. Without this
          // check, a client could keep an allow-listed column id (e.g.
          // `'subject'`) and swap `body.table` to redirect the write to a
          // DIFFERENT table that happens to expose a writable column
          // sharing that same id/name, bypassing the app's intended scope.
          // Re-resolve the SAME column id against the endpoint's own
          // default table (ignoring the client-supplied `body.table`) and
          // require it lands on the identical (table, field) — fail closed
          // on any mismatch, ambiguity, or introspection failure. Apps that
          // genuinely serve several primary tables from one endpoint must
          // pin `table` via `constrainRequest` (same guidance as reads).
          if (body.table !== undefined) {
            let canonical: Awaited<ReturnType<typeof adapter.resolveCellWriteTarget>> = null;
            try {
              canonical = await adapter.resolveCellWriteTarget(body.field);
            } catch {
              canonical = null;
            }
            if (
              !canonical ||
              canonical.table !== target.table ||
              canonical.field !== target.field
            ) {
              return {
                ok: false,
                error: `Column "${body.field}" is not on the write allow-list.`,
                kind: 'bad_request',
              };
            }
          }
        }
        const specs = await adapter.describeColumns(target.table);
        const spec = specs.find((candidate) => candidate.field === target.field);
        if (!spec || !spec.writable) {
          return {
            ok: false,
            error: `Column "${body.field}" is not writable.`,
            kind: 'bad_request',
          };
        }
        const coerced = coerceCellValue(spec.columnType, body.value, spec.options, spec.nullable);
        if (!coerced.ok) {
          return { ok: false, error: coerced.error, kind: 'bad_request' };
        }
        if (!adapter.updateRecord) {
          return {
            ok: false,
            error: 'Adapter does not support updateRecord.',
            kind: 'bad_request',
          };
        }
        const result = await adapter.updateRecord(
          body.id,
          { [target.field]: coerced.value } as Partial<TData>,
          { table: target.table }
        );
        return { ok: true, result };
      }
    }
  } catch (error) {
    if (options?.onError) {
      try {
        options.onError(error);
      } catch {
        // A throwing logger must not mask the response.
      }
    }
    return {
      ok: false,
      error: 'Adapter request failed.',
      kind: 'server_error',
    };
  }
}

/**
 * Wrap {@link handleAdapterRequest} as a web-standard `Request` → `Response`
 * handler — drop-in for a Next.js app-router route (`export const POST = ...`),
 * an edge function, or anything that speaks the Fetch API.
 *
 * Status mapping: success → 200; `kind: 'bad_request'` (and authorize false)
 * → 400/403; `kind: 'server_error'` → 500. The response is `application/json`.
 * Throws from `authorize` / `constrainRequest` are caught the same way as
 * adapter failures (500 + `server_error` envelope + optional `onError`).
 *
 * @example
 * ```ts
 * // app/api/tables/tickets/route.ts
 * import { createAdapterRouteHandler } from '@better-tables/core';
 * import { getTicketsAdapter } from '@/lib/tickets';
 * export const POST = createAdapterRouteHandler(() => getTicketsAdapter(), {
 *   constrainRequest: (body) =>
 *     body.method === 'fetchData'
 *       ? { ...body, params: { ...body.params, primaryTable: 'tickets' } }
 *       : body,
 * });
 * ```
 */
export function createAdapterRouteHandler<TData = unknown>(
  source: AdapterSource<TData>,
  routeOptions?: AdapterRouteHandlerOptions
): (request: Request) => Promise<Response> {
  // Writes without authorization means ANY browser can write through this
  // endpoint — warn once, at creation (plan 055).
  if (
    routeOptions?.writes &&
    !routeOptions.authorize &&
    (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production')
  ) {
    console.warn(
      '[better-tables] createAdapterRouteHandler: writes are enabled without an `authorize` ' +
        'callback — every client of this endpoint can write. Add authorize (and consider ' +
        'writes: { columns } narrowing).'
    );
  }

  return async (request: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    if (!isValidBody(body)) {
      const envelope: AdapterResponseBody = {
        ok: false,
        error: 'Malformed adapter request body.',
        kind: 'bad_request',
      };
      return new Response(JSON.stringify(envelope), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    let constrained: AdapterRequestBody = body;
    try {
      if (routeOptions?.authorize) {
        const authResult = await routeOptions.authorize(request, body);
        if (authResult instanceof Response) {
          return authResult;
        }
        if (authResult === false) {
          const envelope: AdapterResponseBody = {
            ok: false,
            error: 'Unauthorized.',
            kind: 'bad_request',
          };
          return new Response(JSON.stringify(envelope), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          });
        }
      }

      if (routeOptions?.constrainRequest) {
        constrained = routeOptions.constrainRequest(body, request);
      }
    } catch (error) {
      // Match handleAdapterRequest: never leak authorize/constrain failures
      // outside the JSON envelope + onError sink.
      if (routeOptions?.onError) {
        try {
          routeOptions.onError(error);
        } catch {
          // A throwing logger must not mask the response.
        }
      }
      const envelope: AdapterResponseBody = {
        ok: false,
        error: 'Adapter request failed.',
        kind: 'server_error',
      };
      return new Response(JSON.stringify(envelope), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const envelope = await handleAdapterRequest(
      source,
      constrained,
      {
        ...(routeOptions?.onError ? { onError: routeOptions.onError } : {}),
        ...(routeOptions?.writes !== undefined ? { writes: routeOptions.writes } : {}),
      },
      { request }
    );

    const status = envelope.ok
      ? 200
      : envelope.kind === 'server_error'
        ? 500
        : envelope.kind === 'forbidden'
          ? 403
          : 400;
    return new Response(JSON.stringify(envelope), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}
