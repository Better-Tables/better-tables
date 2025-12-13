import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
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

/**
 * GitHub repository configuration
 */
const GITHUB_REPO = 'Better-Tables/better-tables';
const GITHUB_BRANCH = 'main'; // Could be made configurable or use package version
const GITHUB_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const GITHUB_UI_BASE_URL = `${GITHUB_BASE_URL}/packages/ui/src`;

/**
 * Download a file from GitHub
 */
async function downloadFromGitHub(filePath: string): Promise<string> {
  const url = `${GITHUB_UI_BASE_URL}/${filePath}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to download ${filePath} from GitHub: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Known list of files to copy from the UI package
 * This is a static list to avoid needing to fetch directory listings from GitHub
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
      'filter-bar.tsx',
      'filter-button.tsx',
      'filter-dropdown.tsx',
      'filter-operator-select.tsx',
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
    'use-debounce.ts',
    'use-filter-validation.ts',
    'use-has-primary-touch.tsx',
    'use-keyboard-navigation.ts',
    'use-table-data.ts',
    'use-table-store.ts',
    'use-virtualization.ts',
  ],
  lib: [
    'date-presets.ts',
    'date-utils.ts',
    'filter-value-utils.ts',
    'format-utils.ts',
    'number-format-utils.ts',
    'utils.ts',
  ],
  stores: ['table-registry.ts', 'table-store.ts', 'url-sync-adapter.ts'],
  utils: ['index.ts', 'server-url-params.ts', 'state-change-detection.ts', 'url-serialization.ts'],
} as const;

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
      sourcePath: `components/table/${file}`, // GitHub path, not filesystem path
      destPath: join(componentsBasePath, 'table', file),
      category: 'table',
    });
  }
  // Filter components (including subdirectories like inputs/)
  for (const file of UI_SOURCE_FILES.components.filters) {
    mappings.push({
      sourcePath: `components/filters/${file}`, // GitHub path
      destPath: join(componentsBasePath, 'filters', file),
      category: 'filters',
    });
  }
  // Hooks
  for (const file of UI_SOURCE_FILES.hooks) {
    mappings.push({
      sourcePath: `hooks/${file}`, // GitHub path
      destPath: join(resolvedPaths.hooks, file),
      category: 'hooks',
    });
  }
  // Lib files
  for (const file of UI_SOURCE_FILES.lib) {
    mappings.push({
      sourcePath: `lib/${file}`, // GitHub path
      destPath: join(resolvedPaths.lib, file),
      category: 'lib',
    });
  }
  // Stores
  for (const file of UI_SOURCE_FILES.stores) {
    mappings.push({
      sourcePath: `stores/${file}`, // GitHub path
      destPath: join(componentsBasePath, 'stores', file),
      category: 'stores',
    });
  }
  // Utils
  for (const file of UI_SOURCE_FILES.utils) {
    mappings.push({
      sourcePath: `utils/${file}`, // GitHub path
      destPath: join(resolvedPaths.lib, 'utils', file),
      category: 'utils',
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
  // Stores - use componentsOutputPath
  const storesAlias = `${aliasPrefix}components/${componentsOutputPath}/stores`;
  transformed = transformed.replace(
    /from ['"]\.\.\/stores\/([^'"]+)['"]/g,
    `from '${storesAlias}/$1'`
  );
  transformed = transformed.replace(
    /from ['"]\.\.\/\.\.\/stores\/([^'"]+)['"]/g,
    `from '${storesAlias}/$1'`
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
    // Download source file from GitHub (sourcePath is now a GitHub path, not filesystem)
    const content = await downloadFromGitHub(mapping.sourcePath);
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
