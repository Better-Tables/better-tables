import { describe, expect, it } from 'bun:test';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAllUiSourceFilePaths,
  getModuleSourceFilePaths,
  UI_MODULE_NAMES,
} from '../src/lib/file-operations';

/**
 * `UI_MODULES` in src/lib/file-operations.ts is a hand-maintained manifest of
 * the files each UI module copies into a consumer project (plan 059). This
 * suite pins it to the real `packages/ui/src` tree so a UI refactor (file
 * added, moved, or deleted) fails here instead of shipping an `init`/`add` that
 * copies a broken component set. It enforces TWO invariants:
 *
 *   1. Union of all modules === the real copyable tree (both directions).
 *   2. Modules are pairwise disjoint — every file belongs to exactly one.
 */

// The workspace UI source is the source of truth. The bundled `ui-src`
// snapshot is a build artifact of it (scripts/bundle-ui-src.ts) and may be
// stale locally, so we deliberately do not compare against it here.
const uiSrcRoot = join(fileURLToPath(import.meta.url), '..', '..', '..', 'ui', 'src');

/**
 * Files under packages/ui/src that `init` intentionally does NOT copy.
 * Keep in sync with the exclusion note on `UI_MODULES`.
 */
const INTENTIONALLY_NOT_COPIED = [
  // Package barrel for the (private) workspace package build — consumers
  // import from the copied category barrels instead.
  'index.ts',
  // Reference theme; consumers own their Tailwind/shadcn token setup.
  'styles/',
  // shadcn primitives — installed into the consumer app by the shadcn CLI
  // during `init`, not copied from here.
  'components/ui/',
] as const;

function isExcluded(relPath: string): boolean {
  return INTENTIONALLY_NOT_COPIED.some((entry) =>
    entry.endsWith('/') ? relPath.startsWith(entry) : relPath === entry
  );
}

function walkFiles(dir: string, root: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walkFiles(fullPath, root, acc);
    } else {
      // Normalize to forward slashes so the manifest paths match on Windows.
      acc.push(relative(root, fullPath).split(sep).join('/'));
    }
  }
  return acc;
}

describe('UI source manifest', () => {
  const manifestPaths = getAllUiSourceFilePaths();
  const actualPaths = walkFiles(uiSrcRoot, uiSrcRoot).filter(
    (path) => !path.includes('.test.') && !isExcluded(path)
  );

  it('lists only files that exist in packages/ui/src', () => {
    const missing = manifestPaths.filter((path) => !actualPaths.includes(path));
    expect(missing).toEqual([]);
  });

  it('covers every copyable file in packages/ui/src', () => {
    const uncovered = actualPaths.filter((path) => !manifestPaths.includes(path));
    expect(uncovered).toEqual([]);
  });

  it('has no duplicate entries across the union', () => {
    expect(new Set(manifestPaths).size).toBe(manifestPaths.length);
  });

  it('assigns every file to exactly one module (pairwise disjoint)', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const moduleName of UI_MODULE_NAMES) {
      for (const path of getModuleSourceFilePaths(moduleName)) {
        const owner = seen.get(path);
        if (owner) {
          collisions.push(`${path} in both "${owner}" and "${moduleName}"`);
        } else {
          seen.set(path, moduleName);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('has a non-empty core module', () => {
    expect(UI_MODULE_NAMES).toContain('core');
    expect(getModuleSourceFilePaths('core').length).toBeGreaterThan(0);
  });
});
