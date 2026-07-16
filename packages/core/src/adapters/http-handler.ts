/**
 * @fileoverview Server counterpart to {@link httpAdapter}: dispatch a decoded
 * {@link AdapterRequestBody} to a real (server-only) `TableAdapter` and produce
 * a JSON-safe {@link AdapterResponseBody}. `handleAdapterRequest` is
 * framework-agnostic (plain in → plain out); `createAdapterRouteHandler` wraps
 * it in a web-standard `Request` → `Response` handler for app-router route
 * files, edge functions, etc.
 */

import type { TableAdapter } from '../types/adapter';
import type { AdapterRequestBody, AdapterResponseBody } from './http-protocol';

/**
 * Provide the adapter to serve a request with. A function form lets the
 * adapter be constructed lazily / per-request (e.g. the memoized async getter
 * a native-DB-binding adapter needs so it isn't instantiated at module load —
 * see finding 13).
 */
export type AdapterSource<TData = unknown> =
  | TableAdapter<TData>
  | (() => TableAdapter<TData> | Promise<TableAdapter<TData>>);

async function resolveAdapter<TData>(source: AdapterSource<TData>): Promise<TableAdapter<TData>> {
  return typeof source === 'function'
    ? (source as () => TableAdapter<TData> | Promise<TableAdapter<TData>>)()
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
  return false;
}

/**
 * Dispatch a decoded request body to `adapter` and return a JSON-safe
 * response envelope. Never throws for a domain/validation error — those are
 * captured into `{ ok: false, error }` so the transport layer can send a
 * clean response. (Callers still choose the HTTP status; see
 * {@link createAdapterRouteHandler}.)
 *
 * @param source - The adapter (or a factory for it) to serve the request.
 * @param body - The parsed request body (from `httpAdapter`).
 */
export async function handleAdapterRequest<TData = unknown>(
  source: AdapterSource<TData>,
  body: unknown
): Promise<AdapterResponseBody> {
  if (!isValidBody(body)) {
    return { ok: false, error: 'Malformed adapter request body.' };
  }

  try {
    const adapter = await resolveAdapter(source);

    switch (body.method) {
      case 'fetchData': {
        const result = await adapter.fetchData(body.params);
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
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Adapter request failed.' };
  }
}

/**
 * Wrap {@link handleAdapterRequest} as a web-standard `Request` → `Response`
 * handler — drop-in for a Next.js app-router route (`export const POST = ...`),
 * an edge function, or anything that speaks the Fetch API.
 *
 * A malformed body or `ok: false` envelope responds `400`; success responds
 * `200`. The response is `application/json`.
 *
 * @example
 * ```ts
 * // app/api/tables/tickets/route.ts
 * import { createAdapterRouteHandler } from '@better-tables/core';
 * import { getTicketsAdapter } from '@/lib/tickets';
 * export const POST = createAdapterRouteHandler(() => getTicketsAdapter());
 * ```
 */
export function createAdapterRouteHandler<TData = unknown>(
  source: AdapterSource<TData>
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const envelope = await handleAdapterRequest(source, body);
    return new Response(JSON.stringify(envelope), {
      status: envelope.ok ? 200 : 400,
      headers: { 'content-type': 'application/json' },
    });
  };
}
