/**
 * @fileoverview Utility for generating unique column aliases
 * @module @better-tables/drizzle-adapter/utils/alias-generator
 *
 * @description
 * Provides utilities for generating unique column aliases that include
 * relationship path information to avoid collisions when the same table
 * is joined through different relationship paths.
 */

import type { RelationshipPath } from '../types';

/**
 * Generate a unique alias for a column from a related table.
 * Includes the relationship path to avoid collisions when the same table
 * is joined through different relationships.
 *
 * @param relationshipPath - The path to the related table (can be empty for primary table columns)
 * @param columnName - The column name
 * @returns A unique alias string
 *
 * @example
 * ```typescript
 * // Single-level relationship
 * generateAlias([{ from: 'users', to: 'profiles', ... }], 'bio')
 * // Returns: 'profiles_bio'
 *
 * // Multiple relationships (avoids collision)
 * generateAlias([{ from: 'posts', to: 'users', ... }], 'name')
 * // Returns: 'posts_users_name'
 *
 * // Complex path
 * generateAlias([
 *   { from: 'users', to: 'posts', ... },
 *   { from: 'posts', to: 'comments', ... }
 * ], 'content')
 * // Returns: 'users_posts_comments_content'
 * ```
 *
 * @since 1.0.0
 */
export function generateAlias(
  relationshipPath: RelationshipPath[] | undefined,
  columnName: string
): string {
  // If no relationship path, it's a primary table column
  if (!relationshipPath || relationshipPath.length === 0) {
    return columnName;
  }

  // Build the path prefix by concatenating table names in the relationship path
  const pathParts: string[] = [];

  // For each relationship in the path, add the destination table
  // This ensures uniqueness even when the same table is reached through different paths
  for (const relationship of relationshipPath) {
    if (relationship.to) {
      pathParts.push(relationship.to);
    }
  }

  // Join all parts with underscores
  const pathPrefix = pathParts.join('_');

  // Return the final alias: pathPrefix_columnName
  return pathPrefix ? `${pathPrefix}_${columnName}` : columnName;
}

/**
 * Generate an alias for a relationship path (used for table aliases in joins).
 * This creates a unique identifier for a specific relationship path to a table.
 *
 * @param relationshipPath - The relationship path to generate an alias for
 * @param fallbackTableName - The table name to use if path is empty
 * @returns A unique path identifier
 *
 * @example
 * ```typescript
 * generatePathAlias([{ from: 'users', to: 'profiles', ... }], 'profiles')
 * // Returns: 'profiles'
 *
 * generatePathAlias([
 *   { from: 'users', to: 'posts', ... },
 *   { from: 'posts', to: 'comments', ... }
 * ], 'comments')
 * // Returns: 'users_posts_comments'
 * ```
 *
 * @since 1.0.0
 */
export function generatePathAlias(
  relationshipPath: RelationshipPath[] | undefined,
  fallbackTableName: string
): string {
  if (!relationshipPath || relationshipPath.length === 0) {
    return fallbackTableName;
  }

  // Build path from all relationships
  const pathParts: string[] = [];
  for (const relationship of relationshipPath) {
    if (relationship.to) {
      pathParts.push(relationship.to);
    }
  }

  return pathParts.length > 0 ? pathParts.join('_') : fallbackTableName;
}

/**
 * Generate a short, unique key for a relationship path.
 * Used for tracking which relationship paths have been processed.
 *
 * @param relationshipPath - The relationship path to generate a key for
 * @returns A unique key string
 *
 * @example
 * ```typescript
 * generatePathKey([{ from: 'users', to: 'profiles', ... }])
 * // Returns: 'users->profiles'
 *
 * generatePathKey([
 *   { from: 'users', to: 'posts', ... },
 *   { from: 'posts', to: 'comments', ... }
 * ])
 * // Returns: 'users->posts->comments'
 * ```
 *
 * @since 1.0.0
 */
export function generatePathKey(relationshipPath: RelationshipPath[]): string {
  return relationshipPath.map((r) => `${r.from}.${r.to}`).join('->');
}
