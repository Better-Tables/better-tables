import type { Command } from 'commander';
import { commandsRegistry, type RegisteredCommandName } from '../commands';
import type { CommandFactory, CommandsRegistryWithFactories } from '../types/command-registry';

/**
 * Type-safe command factory registry.
 *
 * This registry maps command names to their factory functions.
 * Only commands registered in commandsRegistry can be added here.
 */
const commandFactories: CommandsRegistryWithFactories<typeof commandsRegistry> = {
  // Commands are registered here by importing their factories
  // This ensures type safety - only registered commands can be added
} as CommandsRegistryWithFactories<typeof commandsRegistry>;

/**
 * Register a command factory for a specific command name.
 *
 * This function ensures type safety by:
 * - Only accepting command names that exist in the registry
 * - Validating that the factory function is provided
 * - Ensuring the command name matches the registry
 *
 * @param commandName - The name of the command (must exist in commandsRegistry)
 * @param factory - The factory function that creates the Command instance
 */
export function registerCommandFactory<T extends RegisteredCommandName>(
  commandName: T,
  factory: CommandFactory
): void {
  const definition = commandsRegistry[commandName];
  if (!definition) {
    throw new Error(
      `Command "${commandName}" is not registered in commandsRegistry. ` +
        `Add it to src/commands.ts first.`
    );
  }

  (commandFactories as Record<string, { definition: unknown; factory: CommandFactory }>)[
    commandName
  ] = {
    definition,
    factory,
  };
}

/**
 * Get a command factory for a specific command name.
 *
 * @param commandName - The name of the command (must exist in commandsRegistry)
 * @returns The factory function that creates the Command instance
 * @throws Error if the command is not registered
 */
export function getCommandFactory<T extends RegisteredCommandName>(commandName: T): CommandFactory {
  const entry = commandFactories[commandName];
  if (!entry) {
    throw new Error(
      `Command factory for "${commandName}" is not registered. ` +
        `Call registerCommandFactory() first.`
    );
  }
  return entry.factory;
}

/**
 * Get all registered command factories.
 *
 * @returns An object mapping command names to their factory functions
 */
export function getAllCommandFactories(): CommandsRegistryWithFactories<typeof commandsRegistry> {
  return commandFactories;
}

/**
 * Create a Command instance for a specific command name.
 *
 * This is a convenience function that gets the factory and calls it.
 *
 * @param commandName - The name of the command (must exist in commandsRegistry)
 * @returns A Commander Command instance
 * @throws Error if the command is not registered
 */
export function createCommand<T extends RegisteredCommandName>(commandName: T): Command {
  const factory = getCommandFactory(commandName);
  return factory();
}

/**
 * Get the definition for a specific command.
 *
 * @param commandName - The name of the command (must exist in commandsRegistry)
 * @returns The command definition
 */
export function getCommandDefinition<T extends RegisteredCommandName>(
  commandName: T
): (typeof commandsRegistry)[T] {
  return commandsRegistry[commandName];
}
