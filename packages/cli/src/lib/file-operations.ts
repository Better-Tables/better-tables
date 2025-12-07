import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
 * Get the path to the @better-tables/ui package source files
 * This resolves the path at runtime from the node_modules
 */
export function getUiPackagePath(): string {
  try {
    // Try to resolve from node_modules using createRequire for ESM compatibility
    const require = createRequire(import.meta.url);
    const uiPackagePath = require.resolve('@better-tables/ui/package.json');
    return dirname(uiPackagePath);
  } catch {
    // Fallback: resolve relative to this CLI package
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Go up from dist/lib to packages/cli, then to packages/ui
    // In development: src/lib -> packages/cli -> packages/ui
    // In built: dist/lib -> packages/cli -> packages/ui
    const possiblePaths = [
      join(__dirname, '..', '..', '..', 'ui'), // dist/lib -> packages/cli -> packages/ui
      join(__dirname, '..', '..', '..', '..', 'ui'), // src/lib -> packages/cli -> packages/ui
    ];
    for (const path of possiblePaths) {
      if (existsSync(join(path, 'src'))) {
        return path;
      }
    }
    // Last resort: assume we're in dist/lib
    return join(__dirname, '..', '..', '..', 'ui');
  }
}

/**
 * Get source files from the UI package
 */
export function getSourceFiles(): {
  components: { table: string[]; filters: string[] };
  hooks: string[];
  lib: string[];
  stores: string[];
  utils: string[];
} {
  const uiPath = getUiPackagePath();
  const srcPath = join(uiPath, 'src');
  const readDir = (dir: string): string[] => {
    const fullPath = join(srcPath, dir);
    if (!existsSync(fullPath)) return [];
    return readdirSync(fullPath).filter((file) => {
      const filePath = join(fullPath, file);
      return statSync(filePath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'));
    });
  };
  const readDirRecursive = (dir: string): string[] => {
    const fullPath = join(srcPath, dir);
    if (!existsSync(fullPath)) return [];
    const files: string[] = [];
    const entries = readdirSync(fullPath);
    for (const entry of entries) {
      const entryPath = join(fullPath, entry);
      if (statSync(entryPath).isDirectory()) {
        // Skip __tests__ directories
        if (entry === '__tests__') continue;
        const subFiles = readDirRecursive(join(dir, entry));
        files.push(...subFiles);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(join(dir, entry).replace(/\\/g, '/'));
      }
    }
    return files;
  };
  return {
    components: {
      table: readDir('components/table'),
      filters: readDirRecursive('components/filters').map((f) =>
        f.replace('components/filters/', '')
      ),
    },
    hooks: readDir('hooks'),
    lib: readDir('lib').filter((f) => !f.includes('.test.')),
    stores: readDir('stores'),
    utils: readDir('utils').filter((f) => !f.includes('.test.')),
  };
}

/**
 * Generate file mappings for all Better Tables files
 */
export function generateFileMappings(resolvedPaths: ResolvedPaths): FileMapping[] {
  const uiPath = getUiPackagePath();
  const srcPath = join(uiPath, 'src');
  const sourceFiles = getSourceFiles();
  const mappings: FileMapping[] = [];
  // Table components
  for (const file of sourceFiles.components.table) {
    mappings.push({
      sourcePath: join(srcPath, 'components', 'table', file),
      destPath: join(resolvedPaths.components, 'table', file),
      category: 'table',
    });
  }
  // Filter components (including subdirectories like inputs/)
  for (const file of sourceFiles.components.filters) {
    mappings.push({
      sourcePath: join(srcPath, 'components', 'filters', file),
      destPath: join(resolvedPaths.components, 'filters', file),
      category: 'filters',
    });
  }
  // Hooks
  for (const file of sourceFiles.hooks) {
    mappings.push({
      sourcePath: join(srcPath, 'hooks', file),
      destPath: join(resolvedPaths.hooks, file),
      category: 'hooks',
    });
  }
  // Lib files
  for (const file of sourceFiles.lib) {
    mappings.push({
      sourcePath: join(srcPath, 'lib', file),
      destPath: join(resolvedPaths.lib, file),
      category: 'lib',
    });
  }
  // Stores
  for (const file of sourceFiles.stores) {
    mappings.push({
      sourcePath: join(srcPath, 'stores', file),
      destPath: join(resolvedPaths.components, 'stores', file),
      category: 'stores',
    });
  }
  // Utils
  for (const file of sourceFiles.utils) {
    mappings.push({
      sourcePath: join(srcPath, 'utils', file),
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
  resolvedPaths: ResolvedPaths,
  destPath: string
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
  // Stores
  const storesAlias = `${aliasPrefix}components/stores`;
  transformed = transformed.replace(
    /from ['"]\.\.\/stores\/([^'"]+)['"]/g,
    `from '${storesAlias}/$1'`
  );
  transformed = transformed.replace(
    /from ['"]\.\.\/\.\.\/stores\/([^'"]+)['"]/g,
    `from '${storesAlias}/$1'`
  );
  // Filters (relative within components)
  const filtersAlias = `${aliasPrefix}components/filters`;
  transformed = transformed.replace(
    /from ['"]\.\.\/filters\/([^'"]+)['"]/g,
    `from '${filtersAlias}/$1'`
  );
  // Table components (relative within components) - keep same-directory imports
  // Only transform if it's not a same-directory import
  transformed = transformed.replace(/from ['"]\.\/([^'"]+)['"]/g, (match, p1) => {
    // Keep relative imports within the same directory (no slash in filename)
    if (!p1.includes('/') && (destPath.includes('table') || destPath.includes('filters'))) {
      return match;
    }
    // Transform other relative imports
    if (destPath.includes('table')) {
      return `from '${aliasPrefix}components/table/${p1}'`;
    }
    if (destPath.includes('filters')) {
      return `from '${filtersAlias}/${p1}'`;
    }
    return match;
  });
  // Fix any double slashes
  transformed = transformed.replace(/\/\//g, '/');
  return transformed;
}

/**
 * Copy a single file with import transformation
 */
export async function copyFile(
  mapping: FileMapping,
  config: ShadcnConfig,
  resolvedPaths: ResolvedPaths,
  skipPrompts: boolean,
  conflictResolution: ConflictResolution | null
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
    // Read source file
    const content = readFileSync(mapping.sourcePath, 'utf-8');
    // Transform imports
    const transformed = transformImports(content, config, resolvedPaths, mapping.destPath);
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
  skipPrompts: boolean
): Promise<{ results: CopyResult[]; categories: Record<string, number> }> {
  const mappings = generateFileMappings(resolvedPaths);
  const results: CopyResult[] = [];
  const categories: Record<string, number> = {};
  let conflictResolution: ConflictResolution | null = null;
  for (const mapping of mappings) {
    const { result, newResolution } = await copyFile(
      mapping,
      config,
      resolvedPaths,
      skipPrompts,
      conflictResolution
    );
    conflictResolution = newResolution;
    results.push(result);
    if (result.success && !result.skipped) {
      categories[mapping.category] = (categories[mapping.category] || 0) + 1;
    }
  }
  return { results, categories };
}
