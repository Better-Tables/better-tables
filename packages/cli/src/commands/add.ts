import { join, resolve } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import type { RegisteredCommandName } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';
import { getAliasPrefix, getConfig } from '../lib/config';
import { type CopyResult, copyAllFiles } from '../lib/file-operations';
import {
  isValidRelativeSubpath,
  printCopySummary,
  resolveModuleNames,
} from '../lib/module-install';
import { confirm } from '../lib/prompts';

interface AddOptions {
  cwd?: string;
  yes?: boolean;
  componentsPath?: string;
}

/**
 * Factory for the `add` command (plan 059): copies one or more opt-in UI
 * modules into an already-initialized project. It reuses `init`'s config
 * resolution and copy machinery but does NOT re-run the shadcn/package checks
 * — those ran at `init`. It copies only the named modules (not `core`).
 */
export function addCommand(): Command {
  const commandName: RegisteredCommandName = 'add';
  const definition = getCommandDefinition(commandName);
  const command = new Command(definition.name);
  command.description(definition.description);

  // Variadic module argument (the shared factory arg-loop doesn't emit
  // variadic syntax, so declare it directly here).
  command.argument('<modules...>', 'One or more module names to copy (e.g. actions)');

  // Options from the registry definition.
  if (definition.options && definition.options.length > 0) {
    const options = definition.options as unknown as Array<{
      flags: string;
      description: string;
      defaultValue?: string | boolean | number;
    }>;
    for (const option of options) {
      command.option(option.flags, option.description, option.defaultValue as string | undefined);
    }
  }

  command.action(async (modules: string[], options: AddOptions) => {
    const cwd = resolve(options.cwd || process.cwd());
    const skipPrompts = options.yes ?? false;
    const componentsPath = options.componentsPath || 'better-tables-ui';

    // Validate the components path (same rule as init).
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

    // Validate module names against the manifest.
    const moduleNames = resolveModuleNames(modules);
    if (!moduleNames) {
      process.exit(1);
    }

    console.log(pc.bold(`\n📦 Adding Better Tables module(s): ${moduleNames.join(', ')}\n`));
    console.log(`Working directory: ${pc.cyan(cwd)}\n`);

    // Resolve project config (shadcn components.json) — same resolution init
    // uses. No shadcn/package re-check: those ran at init.
    const configResult = getConfig(cwd);
    if (!configResult) {
      console.error(pc.red('✗ Failed to read components.json'));
      console.error(
        pc.dim('  Run `bunx better-tables init` first, or check components.json is valid JSON.')
      );
      process.exit(1);
    }
    const { config, resolvedPaths } = configResult;

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
        moduleNames
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
      return;
    }

    const ok = printCopySummary(results, categories);

    console.log(pc.bold(pc.green('\n✓ Module(s) added.\n')));
    const aliasPrefix = getAliasPrefix(config);
    if (moduleNames.includes('actions')) {
      console.log(pc.dim('Wire the actions toolbar into your table via the slot prop:'));
      console.log(
        pc.cyan(
          `  import { ActionsToolbar } from '${aliasPrefix}components/${componentsPath}/table/actions-toolbar';`
        )
      );
      console.log(pc.cyan('  <BetterTable ... slots={{ actionsToolbar: ActionsToolbar }} />'));
      console.log('');
    }
    if (moduleNames.includes('export')) {
      console.log(pc.dim('Wire the export button into your table via the slot prop:'));
      console.log(
        pc.cyan(
          `  import { ExportButton } from '${aliasPrefix}components/${componentsPath}/table/export-button';`
        )
      );
      console.log(pc.cyan('  <BetterTable ... slots={{ toolbarExtra: ExportButton }} />'));
      console.log('');
    }

    if (!ok) {
      process.exit(1);
    }
  });

  return command;
}
