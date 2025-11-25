import type { Command } from 'commander';

/**
 * Definition for a command argument
 */
export type CommandArgument = {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
  defaultValue?: string;
};

/**
 * Definition for a command option/flag
 */
export type CommandOption = {
  flags: string;
  description: string;
  defaultValue?: string | boolean | number;
  required?: boolean;
};

/**
 * Complete command definition structure
 */
export type CommandDefinition = {
  name: string;
  description: string;
  arguments?: readonly CommandArgument[];
  options?: readonly CommandOption[];
  hidden?: boolean;
  isDefault?: boolean;
};

/**
 * Type for a command factory function that creates a Commander Command
 */
export type CommandFactory = () => Command;

/**
 * Registry structure mapping command names to their definitions
 */
export type CommandRegistry = {
  readonly [K in string]: CommandDefinition;
};

/**
 * Extract command names from registry as a union type
 */
export type CommandName<T extends CommandRegistry> = keyof T & string;

/**
 * Extract command definition for a specific command name
 */
export type CommandDef<T extends CommandRegistry, K extends CommandName<T>> = T[K];

/**
 * Type for the commands registry object with factory functions
 */
export type CommandsRegistryWithFactories<T extends CommandRegistry> = {
  readonly [K in CommandName<T>]: {
    definition: T[K];
    factory: CommandFactory;
  };
};
