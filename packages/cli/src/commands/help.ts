import { Command } from 'commander';
import type { RegisteredCommandName } from '../commands';
import { commandsRegistry } from '../commands';
import { getCommandDefinition } from '../lib/command-factory';

/**
 * Factory function for the 'help' command.
 *
 * This function creates a Command instance that displays all available
 * commands from the registry in a formatted list.
 */
export function helpCommand(): Command {
  const commandName: RegisteredCommandName = 'help';
  const definition = getCommandDefinition(commandName);

  const command = new Command(definition.name);

  command.description(definition.description);

  // Action handler
  command.action(() => {
    // biome-ignore lint: CLI commands require console output
    console.log('Better Tables CLI - Available Commands');
    // biome-ignore lint: CLI commands require console output
    console.log('');
    // biome-ignore lint: CLI commands require console output
    console.log('Usage: better-tables <command> [options]');
    // biome-ignore lint: CLI commands require console output
    console.log('');
    // biome-ignore lint: CLI commands require console output
    console.log('Commands:');
    // biome-ignore lint: CLI commands require console output
    console.log('');

    const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

    for (const cmdName of commandNames) {
      const cmdDef = commandsRegistry[cmdName];
      const argsInfo: string[] = [];

      // Build arguments info
      if (cmdDef.arguments && cmdDef.arguments.length > 0) {
        for (const arg of cmdDef.arguments) {
          const argSyntax = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
          argsInfo.push(argSyntax);
        }
      }

      // Build options info
      const optionsInfo: string[] = [];
      if (cmdDef.options && cmdDef.options.length > 0) {
        const options = cmdDef.options as unknown as Array<{
          flags: string;
          description: string;
          defaultValue?: string | boolean | number;
        }>;
        for (const option of options) {
          optionsInfo.push(option.flags);
        }
      }

      const argsStr = argsInfo.length > 0 ? ` ${argsInfo.join(' ')}` : '';
      const optionsStr = optionsInfo.length > 0 ? ` [${optionsInfo.join(', ')}]` : '';

      // biome-ignore lint: CLI commands require console output
      console.log(`  ${cmdName}${argsStr}${optionsStr}`);
      // biome-ignore lint: CLI commands require console output
      console.log(`    ${cmdDef.description}`);
      // biome-ignore lint: CLI commands require console output
      console.log('');
    }

    // biome-ignore lint: CLI commands require console output
    console.log('For more information on a specific command, run:');
    // biome-ignore lint: CLI commands require console output
    console.log('  better-tables <command> --help');
  });

  return command;
}
