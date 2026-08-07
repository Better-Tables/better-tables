import { normalize } from 'node:path';
import type { CopyResult } from './file-operations';
import { isUiModuleName, OPTIONAL_UI_MODULE_NAMES, type UiModuleName } from './file-operations';

/**
 * Shared install helpers for the `init` and `add` commands (plan 059). Both
 * validate the same components path, resolve module names against the same
 * manifest, and print the same copy summary — this module is the one place
 * that logic lives so `add` doesn't re-derive init's flow.
 */

/**
 * One-line descriptions for the OPT-IN modules, shown by `init` so users
 * discover them (discoverability is the cost of making modules opt-in).
 */
export const OPTIONAL_MODULE_DESCRIPTIONS: Record<Exclude<UiModuleName, 'core'>, string> = {
  actions: 'bulk-action toolbar over selected rows',
  export: 'export the current view to CSV/JSON',
};

/**
 * Validate that a path is a safe relative subpath (no path traversal).
 *
 * Shared by `init` and `add` so both reject the same unsafe
 * `--components-path` values identically.
 */
export function isValidRelativeSubpath(path: string): boolean {
  if (!path || path.length === 0) {
    return false;
  }
  // Null bytes
  if (path.includes('\0')) {
    return false;
  }
  // Absolute paths (Unix: leading /, Windows: drive letter)
  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) {
    return false;
  }
  const normalized = normalize(path);
  // Parent-directory traversal anywhere
  if (normalized.includes('..')) {
    return false;
  }
  return !normalized.startsWith('..') && normalized !== '.';
}

/**
 * Resolve a list of user-supplied module-name strings to validated
 * {@link UiModuleName}s. On any unknown name, prints the valid names and
 * returns `null` — callers exit non-zero.
 */
export function resolveModuleNames(names: readonly string[]): UiModuleName[] | null {
  const unknown = names.filter((name) => !isUiModuleName(name));
  if (unknown.length > 0) {
    return null;
  }
  // Dedupe while preserving order.
  const seen = new Set<UiModuleName>();
  const resolved: UiModuleName[] = [];
  for (const name of names as UiModuleName[]) {
    if (!seen.has(name)) {
      seen.add(name);
      resolved.push(name);
    }
  }
  return resolved;
}

/**
 * Print the standard copy summary shared by `init` and `add`.
 * Returns `true` when nothing failed.
 */
export function printCopySummary(
  results: CopyResult[],
  categories: Record<string, number>
): boolean {
  const _successful = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;
  if (Object.keys(categories).length === 0) {
  } else {
    for (const [_category, _count] of Object.entries(categories)) {
    }
  }
  if (skipped > 0) {
  }
  if (failed > 0) {
    for (const _result of results.filter((r) => !r.success)) {
    }
  }
  return failed === 0;
}

/** Print the "available opt-in modules" block used by `init`'s next-steps. */
export function printAvailableModules(): void {
  if (OPTIONAL_UI_MODULE_NAMES.length === 0) return;
  for (const _name of OPTIONAL_UI_MODULE_NAMES) {
  }
}
