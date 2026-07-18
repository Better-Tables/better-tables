import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared row-id fallback used by both `<BetterTable>` (table.tsx) and
 * `<VirtualizedTable>` when no `rowConfig.getId`/`getRowId` prop is given:
 * tries `id`, `_id`, then `uuid` before falling back to a positional id.
 * The two call sites previously drifted (only `<BetterTable>` had the
 * `uuid` fallback) -- keep this as the ONE implementation so they can't
 * diverge again.
 */
export function defaultGetRowId<T>(row: T, index: number): string {
  if (typeof row === 'object' && row !== null) {
    const obj = row as Record<string, unknown>;
    if ('id' in obj && obj.id != null) return String(obj.id);
    if ('_id' in obj && obj._id != null) return String(obj._id);
    if ('uuid' in obj && obj.uuid != null) return String(obj.uuid);
  }
  return `row-${index}`;
}
