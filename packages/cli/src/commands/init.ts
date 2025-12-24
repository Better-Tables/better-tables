import { join, normalize, resolve } from 'node:path';
import { Command } from 'commander';
import type { RegisteredCommandName } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';
import { getAliasPrefix, getConfig } from '../lib/config';
import { type CopyResult, copyAllFiles } from '../lib/file-operations';
import {
  detectNextJS,
  detectPackageManager,
  installPackage,
  isPackageInstalled,
} from '../lib/project-detection';
import { confirm } from '../lib/prompts';
import { getComponentStatus, installShadcnComponents, isShadcnSetup } from '../lib/shadcn';

/**
 * Options for the init command
 */
interface InitOptions {
  cwd?: string;
  skipShadcn?: boolean;
  yes?: boolean;
  componentsPath?: string;
}

/**
 * Validate that a path is a safe relative subpath (no path traversal)
 *
 * @param path - The path to validate
 * @returns True if the path is safe, false otherwise
 */
function isValidRelativeSubpath(path: string): boolean {
  if (!path || path.length === 0) {
    return false;
  }
  // Check for null bytes
  if (path.includes('\0')) {
    return false;
  }
  // Check for absolute paths (Unix: starts with /, Windows: starts with drive letter)
  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) {
    return false;
  }
  // Normalize the path and check for path traversal sequences
  const normalized = normalize(path);
  // Check for any occurrence of .. (parent directory traversal)
  if (normalized.includes('..')) {
    return false;
  }
  // Check for backslashes on Windows (should use forward slashes for cross-platform compatibility)
  // But we'll allow them since path.join handles them
  // Ensure it's a valid relative path
  return !normalized.startsWith('..') && normalized !== '.';
}

/**
 * Factory function for the 'init' command.
 *
 * This command initializes Better Tables in a project by:
 * 1. Validating shadcn setup (components.json exists)
 * 2. Detecting and batch-installing missing shadcn UI components
 * 3. Copying better-tables files to user's project with import transformations
 */
export function initCommand(): Command {
  const commandName: RegisteredCommandName = 'init';
  const definition = getCommandDefinition(commandName);
  const command = new Command(definition.name);
  command.description(definition.description);
  // Add options from registry definition
  if (definition.options && definition.options.length > 0) {
    const options = definition.options as unknown as Array<{
      flags: string;
      description: string;
      defaultValue?: string | boolean | number;
    }>;
    for (const option of options) {
      const defaultValue =
        option.defaultValue !== undefined
          ? typeof option.defaultValue === 'number'
            ? String(option.defaultValue)
            : option.defaultValue
          : undefined;
      command.option(option.flags, option.description, defaultValue);
    }
  }
  // Action handler
  command.action(async (options: InitOptions) => {
    const cwd = resolve(options.cwd || process.cwd());
    const skipPrompts = options.yes ?? false;
    const componentsPath = options.componentsPath || 'better-tables-ui';
    // Validate componentsPath to prevent path traversal attacks
    if (!isValidRelativeSubpath(componentsPath)) {
      process.exit(1);
    }
    // Step 1: Detect project type
    const isNextJS = detectNextJS(cwd);
    if (isNextJS) {
    } else {
    }
    // Step 2: Check for shadcn setup
    if (!isShadcnSetup(cwd)) {
      process.exit(1);
    }
    // Step 3: Check for required dependencies
    const requiredPackages = ['@better-tables/core', '@better-tables/adapters-drizzle'];
    const missingPackages: string[] = [];
    for (const pkg of requiredPackages) {
      if (!isPackageInstalled(cwd, pkg)) {
        missingPackages.push(pkg);
      }
    }
    if (missingPackages.length > 0) {
      const packageManager = detectPackageManager(cwd);
      let shouldInstall = true;
      if (!skipPrompts) {
        shouldInstall = await confirm(`Install missing packages using ${packageManager}?`, true);
      }
      if (shouldInstall) {
        for (const pkg of missingPackages) {
          const result = installPackage(cwd, pkg);
          if (!result.success) {
            process.exit(1);
          }
        }
      } else {
      }
    } else {
    }
    // Step 4: Read and resolve configuration
    const configResult = getConfig(cwd);
    if (!configResult) {
      process.exit(1);
    }
    const { config, resolvedPaths, isTypeScript } = configResult;
    // Step 5: Check shadcn components
    if (!options.skipShadcn) {
      const componentStatus = getComponentStatus(resolvedPaths);
      if (componentStatus.missing.length > 0) {
        let shouldInstall = true;
        if (!skipPrompts) {
          shouldInstall = await confirm(
            `Install ${componentStatus.missing.length} missing shadcn components?`,
            true
          );
        }
        if (shouldInstall) {
          const result = installShadcnComponents(componentStatus.missing, cwd);
          if (!result.success) {
            process.exit(1);
          }
        } else {
        }
      } else {
      }
    } else {
    }
    const _componentsBasePath = join(resolvedPaths.components, componentsPath);
    let shouldCopy = true;
    if (!skipPrompts) {
      shouldCopy = await confirm('Proceed with copying files?', true);
    }
    if (!shouldCopy) {
      process.exit(0);
    }
    let results: CopyResult[];
    let categories: Record<string, number>;
    try {
      const copyResult = await copyAllFiles(config, resolvedPaths, skipPrompts, componentsPath);
      results = copyResult.results;
      categories = copyResult.categories;
    } catch (_error) {
      process.exit(1);
    }
    // Summary
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
      const failedResults = results.filter((r) => !r.success);
      for (const _result of failedResults) {
      }
    }
    const _aliasPrefix = getAliasPrefix(config);
  });
  return command;
}
