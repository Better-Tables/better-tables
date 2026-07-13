/**
 * @fileoverview SQL utility functions for safe SQL generation
 * @module @better-tables/adapters-toolkit/utils/sql-utils
 *
 * @description
 * Utility functions for safely working with SQL identifiers and expressions.
 * These functions help prevent SQL injection and ensure proper escaping.
 *
 * @since 1.0.0
 */

/**
 * Escapes SQL identifier characters for safe use in raw SQL queries.
 * Replaces each occurrence of the quote character with two quote characters,
 * following the SQL standard for identifier quoting.
 *
 * @param identifier - The SQL identifier to escape (e.g., column name, table alias)
 * @param quoteChar - The quote character used by the database (default: " for PostgreSQL/MySQL/SQLite)
 * @returns The escaped identifier safe for use in raw SQL
 *
 * @example
 * ```typescript
 * escapeSqlIdentifier('user_name') // Returns: 'user_name'
 * escapeSqlIdentifier('user"name') // Returns: 'user""name'
 * escapeSqlIdentifier('my`table', '`') // Returns: 'my``table' (for MySQL backticks)
 * ```
 *
 * @remarks
 * This function is used when constructing raw SQL expressions that reference
 * column aliases or identifiers. It prevents SQL injection by properly escaping
 * quote characters that could break out of identifier boundaries.
 *
 * @since 1.0.0
 */
export function escapeSqlIdentifier(identifier: string, quoteChar: string = '"'): string {
  // Escape special regex characters in quoteChar to use it safely in RegExp
  const escapedQuoteChar = quoteChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Replace each occurrence of quoteChar with quoteChar + quoteChar (SQL standard)
  // Use a function replacement to avoid issues with special characters in replacement strings
  // (e.g., $ in replacement strings has special meaning: $$ = literal $, $& = matched text, etc.)
  return identifier.replace(new RegExp(escapedQuoteChar, 'g'), () => quoteChar + quoteChar);
}

/**
 * Escapes AND wraps a SQL identifier for safe use as a raw, dialect-quoted
 * identifier — the single place that owns both steps, so callers can never
 * forget to escape (or escape with the wrong dialect's quote character).
 *
 * Prior to plan 007, each Drizzle dialect query-builder wrapped identifiers
 * in its own `quoteIdentifier()` without escaping, and relied on exactly one
 * call site (`base-query-builder.ts`) to pre-escape with the *default*
 * double-quote char — silently wrong for MySQL's backtick-quoted
 * identifiers if any other call site forgot the pre-escape step. Combining
 * the two operations here removes that failure mode structurally: there is
 * no escaped-but-unwrapped or wrapped-but-unescaped intermediate state for
 * a caller to mishandle.
 *
 * @param identifier - The raw SQL identifier to quote (e.g., a column alias)
 * @param quoteChar - The dialect's identifier quote character (`"` for
 *   PostgreSQL/SQLite, `` ` `` for MySQL)
 * @returns The identifier, escaped and wrapped in `quoteChar` on both sides
 *
 * @example
 * ```typescript
 * quoteIdentifier('my_alias', '"')   // '"my_alias"'
 * quoteIdentifier('my"alias', '"')   // '"my""alias"'
 * quoteIdentifier('my`alias', '`')   // '`my``alias`'
 * ```
 */
export function quoteIdentifier(identifier: string, quoteChar: string): string {
  const escaped = escapeSqlIdentifier(identifier, quoteChar);
  return `${quoteChar}${escaped}${quoteChar}`;
}
