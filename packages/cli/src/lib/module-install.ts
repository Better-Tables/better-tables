import { normalize } from 'node:path';
import pc from 'picocolors';
import type { CopyResult } from './file-operations';
import {
  isUiModuleName,
  OPTIONAL_UI_MODULE_NAMES,
  UI_MODULE_NAMES,
  type UiModuleName,
} from './file-operations';

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
    console.error(pc.red(`✗ Unknown module(s): ${unknown.join(', ')}`));
    console.error(pc.dim(`  Available modules: ${UI_MODULE_NAMES.join(', ')}`));
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
  const successful = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(pc.bold('\n📁 Files copied:\n'));
  console.log(pc.green(`  • ${successful} files copied successfully`));
  if (Object.keys(categories).length === 0) {
    console.log(pc.yellow('  ⚠️  No files were copied. This may indicate:'));
    console.log(pc.dim('     • UI package source files not found'));
    console.log(pc.dim('     • Path resolution issue'));
    console.log(pc.dim('     • All files already exist\n'));
  } else {
    for (const [category, count] of Object.entries(categories)) {
      console.log(`  • ${category}: ${pc.green(String(count))} files`);
    }
    console.log('');
  }
  if (skipped > 0) {
    console.log(pc.yellow(`  • ${skipped} files skipped (already exist)`));
  }
  if (failed > 0) {
    console.error(pc.red(`  • ${failed} files failed to copy`));
    for (const result of results.filter((r) => !r.success)) {
      console.error(pc.dim(`    - ${result.path}: ${result.error}`));
    }
  }
  return failed === 0;
}

/** Print the "available opt-in modules" block used by `init`'s next-steps. */
export function printAvailableModules(): void {
  if (OPTIONAL_UI_MODULE_NAMES.length === 0) return;
  console.log(pc.dim('\n  Optional modules (add anytime):'));
  for (const name of OPTIONAL_UI_MODULE_NAMES) {
    console.log(
      pc.dim(
        `    • ${name} — ${OPTIONAL_MODULE_DESCRIPTIONS[name]}: ` +
          pc.cyan(`bunx better-tables add ${name}`)
      )
    );
  }
}
