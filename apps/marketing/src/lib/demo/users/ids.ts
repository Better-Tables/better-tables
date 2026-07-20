import type { UsersDialect } from './dialect';

const MAX_MUTATION_IDS = 100;

// Permissive UUID shape (Neon seed data is not always RFC variant-strict).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Parse bulk-action ids for the active users dialect.
 * Postgres uses UUID strings; SQLite fallback uses positive integers.
 */
export function parseUserIds(input: unknown, dialect: UsersDialect): string[] | number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MUTATION_IDS) {
    return null;
  }

  if (dialect === 'postgres') {
    // Only accept string UUIDs — reject numbers/booleans that String() would coerce.
    if (!input.every((id): id is string => typeof id === 'string')) {
      return null;
    }
    return input.every((id) => isUuid(id)) ? input : null;
  }

  // Accept positive integers or digit-only strings. Reject booleans/arrays/objects
  // that Number() would coerce (Number(true) === 1, Number([5]) === 5).
  const ids: number[] = [];
  for (const id of input) {
    if (typeof id === 'number') {
      if (!Number.isInteger(id) || id <= 0) return null;
      ids.push(id);
      continue;
    }
    if (typeof id === 'string' && /^\d+$/.test(id)) {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) return null;
      ids.push(n);
      continue;
    }
    return null;
  }
  return ids;
}

export function userIdsErrorMessage(dialect: UsersDialect): string {
  return dialect === 'postgres' ? 'Provide 1-100 UUID ids.' : 'Provide 1-100 numeric ids.';
}
