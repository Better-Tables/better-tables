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
    const ids = input.map((id) => String(id));
    return ids.every((id) => isUuid(id)) ? ids : null;
  }

  const ids = input.map((id) => Number(id));
  return ids.every((id) => Number.isInteger(id) && id > 0) ? ids : null;
}

export function userIdsErrorMessage(dialect: UsersDialect): string {
  return dialect === 'postgres' ? 'Provide 1-100 UUID ids.' : 'Provide 1-100 numeric ids.';
}
