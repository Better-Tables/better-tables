/**
 * @fileoverview SQL utility functions for safe SQL generation
 * @module @better-tables/drizzle-adapter/utils/sql-utils
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
 * escapeSqlIdentifier('my-table', '`') // Returns: 'my``table' (for MySQL backticks)
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
  return identifier.replace(new RegExp(escapedQuoteChar, 'g'), quoteChar + quoteChar);
}
