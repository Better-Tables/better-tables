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
 * Known list of files to copy from the bundled UI source.
 *
 * Must mirror `packages/ui/src` exactly (minus the exclusions below) —
 * `tests/ui-source-manifest.test.ts` fails the build on any drift in either
 * direction. Intentionally NOT copied: the package barrel (`index.ts`),
 * `styles/` (a reference theme; consumers own their Tailwind setup), and
 * `components/ui/` (shadcn primitives installed via the shadcn CLI).
 */
const UI_SOURCE_FILES = {
  components: {
    table: [
      'action-confirmation-dialog.tsx',
      'actions-toolbar.tsx',
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
} as const;

/**
 * Source paths (relative to the bundled UI root) of every file `init` copies.
 *
 * @internal Exported for tests only.
 */
export function getUiSourceFilePaths(): string[] {
  return [
    ...UI_SOURCE_FILES.components.table.map((file) => `components/table/${file}`),
    ...UI_SOURCE_FILES.components.filters.map((file) => `components/filters/${file}`),
    ...UI_SOURCE_FILES.hooks.map((file) => `hooks/${file}`),
    ...UI_SOURCE_FILES.lib.map((file) => `lib/${file}`),
  ];
}

/**
 * Generate file mappings for all Better Tables files
 */
export function generateFileMappings(
  resolvedPaths: ResolvedPaths,
  componentsOutputPath: string = 'better-tables-ui'
): FileMapping[] {
  const mappings: FileMapping[] = [];
  const componentsBasePath = join(resolvedPaths.components, componentsOutputPath);
  // Table components
  for (const file of UI_SOURCE_FILES.components.table) {
    mappings.push({
      sourcePath: `components/table/${file}`,
      destPath: join(componentsBasePath, 'table', file),
      category: 'table',
    });
  }
  // Filter components (including subdirectories like inputs/)
  for (const file of UI_SOURCE_FILES.components.filters) {
    mappings.push({
      sourcePath: `components/filters/${file}`,
      destPath: join(componentsBasePath, 'filters', file),
      category: 'filters',
    });
  }
  // Hooks
  for (const file of UI_SOURCE_FILES.hooks) {
    mappings.push({
      sourcePath: `hooks/${file}`,
      destPath: join(resolvedPaths.hooks, file),
      category: 'hooks',
    });
  }
  // Lib files
  for (const file of UI_SOURCE_FILES.lib) {
    mappings.push({
      sourcePath: `lib/${file}`,
      destPath: join(resolvedPaths.lib, file),
      category: 'lib',
    });
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
  componentsOutputPath: string = 'better-tables-ui'
): Promise<{ results: CopyResult[]; categories: Record<string, number> }> {
  const mappings = generateFileMappings(resolvedPaths, componentsOutputPath);
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
