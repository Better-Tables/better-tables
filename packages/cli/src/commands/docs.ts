import { Command } from 'commander';
import open from 'open';
import type { RegisteredCommandName } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';

const DOCS_URLS = {
  main: 'https://github.com/Better-Tables/better-tables#readme',
  core: 'https://github.com/Better-Tables/better-tables/tree/main/packages/core#readme',
  ui: 'https://github.com/Better-Tables/better-tables/tree/main/packages/ui#readme',
  drizzle:
    'https://github.com/Better-Tables/better-tables/tree/main/packages/adapters/drizzle#readme',
} as const;

type DocType = keyof typeof DOCS_URLS;

/**
 * Factory function for the 'docs' command.
 *
 * This function creates a Command instance that matches the definition
 * in commandsRegistry. The command name and structure are type-checked
 * against the registry.
 */
export function docsCommand(): Command {
  const commandName: RegisteredCommandName = 'docs';
  const definition = getCommandDefinition(commandName);

  const command = new Command(definition.name);

  command.description(definition.description);

  // Add arguments from registry definition
  if (definition.arguments) {
    for (const arg of definition.arguments) {
      const argSyntax = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
      command.argument(argSyntax, arg.description, arg.defaultValue);
    }
  }

  // Add options from registry definition
  if (definition.options && definition.options.length > 0) {
    const options = definition.options as unknown as Array<{
      flags: string;
      description: string;
      defaultValue?: string | boolean | number;
    }>;
    for (const option of options) {
      // Commander.js accepts string | boolean | string[] for defaultValue
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
  command.action(async (type: string) => {
    const docType = type.toLowerCase() as DocType;
    const url = DOCS_URLS[docType];

    if (!url) {
      process.exit(1);
    }

    try {
      await open(url);
    } catch (_error) {
      process.exit(1);
    }
  });

  return command;
}
