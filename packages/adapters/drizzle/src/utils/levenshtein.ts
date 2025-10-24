/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching in error messages
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
