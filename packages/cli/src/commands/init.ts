import { join, resolve } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import type { RegisteredCommandName } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';
import { getAliasPrefix, getConfig } from '../lib/config';
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
      console.error(
        pc.red(
          `✗ Invalid components path: "${componentsPath}". Path must be a safe relative subpath without path traversal sequences.`
        )
      );
      console.error(
        pc.dim('  Use a plain relative path instead, e.g. --components-path better-tables-ui')
      );
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
    console.log(pc.bold('\n🚀 Better Tables Initialization\n'));
    console.log(`Working directory: ${pc.cyan(cwd)}\n`);
    // Step 1: Detect project type
    const isNextJS = detectNextJS(cwd);
    if (isNextJS) {
      console.log(pc.green('✓ Next.js project detected\n'));
    } else {
      console.log(pc.yellow('⚠ Warning: Next.js not detected.'));
      console.log(pc.dim('  Better Tables is optimized for Next.js projects.\n'));
    }
    // Step 2: Check for shadcn setup
    if (!isShadcnSetup(cwd)) {
      console.error(pc.red('✗ shadcn/ui is not set up in this project.'));
      console.error(pc.dim('  Run `bunx shadcn@latest init` first, then re-run this command.'));
      process.exit(1);
    }
    console.log(pc.green('✓ shadcn/ui configuration found (components.json)\n'));
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
      console.log(pc.yellow(`\n⚠ Missing required packages: ${missingPackages.join(', ')}\n`));
      const packageManager = detectPackageManager(cwd);
      let shouldInstall = true;
      if (!skipPrompts) {
        shouldInstall = await confirm(`Install missing packages using ${packageManager}?`, true);
      }
      if (shouldInstall) {
        console.log(pc.dim(`\nInstalling packages using ${packageManager}...\n`));
        for (const pkg of missingPackages) {
          const result = installPackage(cwd, pkg);
          if (!result.success) {
            console.error(pc.red(`✗ Failed to install ${pkg}: ${result.error}`));
            console.error(pc.dim(`  Install it manually: ${packageManager} add ${pkg}`));
            process.exit(1);
          }
        }
        console.log(pc.green('\n✓ Required packages installed successfully\n'));
      } else {
        console.log(pc.yellow('\nSkipping package installation.\n'));
        console.log(
          pc.dim('Note: Better Tables may not work correctly without required packages.\n')
        );
      }
    } else {
      console.log(pc.green('✓ All required packages are installed\n'));
    }
    // Step 4: Read and resolve configuration
    const configResult = getConfig(cwd);
    if (!configResult) {
      console.error(pc.red('✗ Failed to read components.json'));
      console.error(
        pc.dim('  Run `bunx shadcn@latest init` to create one, or check it is valid JSON.')
      );
      process.exit(1);
    }
    const { config, resolvedPaths, isTypeScript } = configResult;
    console.log(pc.dim('Project configuration:'));
    console.log(pc.dim(`  • TypeScript: ${isTypeScript ? 'Yes' : 'No'}`));
    console.log(pc.dim(`  • Components: ${config.aliases.components}`));
    console.log(pc.dim(`  • Utils: ${config.aliases.utils}`));
    console.log('');
    // Step 5: Check shadcn components
    if (!options.skipShadcn) {
      const componentStatus = getComponentStatus(resolvedPaths);
      console.log(
        pc.bold(
          `Checking shadcn components (${componentStatus.installed.length}/${componentStatus.total} installed)...`
        )
      );
      if (componentStatus.missing.length > 0) {
        console.log(pc.yellow(`\n${componentStatus.missing.length} components are missing:`));
        console.log(pc.dim(`  ${componentStatus.missing.join(', ')}\n`));
        let shouldInstall = true;
        if (!skipPrompts) {
          shouldInstall = await confirm(
            `Install ${componentStatus.missing.length} missing shadcn components?`,
            true
          );
        }
        if (shouldInstall) {
          console.log(pc.dim('\nInstalling shadcn components...\n'));
          const result = installShadcnComponents(componentStatus.missing, cwd);
          if (!result.success) {
            console.error(pc.red(`✗ Failed to install shadcn components: ${result.error}`));
            console.error(
              pc.dim(
                `  Install them manually: bunx shadcn@latest add ${componentStatus.missing.join(' ')}`
              )
            );
            process.exit(1);
          }
          console.log(pc.green('\n✓ Shadcn components installed successfully\n'));
        } else {
          console.log(pc.yellow('\nSkipping shadcn component installation.\n'));
          console.log(
            pc.dim('Note: Better Tables may not work correctly without all required components.\n')
          );
        }
      } else {
        console.log(pc.green('✓ All required shadcn components are installed\n'));
      }
    } else {
      console.log(pc.yellow('Skipping shadcn component check (--skip-shadcn)\n'));
    }
    // Step 6: Copy Better Tables files
    console.log(pc.bold('Copying Better Tables files...\n'));
    const componentsBasePath = join(resolvedPaths.components, componentsPath);
    let shouldCopy = true;
    if (!skipPrompts) {
      console.log(pc.dim('The following directories will be created/updated:'));
      console.log(pc.dim(`  • ${componentsBasePath}/table/`));
      console.log(pc.dim(`  • ${componentsBasePath}/filters/`));
      console.log(pc.dim(`  • ${resolvedPaths.hooks}/`));
      console.log(pc.dim(`  • ${resolvedPaths.lib}/\n`));
      shouldCopy = await confirm('Proceed with copying files?', true);
    }
    if (!shouldCopy) {
      console.log(pc.yellow('\nAborted. No files were copied.\n'));
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
    } catch (error) {
      console.error(
        pc.red(`✗ Failed to copy files: ${error instanceof Error ? error.message : String(error)}`)
      );
      console.error(
        pc.dim('  The bundled UI source may be corrupted — reinstall @better-tables/cli.')
      );
      process.exit(1);
    }
    // Summary
    printCopySummary(results, categories);
    // Final message
    console.log(pc.bold(pc.green('\n✓ Better Tables initialized successfully!\n')));
    console.log(pc.dim('Next steps:'));
    const aliasPrefix = getAliasPrefix(config);
    console.log(pc.dim('\n  1. Import and use BetterTable in your components:'));
    console.log(
      pc.cyan(
        `     import { BetterTable } from '${aliasPrefix}components/${componentsPath}/table/table';`
      )
    );
    console.log(pc.dim('\n  2. Pick a data source:'));
    console.log(
      pc.dim(
        "     • memoryAdapter from '@better-tables/core' — arrays, no install needed\n" +
          '     • a database adapter, e.g. @better-tables/adapters-drizzle (install separately)'
      )
    );
    // Discoverability: `init` copies `core` only — tell users what modules exist.
    printAvailableModules();
    console.log('');
  });
  return command;
}
