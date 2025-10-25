/**
 * Utility functions for deep and shallow equality comparisons
 * Used for structural sharing and change detection
 */

/**
 * Shallow equality comparison for arrays
 * Compares array length and references of elements
 */
export function shallowEqualArrays<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

/**
 * Shallow equality comparison for objects
 * Compares own enumerable properties and their references
 */
export function shallowEqualObjects<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (a === b) return true;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * Deep equality comparison
 * Recursively compares objects and arrays
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference or both primitives with same value
  if (a === b) return true;

  // Different types or one is null/undefined
  if (typeof a !== typeof b || a == null || b == null) return false;

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle Set objects
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }

  // Handle Map objects
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }

  // Handle Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;

      // biome-ignore lint/suspicious/noPrototypeBuiltins: Need es2020 compatibility
      if (!objB.hasOwnProperty(key)) return false;
      if (!deepEqual(objA[key], objB[key])) return false;
    }

    return true;
  }

  return false;
}

/**
 * Compare filter values arrays for equality
 * Handles primitives, dates, and common types
 */
export function equalFilterValues(a: unknown[], b: unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) return false;
  }

  return true;
}
