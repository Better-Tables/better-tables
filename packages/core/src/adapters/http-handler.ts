/**
 * @fileoverview Server counterpart to {@link httpAdapter}: dispatch a decoded
 * {@link AdapterRequestBody} to a real (server-only) `TableAdapter` and produce
 * a JSON-safe {@link AdapterResponseBody}. `handleAdapterRequest` is
 * framework-agnostic (plain in → plain out); `createAdapterRouteHandler` wraps
 * it in a web-standard `Request` → `Response` handler for app-router route
 * files, edge functions, etc.
 */

import type { FetchDataResult, TableAdapter } from '../types/adapter';
import type { AdapterRequestBody, AdapterResponseBody } from './http-protocol';

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

    const constrained = routeOptions?.constrainRequest
      ? routeOptions.constrainRequest(body, request)
      : body;

    const envelope = await handleAdapterRequest(
      source,
      constrained,
      routeOptions?.onError ? { onError: routeOptions.onError } : undefined,
      { request }
    );

    const status = envelope.ok ? 200 : envelope.kind === 'server_error' ? 500 : 400;
    return new Response(JSON.stringify(envelope), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}
