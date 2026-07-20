/**
 * @fileoverview The adapters core ships itself:
 *
 * - **HTTP transport** — a client-side proxy adapter and its server-side
 *   request handler ({@link httpAdapter} / {@link handleAdapterRequest}),
 *   for calling a server-only adapter from the browser.
 * - **Memory** — {@link memoryAdapter}, the full read/filter/facet pipeline
 *   over a plain array of rows, for client-only tables, playgrounds, and tests.
 *
 * Database adapters live in their own packages (e.g.
 * `@better-tables/adapters-drizzle`).
 */

export {
  type FetchLike,
  type HttpAdapterConfig,
  HttpAdapterError,
  httpAdapter,
} from './http-adapter';
export {
  type AdapterRouteHandlerOptions,
  type AdapterSource,
  type AdapterSourceContext,
  createAdapterRouteHandler,
  type HandleAdapterRequestOptions,
  handleAdapterRequest,
} from './http-handler';
export type { AdapterMethod, AdapterRequestBody, AdapterResponseBody } from './http-protocol';
export { type MemoryAdapterOptions, memoryAdapter } from './memory-adapter';
