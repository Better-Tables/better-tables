import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Shadcn components.json configuration structure
 */
export interface ShadcnConfig {
  $schema?: string;
  style: string;
  rsc: boolean;
  tsx: boolean;
  tailwind: {
    config: string;
    baseColor: string;
    cssVariables: boolean;
    prefix: string;
  };
  aliases: {
    components: string;
    utils: string;
    ui?: string;
    lib?: string;
    hooks?: string;
  };
}

/**
 * Resolved paths from the config
 */
export interface ResolvedPaths {
  components: string;
  utils: string;
  ui: string;
  lib: string;
  hooks: string;
}

/**
 * Result of reading the config
 */
export interface ConfigResult {
  config: ShadcnConfig;
  configPath: string;
  resolvedPaths: ResolvedPaths;
  isTypeScript: boolean;
}

/**
 * Find the components.json file starting from the given directory
 */
export function findComponentsJson(cwd: string): string | null {
  const configPath = join(cwd, 'components.json');
  if (existsSync(configPath)) {
    return configPath;
  }
  return null;
}

/**
 * Read and parse the components.json file
 */
export function readComponentsJson(configPath: string): ShadcnConfig {
  const content = readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as ShadcnConfig;
}

/**
 * Resolve an alias path to an actual filesystem path
 */
export function resolveAliasPath(aliasPath: string, cwd: string): string {
  // Handle @/ alias - typically maps to src/ or app/
  if (aliasPath.startsWith('@/')) {
    const relativePath = aliasPath.slice(2);
    const possibleBases = ['src', 'app', '.'];
    for (const base of possibleBases) {
      const basePath = resolve(cwd, base);
      if (existsSync(basePath)) {
        const fullPath = resolve(cwd, base, relativePath);
        const parentDir = dirname(fullPath);
        if (existsSync(parentDir)) {
          return fullPath;
        }
      }
    }
    // Default to src if none of the bases exist
    return resolve(cwd, 'src', relativePath);
  }
  // Handle ~/ alias - typically maps to src/ or app/ (same as @/)
  if (aliasPath.startsWith('~/')) {
    const relativePath = aliasPath.slice(2);
    const possibleBases = ['src', 'app', '.'];
    for (const base of possibleBases) {
      const basePath = resolve(cwd, base);
      if (existsSync(basePath)) {
        const fullPath = resolve(cwd, base, relativePath);
        const parentDir = dirname(fullPath);
        if (existsSync(parentDir)) {
          return fullPath;
        }
      }
    }
    // Default to src if none of the bases exist
    return resolve(cwd, 'src', relativePath);
  }
  if (aliasPath.startsWith('./') || aliasPath.startsWith('../')) {
    return resolve(cwd, aliasPath);
  }
  if (aliasPath.startsWith('/')) {
    return aliasPath;
  }
  return resolve(cwd, aliasPath);
}

/**
 * Detect if the project uses TypeScript
 */
export function detectTypeScript(cwd: string): boolean {
  const tsconfigPath = join(cwd, 'tsconfig.json');
  return existsSync(tsconfigPath);
}

/**
 * Get the file extension based on project configuration
 */
export function getFileExtension(config: ShadcnConfig, isTypeScript: boolean): string {
  if (config.tsx) {
    return isTypeScript ? '.tsx' : '.jsx';
  }
  return isTypeScript ? '.ts' : '.js';
}

/**
 * Read and resolve the full configuration
 */
export function getConfig(cwd: string): ConfigResult | null {
  const configPath = findComponentsJson(cwd);
  if (!configPath) {
    return null;
  }
  const config = readComponentsJson(configPath);
  const isTypeScript = detectTypeScript(cwd);
  const componentsPath = resolveAliasPath(config.aliases.components, cwd);
  const utilsPath = resolveAliasPath(config.aliases.utils, cwd);
  const libPath = dirname(utilsPath);
  const uiPath = config.aliases.ui
    ? resolveAliasPath(config.aliases.ui, cwd)
    : join(componentsPath, 'ui');
  const hooksPath = config.aliases.hooks
    ? resolveAliasPath(config.aliases.hooks, cwd)
    : join(dirname(componentsPath), 'hooks');
  return {
    config,
    configPath,
    resolvedPaths: {
      components: componentsPath,
      utils: utilsPath,
      ui: uiPath,
      lib: libPath,
      hooks: hooksPath,
    },
    isTypeScript,
  };
}

/**
 * Get the import alias prefix from config
 */
export function getAliasPrefix(config: ShadcnConfig): string {
  const componentsAlias = config.aliases.components;
  if (componentsAlias.startsWith('@/')) {
    return '@/';
  }
  if (componentsAlias.startsWith('~/')) {
    return '~/';
  }
  return './';
}
