import type { CommandRegistry } from './types/command-registry';

/**
 * Central registry of all available CLI commands.
 *
 * This is the single source of truth for all commands. Every command must be
 * registered here before it can be used. TypeScript ensures type safety:
 * - Command names are literal types
 * - Arguments and options are type-checked
 * - Commands can only be created if they exist in this registry
 */
export const commandsRegistry = {
  help: {
    name: 'help',
    description: 'Display help information and list all available commands',
    arguments: [] as const,
    options: [] as const,
  },
  docs: {
    name: 'docs',
    description: 'Open Better Tables documentation in your browser',
    arguments: [
      {
        name: 'type',
        description: 'Documentation type: main, core, ui, or drizzle',
        required: false,
        defaultValue: 'main',
      },
    ] as const,
    options: [] as const,
  },
} as const satisfies CommandRegistry;

/**
 * Type-safe command name type extracted from the registry
 */
export type RegisteredCommandName = keyof typeof commandsRegistry;

/**
 * Type-safe command definition type
 */
export type RegisteredCommandDef<T extends RegisteredCommandName> = (typeof commandsRegistry)[T];
