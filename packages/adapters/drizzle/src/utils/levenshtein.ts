/**
 * @fileoverview Levenshtein distance algorithm for fuzzy string matching
 * @module @better-tables/drizzle-adapter/utils/levenshtein
 *
 * @description
 * Provides utilities for calculating the edit distance between two strings using
 * the Levenshtein distance algorithm. This is used throughout the adapter to provide
 * helpful suggestions in error messages when users mistype column names, table names,
 * or relationship names.
 *
 * The algorithm calculates the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into another.
 */

/**
 * Calculate the Levenshtein distance between two strings.
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string
 * into another. This is implemented using dynamic programming for efficiency.
 *
 * @description
 * Used extensively in error messages throughout the adapter to provide helpful
 * suggestions when users mistype field names, table names, or relationship names.
 * For example, if a user types "user_id" but the actual column is "userId",
 * this algorithm will find them as similar (distance of 1-2).
 *
 * @param {string} str1 - The first string to compare
 * @param {string} str2 - The second string to compare
 * @returns {number} The Levenshtein distance between the two strings (0 means identical)
 *
 * @example
 * ```typescript
 * // Identical strings have distance 0
 * calculateLevenshteinDistance('user', 'user') // 0
 *
 * // Single character difference has distance 1
 * calculateLevenshteinDistance('user', 'users') // 1
 *
 * // Multiple changes required
 * calculateLevenshteinDistance('userId', 'user_id') // 2
 *
 * // Used in error messages to suggest corrections
 * const availableFields = ['email', 'username', 'created_at'];
 * const userInput = 'emailAddress';
 * const suggestions = availableFields.filter(f =>
 *   calculateLevenshteinDistance(f, userInput) <= 2
 * ); // ['email']
 * ```
 *
 * @since 1.0.0
 *
 * @remarks
 * Time complexity: O(n*m) where n and m are the lengths of the strings
 * Space complexity: O(n*m) for the dynamic programming matrix
 *
 * @see {@link https://en.wikipedia.org/wiki/Levenshtein_distance|Levenshtein Distance Algorithm}
 */
export function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(0));

  // biome-ignore lint/style/noNonNullAssertion: false positive
  for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
  // biome-ignore lint/style/noNonNullAssertion: false positive
  for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      // biome-ignore lint/style/noNonNullAssertion: false positive
      matrix[j]![i] = Math.min(
        // biome-ignore lint/style/noNonNullAssertion: false positive
        matrix[j]![i - 1]! + 1, // deletion
        // biome-ignore lint/style/noNonNullAssertion: false positive
        matrix[j - 1]![i]! + 1, // insertion
        // biome-ignore lint/style/noNonNullAssertion: false positive
        matrix[j - 1]![i - 1]! + indicator // substitution
      );
    }
  }

  // biome-ignore lint/style/noNonNullAssertion: false positive
  return matrix[str2.length]![str1.length]!;
}
