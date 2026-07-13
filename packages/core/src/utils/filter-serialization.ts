/**
 * @fileoverview Filter serialization utilities for URL state persistence.
 *
 * This module provides pure functions for serializing and deserializing filter states
 * to/from compressed URL-safe strings. All serialization uses compression for consistency.
 *
 * This is a framework-agnostic module with no browser or framework dependencies.
 * For browser-specific URL manipulation, use utilities from @better-tables/ui.
 *
 * Uses compression utilities from ./compression for encoding/decoding.
 *
 * ## Wire format versioning (plan 015, design `plans/design/core-contract-v2.md` §1.3)
 *
 * `serializeFiltersToURL` always emits the `c2:`-prefixed, group-aware
 * format: a payload is either a flat `FilterState[]` (implicit AND) or a
 * single {@link FilterGroupNode} (AND/OR, possibly nested).
 * `deserializeFiltersFromURL` tries `c2:` first, then falls back to parsing
 * a legacy `c:` payload as a flat `FilterState[]` (implicit AND) -- the one
 * compatibility exception the 0.6 release policy keeps, because
 * shared/bookmarked URLs in the wild are not API consumers.
 *
 * @module utils/filter-serialization
 */

import type { FilterGroupNode, FilterState } from '../types/filter';
import { compressAndEncode, decompressAndDecode } from './compression';
import { isFilterGroupNode, isFilterStateShape, normalizeFilterNode } from './type-guards';

/** URL prefix for the group-aware (contract v2) wire format. WRITE always emits this. */
const FILTER_WIRE_PREFIX_V2 = 'c2:';

/** URL prefix for the legacy flat wire format. READ-only fallback (implicit AND). */
const FILTER_WIRE_PREFIX_LEGACY = 'c:';

/**
 * Validate and collect a flat array of untrusted, `unknown`-typed decoded
 * entries into `FilterState[]`, dropping (fail closed) anything that
 * doesn't match {@link isFilterStateShape} with a value-free warning. Shared
 * by both the `c2:` array-payload path and the legacy `c:` path -- a bare
 * top-level array is always a flat leaf list (implicit AND) in both wire
 * formats (design §1.1: nesting/OR requires a top-level {@link FilterGroupNode}).
 */
function collectValidFlatFilters(decoded: unknown[]): FilterState[] {
  const valid: FilterState[] = [];

  for (const entry of decoded) {
    if (isFilterStateShape(entry)) {
      valid.push(entry);
    } else {
      const columnId =
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { columnId?: unknown }).columnId === 'string'
          ? (entry as { columnId: string }).columnId
          : '<unknown>';
      // biome-ignore lint: Intentional warning logging for dropped invalid filters
      console.warn(
        `[better-tables] Dropped invalid filter for column "${columnId}": entry does not match the expected filter shape.`
      );
    }
  }

  return valid;
}

/**
 * Serialize filters to a URL-safe compressed string.
 *
 * Converts a flat filter list (implicit AND) or a single AND/OR
 * {@link FilterGroupNode} into a compact, URL-safe representation using
 * compression. Always compresses data for consistency and optimal URL
 * length, and always emits the `c2:`-prefixed, group-aware wire format
 * (design §1.3).
 *
 * @param filters - A flat array of filter states (implicit AND), or a
 * single {@link FilterGroupNode} expressing OR/nesting
 * @returns Compressed URL-safe string (prefixed with "c2:")
 *
 * @example
 * ```typescript
 * const filters: FilterState[] = [
 *   { columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }
 * ];
 *
 * const serialized = serializeFiltersToURL(filters);
 * // Returns: "c2:..." (compressed string)
 * ```
 */
export function serializeFiltersToURL(filters: FilterState[] | FilterGroupNode): string {
  return compressAndEncode(filters, FILTER_WIRE_PREFIX_V2);
}

/**
 * Deserialize a `c2:`-prefixed (contract v2, group-aware) payload.
 *
 * A bare top-level array is a flat `FilterState[]` (implicit AND, same
 * validation as the legacy path). A non-array top-level value is normalized
 * as a {@link FilterGroupNode} tree via {@link normalizeFilterNode} (design
 * §1.4: fail closed, drop invalid/unknown-logic/empty groups -- including a
 * single invalid child among otherwise-valid siblings -- unwrap single-child
 * groups, drop over-deep subtrees). A normalized single leaf is wrapped back
 * into a length-1 array so the return type stays `FilterState[] |
 * FilterGroupNode`, matching what `serializeFiltersToURL` accepts.
 *
 * Deliberately does NOT pre-gate on `isFilterNodeShape` (`utils/type-guards.ts`):
 * that guard is strict/all-or-nothing (one invalid child fails the whole
 * node), whereas `normalizeFilterNode` does the equivalent validation itself
 * but bottom-up and per-node, which is what lets an invalid sibling be
 * dropped while valid siblings survive.
 */
function deserializeV2Payload(urlString: string): FilterState[] | FilterGroupNode {
  const decoded = decompressAndDecode<unknown>(urlString, FILTER_WIRE_PREFIX_V2);
  if (!decoded) {
    throw new Error('Failed to decompress data');
  }

  if (Array.isArray(decoded)) {
    return collectValidFlatFilters(decoded);
  }

  const normalized = normalizeFilterNode(decoded);
  if (normalized === null) {
    return [];
  }

  return isFilterGroupNode(normalized) ? normalized : [normalized];
}

/**
 * Deserialize a legacy `c:`-prefixed (flat, pre-contract-v2) payload.
 *
 * Read-only compatibility path (design §1.3): an old `c:` payload is always
 * a flat `FilterState[]`, which is exactly the implicit-AND case, so it
 * round-trips into the new model for free. Entries are validated via
 * {@link isFilterStateShape} and dropped (fail closed) with a value-free
 * warning, matching plan 004's existing convention.
 */
function deserializeLegacyPayload(urlString: string): FilterState[] {
  const decoded = decompressAndDecode<FilterState[]>(urlString, FILTER_WIRE_PREFIX_LEGACY);
  if (!decoded) {
    throw new Error('Failed to decompress data');
  }

  if (!Array.isArray(decoded)) {
    throw new Error('Invalid filter data format: expected array');
  }

  return collectValidFlatFilters(decoded);
}

/**
 * Deserialize filters from a URL-safe compressed string.
 *
 * Converts a compressed URL-safe string back to a flat filter list or an
 * AND/OR filter-group tree. Tries the `c2:` (contract v2, group-aware)
 * format first, then falls back to the legacy `c:` (flat) format -- the one
 * compatibility exception the 0.6 release policy keeps (design §1.3).
 *
 * @param urlString - Compressed URL-safe encoded string containing filters
 * (must start with "c2:" or, for legacy payloads, "c:")
 * @returns A flat array of filter states (implicit AND), or a single
 * {@link FilterGroupNode} expressing OR/nesting
 * @throws {Error} If the string cannot be deserialized or is not in a
 * recognized compressed format
 *
 * @example
 * ```typescript
 * const urlString = 'c2:...'; // Compressed string
 *
 * try {
 *   const filters = deserializeFiltersFromURL(urlString);
 *   console.log(filters); // [{ columnId: 'name', type: 'text', operator: 'contains', values: ['john'] }]
 * } catch (error) {
 *   console.error('Failed to deserialize filters:', error);
 * }
 * ```
 */
export function deserializeFiltersFromURL(urlString: string): FilterState[] | FilterGroupNode {
  if (!urlString || urlString.trim() === '') {
    throw new Error('Empty URL string');
  }

  try {
    if (urlString.startsWith(FILTER_WIRE_PREFIX_V2)) {
      return deserializeV2Payload(urlString);
    }

    if (urlString.startsWith(FILTER_WIRE_PREFIX_LEGACY)) {
      return deserializeLegacyPayload(urlString);
    }

    throw new Error(
      'Invalid format: only compressed format (prefixed with "c2:" or "c:") is supported'
    );
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to deserialize filters from URL');
  }
}
