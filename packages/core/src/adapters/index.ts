/**
 * @fileoverview HTTP transport for the `TableAdapter` contract — a client-side
 * proxy adapter and its server-side request handler. See {@link httpAdapter}
 * and {@link handleAdapterRequest}.
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
