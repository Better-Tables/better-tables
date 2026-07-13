/**
 * @fileoverview Guard for accesses that are provably in-bounds by an
 * invariant the type checker can't see (e.g. an array sized to
 * `totalRows + 1` and read at indices `0..totalRows`).
 *
 * Only use this where the "impossible" `undefined` would indicate a real
 * bug in the invariant, not user-facing bad input — for anything reachable
 * from external input, prefer an explicit early-return/throw or `?? fallback`
 * over this helper.
 *
 * @module utils/assert-defined
 */

/**
 * Assert that `value` is not `undefined` (or `null`), narrowing it for the
 * rest of the block. Throws with `message` if the invariant is violated.
 */
export function assertDefined<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}
