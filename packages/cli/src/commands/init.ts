import { resolve } from 'node:path';
import { Command } from 'commander';
import type { RegisteredCommandName } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';
import { getConfig } from '../lib/config';
import { type CopyResult, copyAllFiles, type UiModuleName } from '../lib/file-operations';
import {
  isValidRelativeSubpath,
  printAvailableModules,
  printCopySummary,
  resolveModuleNames,
} from '../lib/module-install';
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
  modules?: string[];
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
    // Resolve which modules to copy: `core` always, plus any opted in via
    // `--modules`. An unknown name reports valid names and exits non-zero.
    const optedIn = resolveModuleNames(options.modules ?? []);
    if (!optedIn) {
      process.exit(1);
      return;
    }
    const modulesToCopy: UiModuleName[] = ['core', ...optedIn.filter((name) => name !== 'core')];
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
    //
    // Only what the copied source actually imports: core, plus zustand /
    // @dnd-kit (direct imports in the copied UI, not transitive under pnpm
    // strict installs). Database adapters are deliberately NOT required —
    // nothing in packages/ui imports one, and core ships `memoryAdapter`, so
    // client-only and custom-adapter projects must not inherit
    // @better-tables/adapters-drizzle and its driver peer deps.
    const requiredPackages = [
      '@better-tables/core',
      'zustand',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/modifiers',
      '@dnd-kit/utilities',
    ];
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
    const { config, resolvedPaths } = configResult;
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
    // const _componentsBasePath = join(resolvedPaths.components, componentsPath);
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
      const copyResult = await copyAllFiles(
        config,
        resolvedPaths,
        skipPrompts,
        componentsPath,
        modulesToCopy
      );
      results = copyResult.results;
      categories = copyResult.categories;
    } catch (_error) {
      process.exit(1);
    }
    // Summary
    const copiedOk = printCopySummary(results, categories);
    // const _aliasPrefix = getAliasPrefix(config);
    // Discoverability: `init` copies `core` only — tell users what modules exist.
    printAvailableModules();
    // Genuine copy failures (not skips) must not report success — exit
    // non-zero after showing the summary + failed-file details, like `add`.
    if (!copiedOk) {
      process.exit(1);
    }
  });
  return command;
}
