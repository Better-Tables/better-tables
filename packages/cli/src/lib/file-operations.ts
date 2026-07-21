import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResolvedPaths, ShadcnConfig } from './config';
import { getAliasPrefix } from './config';
import type { ConflictResolution } from './prompts';
import { resolveFileConflict } from './prompts';

/**
 * File mapping from source to destination
 */
export interface FileMapping {
  sourcePath: string;
  destPath: string;
  category: string;
}

/**
 * Result of copying a file
 */
export interface CopyResult {
  success: boolean;
  skipped: boolean;
  path: string;
  error?: string;
}

let cachedUiSourceRoot: string | null = null;

function findCliPackageRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string };
      if (pkg.name === '@better-tables/cli') {
        return dir;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find @better-tables/cli package root');
    }
    dir = parent;
  }
}

/**
 * The bundled UI source root. In the published package this is
 * `<pkg>/ui-src` (created by scripts/bundle-ui-src.ts at build time);
 * in the monorepo (running the CLI from source, ui-src not yet built)
 * it falls back to the workspace's `packages/ui/src`.
 *
 * @internal Exported for tests only.
 */
export function resolveUiSourceRoot(): string {
  if (cachedUiSourceRoot) {
    return cachedUiSourceRoot;
  }

  const startDir = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = findCliPackageRoot(startDir);
  const bundled = join(pkgRoot, 'ui-src');
  if (existsSync(bundled)) {
    cachedUiSourceRoot = bundled;
    return bundled;
  }
  const workspace = join(pkgRoot, '..', 'ui', 'src');
  if (existsSync(workspace)) {
    cachedUiSourceRoot = workspace;
    return workspace;
  }
  throw new Error(
    'Bundled UI source not found. This @better-tables/cli install is corrupted — reinstall it.'
  );
}

/** @internal Exported for tests only. */
export function resetUiSourceRootCacheForTests(): void {
  cachedUiSourceRoot = null;
}

/** @internal Exported for tests only. */
export async function readUiSourceFile(filePath: string): Promise<string> {
  const fullPath = join(resolveUiSourceRoot(), filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found in bundled UI source: ${filePath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

/**
 * Shape of one UI **module** — a named, independently copyable group of files
 * (plan 059). Every file under `packages/ui/src` belongs to EXACTLY ONE module
 * (`tests/ui-source-manifest.test.ts` enforces the union AND disjointness).
 */
interface UiModuleFiles {
  components?: {
    table?: readonly string[];
    filters?: readonly string[];
  };
  hooks?: readonly string[];
  lib?: readonly string[];
}

/**
 * The UI module manifest. `core` is the default set `init` copies; every other
 * module is opt-in via `better-tables add <module>`.
 *
 * Must mirror `packages/ui/src` exactly (minus the exclusions below) —
 * `tests/ui-source-manifest.test.ts` fails the build on any drift in either
 * direction. Intentionally NOT copied: the package barrel (`index.ts`),
 * `styles/` (a reference theme; consumers own their Tailwind setup), and
 * `components/ui/` (shadcn primitives installed via the shadcn CLI).
 */
const UI_MODULES = {
  /** The always-copied base: the table, filters, hooks, and lib utils. */
  core: {
    components: {
      table: [
        'column-order-drop-indicator.tsx',
        'column-order-list.tsx',
        'column-visibility-toggle.tsx',
        'drop-indicator.tsx',
        'editable-cell.tsx',
        'empty-state.tsx',
        'error-state.tsx',
        'index.ts',
        'sort-order-drop-indicator.tsx',
        'sort-order-list.tsx',
        'table-dnd-provider.tsx',
        'table-header-context-menu.tsx',
        'table-pagination.tsx',
        'table-providers.tsx',
        'table.tsx',
        'virtualized-table.tsx',
      ],
      filters: [
        'active-filters.tsx',
        'faceted-filter-sidebar.tsx',
        'filter-bar.tsx',
        'filter-button.tsx',
        'filter-dropdown.tsx',
        'filter-operator-select.tsx',
        'filter-type-styles.ts',
        'filter-value-input.tsx',
        'include-unknown-control.tsx',
        'index.ts',
        'inputs/boolean-filter-input.tsx',
        'inputs/date-filter-input.tsx',
        'inputs/multi-option-filter-input.tsx',
        'inputs/number-filter-input.tsx',
        'inputs/option-filter-input.tsx',
        'inputs/text-filter-input.tsx',
      ],
    },
    hooks: [
      'index.ts',
      'use-column-options.tsx',
      'use-debounce.ts',
      'use-editable-cells.ts',
      'use-facets.ts',
      'use-filter-validation.ts',
      'use-keyboard-navigation.ts',
      'use-table-data.ts',
      'use-table-store.ts',
      'use-table-url-sync.ts',
      'use-virtualization.ts',
      'use-virtualized-table-data.ts',
    ],
    lib: ['utils.ts'],
  },
  /** Bulk-action toolbar over selected rows — rides `table.tsx`'s slot seam. */
  actions: {
    components: {
      table: ['action-confirmation-dialog.tsx', 'actions-toolbar.tsx'],
    },
  },
} as const satisfies Record<string, UiModuleFiles>;

/** A valid UI module name (`'core' | 'actions' | …`). */
export type UiModuleName = keyof typeof UI_MODULES;

/** Every module name, in declaration order (`core` first). */
export const UI_MODULE_NAMES = Object.keys(UI_MODULES) as UiModuleName[];

/** Opt-in module names (everything except the always-copied `core`). */
export const OPTIONAL_UI_MODULE_NAMES = UI_MODULE_NAMES.filter(
  (name) => name !== 'core'
) as Exclude<UiModuleName, 'core'>[];

/** Type guard: is `name` a real module? */
export function isUiModuleName(name: string): name is UiModuleName {
  return Object.hasOwn(UI_MODULES, name);
}

/** Category label + destination for a copied file, by its source subtree. */
interface FileSlot {
  category: string;
  /** Destination path for `file`, given the resolved paths + components base. */
  dest: (file: string, componentsBasePath: string, resolvedPaths: ResolvedPaths) => string;
}

const FILE_SLOTS = {
  table: {
    category: 'table',
    source: (file: string) => `components/table/${file}`,
    dest: (file, base) => join(base, 'table', file),
  },
  filters: {
    category: 'filters',
    source: (file: string) => `components/filters/${file}`,
    dest: (file, base) => join(base, 'filters', file),
  },
  hooks: {
    category: 'hooks',
    source: (file: string) => `hooks/${file}`,
    dest: (file, _base, paths) => join(paths.hooks, file),
  },
  lib: {
    category: 'lib',
    source: (file: string) => `lib/${file}`,
    dest: (file, _base, paths) => join(paths.lib, file),
  },
} satisfies Record<string, FileSlot & { source: (file: string) => string }>;

/** Yield `[slotKey, file]` for every file in one module. */
function* iterModuleFiles(module: UiModuleFiles): Generator<[keyof typeof FILE_SLOTS, string]> {
  for (const file of module.components?.table ?? []) yield ['table', file];
  for (const file of module.components?.filters ?? []) yield ['filters', file];
  for (const file of module.hooks ?? []) yield ['hooks', file];
  for (const file of module.lib ?? []) yield ['lib', file];
}

/**
 * Source paths (relative to the bundled UI root) of one module's files.
 *
 * @internal Exported for tests.
 */
export function getModuleSourceFilePaths(moduleName: UiModuleName): string[] {
  const paths: string[] = [];
  for (const [slotKey, file] of iterModuleFiles(UI_MODULES[moduleName])) {
    paths.push(FILE_SLOTS[slotKey].source(file));
  }
  return paths;
}

/**
 * Source paths of EVERY module's files (the union). The drift test pins this to
 * the real `packages/ui/src` tree.
 *
 * @internal Exported for tests.
 */
export function getAllUiSourceFilePaths(): string[] {
  return UI_MODULE_NAMES.flatMap((name) => getModuleSourceFilePaths(name));
}

/**
 * Back-compat alias for the full union.
 *
 * @internal Exported for tests only.
 */
export function getUiSourceFilePaths(): string[] {
  return getAllUiSourceFilePaths();
}

/**
 * Generate file mappings for the given modules (in the order provided). Unknown
 * names are ignored here — callers validate first (see the `add`/`init`
 * commands) so a bad name reports instead of silently copying nothing.
 */
export function generateFileMappings(
  resolvedPaths: ResolvedPaths,
  componentsOutputPath: string = 'better-tables-ui',
  moduleNames: readonly UiModuleName[] = UI_MODULE_NAMES
): FileMapping[] {
  const mappings: FileMapping[] = [];
  const componentsBasePath = join(resolvedPaths.components, componentsOutputPath);
  for (const moduleName of moduleNames) {
    const module = UI_MODULES[moduleName];
    if (!module) continue;
    for (const [slotKey, file] of iterModuleFiles(module)) {
      const slot = FILE_SLOTS[slotKey];
      mappings.push({
        sourcePath: slot.source(file),
        destPath: slot.dest(file, componentsBasePath, resolvedPaths),
        category: slot.category,
      });
    }
  }
  return mappings;
}

/**
 * Transform imports in file content to use the user's alias configuration
 */
export function transformImports(
  content: string,
  config: ShadcnConfig,
  destPath: string,
  componentsOutputPath: string = 'better-tables-ui'
): string {
  const aliasPrefix = getAliasPrefix(config);
  let transformed = content;
  // Transform relative imports from source structure to user's structure
  // Original: import { cn } from '../../lib/utils';
  // Target: import { cn } from '@/lib/utils';
  // Map source paths to user alias paths
  // UI components (shadcn) - transform relative imports to alias
  const uiAlias = config.aliases.ui || `${aliasPrefix}components/ui`;
  transformed = transformed.replace(/from ['"]\.\.\/ui\/([^'"]+)['"]/g, `from '${uiAlias}/$1'`);
  transformed = transformed.replace(
    /from ['"]\.\.\/\.\.\/ui\/([^'"]+)['"]/g,
    `from '${uiAlias}/$1'`
  );
  transformed = transformed.replace(
    /from ['"]\.\.\/\.\.\/components\/ui\/([^'"]+)['"]/g,
    `from '${uiAlias}/$1'`
  );
  // Lib/utils
  const libAlias = config.aliases.lib || `${aliasPrefix}lib`;
  transformed = transformed.replace(/from ['"]\.\.\/lib\/([^'"]+)['"]/g, `from '${libAlias}/$1'`);
  transformed = transformed.replace(
    /from ['"]\.\.\/\.\.\/lib\/([^'"]+)['"]/g,
    `from '${libAlias}/$1'`
  );
  // Hooks
  const hooksAlias = config.aliases.hooks || `${aliasPrefix}hooks`;
  transformed = transformed.replace(
    /from ['"]\.\.\/hooks\/([^'"]+)['"]/g,
    `from '${hooksAlias}/$1'`
  );
  transformed = transformed.replace(
    /from ['"]\.\.\/\.\.\/hooks\/([^'"]+)['"]/g,
    `from '${hooksAlias}/$1'`
  );
  // Filters (relative within components) - use componentsOutputPath
  const filtersAlias = `${aliasPrefix}components/${componentsOutputPath}/filters`;
  transformed = transformed.replace(
    /from ['"]\.\.\/filters\/([^'"]+)['"]/g,
    `from '${filtersAlias}/$1'`
  );
  // Table components (relative within components) - keep same-directory imports
  // Only transform if it's not a same-directory import
  const tableAlias = `${aliasPrefix}components/${componentsOutputPath}/table`;
  transformed = transformed.replace(/from ['"]\.\/([^'"]+)['"]/g, (match, p1) => {
    // Keep relative imports within the same directory (no slash in filename)
    if (!p1.includes('/') && (destPath.includes('table') || destPath.includes('filters'))) {
      return match;
    }
    // Transform other relative imports
    if (destPath.includes('table')) {
      return `from '${tableAlias}/${p1}'`;
    }
    if (destPath.includes('filters')) {
      return `from '${filtersAlias}/${p1}'`;
    }
    return match;
  });
  // Fix any double slashes only in import path strings (not in comments or URLs)
  // Match: from '...' or from "..."
  transformed = transformed.replace(
    /from ['"]([^'"]*)\/\/([^'"]*)['"]/g,
    (match, before, after) => {
      // Only fix double slashes in the path part, not in URLs (which contain ://)
      if (before && after && !before.includes('://')) {
        return `from '${before}/${after}'`;
      }
      return match;
    }
  );
  return transformed;
}

/**
 * Copy a single file with import transformation
 */
export async function copyFile(
  mapping: FileMapping,
  config: ShadcnConfig,
  skipPrompts: boolean,
  conflictResolution: ConflictResolution | null,
  componentsOutputPath: string = 'better-tables-ui'
): Promise<{ result: CopyResult; newResolution: ConflictResolution | null }> {
  try {
    // Check if destination file exists
    if (existsSync(mapping.destPath)) {
      if (conflictResolution === 'skip-all') {
        return {
          result: { success: true, skipped: true, path: mapping.destPath },
          newResolution: conflictResolution,
        };
      }
      if (conflictResolution !== 'overwrite-all' && !skipPrompts) {
        const resolution = await resolveFileConflict(mapping.destPath);
        if (resolution === 'skip' || resolution === 'skip-all') {
          return {
            result: { success: true, skipped: true, path: mapping.destPath },
            newResolution: resolution === 'skip-all' ? 'skip-all' : conflictResolution,
          };
        }
        if (resolution === 'overwrite-all') {
          conflictResolution = 'overwrite-all';
        }
      }
    }
    // Ensure destination directory exists
    const destDir = dirname(mapping.destPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    // Read source file from bundled UI source
    const content = await readUiSourceFile(mapping.sourcePath);
    // Transform imports
    const transformed = transformImports(content, config, mapping.destPath, componentsOutputPath);
    // Write to destination
    writeFileSync(mapping.destPath, transformed, 'utf-8');
    return {
      result: { success: true, skipped: false, path: mapping.destPath },
      newResolution: conflictResolution,
    };
  } catch (error) {
    return {
      result: {
        success: false,
        skipped: false,
        path: mapping.destPath,
        error: error instanceof Error ? error.message : String(error),
      },
      newResolution: conflictResolution,
    };
  }
}

/**
 * Copy all Better Tables files to user's project
 */
export async function copyAllFiles(
  config: ShadcnConfig,
  resolvedPaths: ResolvedPaths,
  skipPrompts: boolean,
  componentsOutputPath: string = 'better-tables-ui',
  moduleNames: readonly UiModuleName[] = UI_MODULE_NAMES
): Promise<{ results: CopyResult[]; categories: Record<string, number> }> {
  const mappings = generateFileMappings(resolvedPaths, componentsOutputPath, moduleNames);
  const results: CopyResult[] = [];
  const categories: Record<string, number> = {};
  let conflictResolution: ConflictResolution | null = null;
  for (const mapping of mappings) {
    const { result, newResolution } = await copyFile(
      mapping,
      config,
      skipPrompts,
      conflictResolution,
      componentsOutputPath
    );
    conflictResolution = newResolution;
    results.push(result);
    if (result.success && !result.skipped) {
      categories[mapping.category] = (categories[mapping.category] || 0) + 1;
    }
  }
  return { results, categories };
}
