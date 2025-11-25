import { describe, expect, it } from 'bun:test';
import { Command } from 'commander';
import { commandsRegistry, type RegisteredCommandName } from '../src/commands';
import { createCommand, registerCommandFactory } from '../src/lib/command-factory';
import { docsCommand } from '../src/commands/docs';
import { helpCommand } from '../src/commands/help';

describe('CLI', () => {
  it('should have correct name and description', () => {
    const program = new Command();

    program
      .name('better-tables')
      .description('Command-line utilities for Better Tables')
      .version('0.1.2');

    expect(program.name()).toBe('better-tables');
    expect(program.description()).toBe('Command-line utilities for Better Tables');
  });

  it('should register all commands from registry', () => {
    // Register all command factories
    registerCommandFactory('help', helpCommand);
    registerCommandFactory('docs', docsCommand);

    const program = new Command();
    const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

    for (const commandName of commandNames) {
      const command = createCommand(commandName);
      program.addCommand(command);
    }

    const registeredCommands = program.commands.map((cmd) => cmd.name());
    expect(registeredCommands.length).toBe(commandNames.length);

    // Check all commands are registered
    for (const commandName of commandNames) {
      expect(registeredCommands).toContain(commandName);
    }
  });

  it('should have all commands from registry accessible', () => {
    registerCommandFactory('help', helpCommand);
    registerCommandFactory('docs', docsCommand);

    const program = new Command();
    const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

    for (const commandName of commandNames) {
      const command = createCommand(commandName);
      program.addCommand(command);
    }

    const registeredCommands = program.commands.map((cmd) => cmd.name());
    const registryCommands = Object.keys(commandsRegistry);

    expect(registeredCommands.length).toBe(registryCommands.length);
    expect(registeredCommands.sort()).toEqual(registryCommands.sort());
  });
});
