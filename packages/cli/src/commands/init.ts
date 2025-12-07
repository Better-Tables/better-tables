import { Command } from 'commander';
import { resolve } from 'path';
import pc from 'picocolors';
import type { RegisteredCommandName } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';
import { getConfig } from '../lib/config';
import { copyAllFiles } from '../lib/file-operations';
import { confirm } from '../lib/prompts';
import { getComponentStatus, installShadcnComponents, isShadcnSetup } from '../lib/shadcn';

/**
 * Options for the init command
 */
interface InitOptions {
  cwd?: string;
  skipShadcn?: boolean;
  yes?: boolean;
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
    console.log(pc.bold('\n🚀 Better Tables Initialization\n'));
    console.log(`Working directory: ${pc.cyan(cwd)}\n`);
    // Step 1: Check for shadcn setup
    if (!isShadcnSetup(cwd)) {
      console.log(pc.red('✗ shadcn/ui is not set up in this project.'));
      console.log(pc.dim('\nPlease run the following command first:'));
      console.log(pc.cyan('  npx shadcn@latest init\n'));
      process.exit(1);
    }
    console.log(pc.green('✓ shadcn/ui configuration found (components.json)\n'));
    // Step 2: Read and resolve configuration
    const configResult = getConfig(cwd);
    if (!configResult) {
      console.log(pc.red('✗ Failed to read components.json'));
      process.exit(1);
    }
    const { config, resolvedPaths, isTypeScript } = configResult;
    console.log(pc.dim('Project configuration:'));
    console.log(pc.dim(`  • TypeScript: ${isTypeScript ? 'Yes' : 'No'}`));
    console.log(pc.dim(`  • Components: ${config.aliases.components}`));
    console.log(pc.dim(`  • Utils: ${config.aliases.utils}`));
    console.log('');
    // Step 3: Check shadcn components
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
            console.log(pc.red(`\n✗ Failed to install shadcn components: ${result.error}`));
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
    // Step 4: Copy Better Tables files
    console.log(pc.bold('Copying Better Tables files...\n'));
    let shouldCopy = true;
    if (!skipPrompts) {
      console.log(pc.dim('The following directories will be created/updated:'));
      console.log(pc.dim(`  • ${resolvedPaths.components}/table/`));
      console.log(pc.dim(`  • ${resolvedPaths.components}/filters/`));
      console.log(pc.dim(`  • ${resolvedPaths.hooks}/`));
      console.log(pc.dim(`  • ${resolvedPaths.lib}/`));
      console.log(pc.dim(`  • ${resolvedPaths.components}/stores/`));
      console.log(pc.dim(`  • ${resolvedPaths.lib}/utils/\n`));
      shouldCopy = await confirm('Proceed with copying files?', true);
    }
    if (!shouldCopy) {
      console.log(pc.yellow('\nAborted.\n'));
      process.exit(0);
    }
    const { results, categories } = await copyAllFiles(config, resolvedPaths, skipPrompts);
    // Summary
    const successful = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(pc.bold('\n📁 Files copied:\n'));
    for (const [category, count] of Object.entries(categories)) {
      console.log(`  • ${category}: ${pc.green(String(count))} files`);
    }
    console.log('');
    if (skipped > 0) {
      console.log(pc.yellow(`  • ${skipped} files skipped (already exist)`));
    }
    if (failed > 0) {
      console.log(pc.red(`  • ${failed} files failed to copy`));
      const failedResults = results.filter((r) => !r.success);
      for (const result of failedResults) {
        console.log(pc.dim(`    - ${result.path}: ${result.error}`));
      }
    }
    // Final message
    console.log(pc.bold(pc.green('\n✓ Better Tables initialized successfully!\n')));
    console.log(pc.dim('Next steps:'));
    console.log(pc.dim('  1. Install peer dependencies:'));
    console.log(
      pc.cyan('     npm install @better-tables/core zustand @dnd-kit/core @dnd-kit/sortable')
    );
    console.log(pc.dim('\n  2. Import and use BetterTable in your components:'));
    console.log(pc.cyan("     import { BetterTable } from '@/components/table/table';"));
    console.log('');
  });
  return command;
}
