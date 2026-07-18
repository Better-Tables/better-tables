/**
 * Turn an identifier-like string into a human-readable label.
 *
 * Splits on `_` / `-` and camelCase boundaries, capitalizes each word, and
 * joins with spaces: `'multi_word_value'` → `'Multi Word Value'`,
 * `'multiWordValue'` → `'Multi Word Value'`.
 */
export function humanize(value: string): string {
  if (!value) return '';
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return spaced
    .split(' ')
    .map((word) => (word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join(' ');
}
