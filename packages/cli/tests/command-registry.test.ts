import { describe, expect, it } from 'bun:test';
import { commandsRegistry, type RegisteredCommandName } from '../src/commands';
import {
  createCommand,
  getCommandDefinition,
  getCommandFactory,
  registerCommandFactory,
} from '../src/lib/command-factory';
import type { CommandDefinition } from '../src/types/command-registry';

describe('Command Registry Pattern', () => {
  describe('commandsRegistry structure', () => {
    it('should have at least one command registered', () => {
      const commandNames = Object.keys(commandsRegistry);
      expect(commandNames.length).toBeGreaterThan(0);
    });

    it('should have all commands with required fields', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        const command = commandsRegistry[commandName];

        expect(command).toBeDefined();
        expect(command.name).toBe(commandName);
        expect(typeof command.description).toBe('string');
        expect(command.description.length).toBeGreaterThan(0);

        // Check arguments structure if present
        if (command.arguments) {
          expect(Array.isArray(command.arguments)).toBe(true);
          for (const arg of command.arguments) {
            expect(typeof arg.name).toBe('string');
            expect(typeof arg.description).toBe('string');
          }
        }

        // Check options structure if present
        if (command.options) {
          expect(Array.isArray(command.options)).toBe(true);
          const options = command.options as unknown as Array<{
            flags: string;
            description: string;
          }>;
          for (const option of options) {
            expect(typeof option.flags).toBe('string');
            expect(typeof option.description).toBe('string');
          }
        }
      }
    });

    it('should have consistent command names between registry and definition', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        const definition = commandsRegistry[commandName];
        expect(definition.name).toBe(commandName);
      }
    });
  });

  describe('Command Factory Pattern', () => {
    it('should register and retrieve command factories', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        // Create a mock factory
        const mockFactory = () => {
          const { Command } = require('commander');
          const cmd = new Command(commandName);
          cmd.description(commandsRegistry[commandName].description);
          return cmd;
        };

        // Register the factory
        registerCommandFactory(commandName, mockFactory);

        // Retrieve the factory
        const factory = getCommandFactory(commandName);
        expect(factory).toBeDefined();
        expect(typeof factory).toBe('function');

        // Create command using factory
        const command = factory();
        expect(command.name()).toBe(commandName);
      }
    });

    it('should throw error when trying to register non-existent command', () => {
      const invalidCommandName = 'nonexistent-command' as RegisteredCommandName;
      const mockFactory = () => {
        const { Command } = require('commander');
        return new Command('test');
      };

      expect(() => {
        // This should fail at runtime, but TypeScript should prevent it
        registerCommandFactory(invalidCommandName, mockFactory);
      }).toThrow();
    });

    it('should get command definition for registered commands', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        const definition = getCommandDefinition(commandName);
        expect(definition).toBeDefined();
        expect(definition.name).toBe(commandName);
        expect(definition).toEqual(commandsRegistry[commandName]);
      }
    });

    it('should create commands using createCommand helper', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        // Register a factory first
        const mockFactory = () => {
          const { Command } = require('commander');
          const cmd = new Command(commandName);
          cmd.description(commandsRegistry[commandName].description);
          return cmd;
        };

        registerCommandFactory(commandName, mockFactory);

        // Create command using helper
        const command = createCommand(commandName);
        expect(command).toBeDefined();
        expect(command.name()).toBe(commandName);
      }
    });
  });

  describe('Type Safety', () => {
    it('should ensure all command names are valid RegisteredCommandName types', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        // TypeScript should ensure this is valid
        const definition: (typeof commandsRegistry)[typeof commandName] =
          commandsRegistry[commandName];
        expect(definition).toBeDefined();
      }
    });

    it('should ensure command definitions match CommandDefinition type', () => {
      const commandNames = Object.keys(commandsRegistry) as RegisteredCommandName[];

      for (const commandName of commandNames) {
        const definition = commandsRegistry[commandName];
        const typedDefinition: CommandDefinition = definition;
        expect(typedDefinition).toBeDefined();
        expect(typedDefinition.name).toBe(commandName);
      }
    });
  });

  describe('init command options', () => {
    it('should have --components-path option registered', () => {
      const initCommand = commandsRegistry.init;
      expect(initCommand.options).toBeDefined();
      const options = initCommand.options as unknown as Array<{
        flags: string;
        description: string;
      }>;
      const componentsPathOption = options.find((opt) => opt.flags.includes('components-path'));
      expect(componentsPathOption).toBeDefined();
      expect(componentsPathOption?.flags).toBe('--components-path <path>');
      expect(componentsPathOption?.description).toContain('Output path for components');
      expect(componentsPathOption?.description).toContain('default: better-tables-ui');
    });

    it('should have all expected init command options', () => {
      const initCommand = commandsRegistry.init;
      expect(initCommand.options).toBeDefined();
      const options = initCommand.options as unknown as Array<{
        flags: string;
        description: string;
      }>;
      const optionFlags = options.map((opt) => opt.flags);
      expect(optionFlags).toContain('--cwd <path>');
      expect(optionFlags).toContain('--skip-shadcn');
      expect(optionFlags).toContain('-y, --yes');
      expect(optionFlags).toContain('--components-path <path>');
    });

    it('should have --components-path option with correct description format', () => {
      const initCommand = commandsRegistry.init;
      const options = initCommand.options as unknown as Array<{
        flags: string;
        description: string;
      }>;
      const componentsPathOption = options.find((opt) => opt.flags.includes('components-path'));
      expect(componentsPathOption).toBeDefined();
      expect(componentsPathOption?.description).toBe(
        'Output path for components relative to components directory (default: better-tables-ui)'
      );
    });
  });

  describe('init command option parsing integration', () => {
    it('should parse --components-path option correctly when command is created', () => {
      const { Command } = require('commander');
      const initCommand = commandsRegistry.init;
      const command = new Command(initCommand.name);
      command.description(initCommand.description);

      // Add options from registry
      if (initCommand.options && initCommand.options.length > 0) {
        const options = initCommand.options as unknown as Array<{
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

      // Test parsing with custom path
      command.parse(['init', '--components-path', 'custom-path'], { from: 'user' });
      const options = command.opts();
      expect(options.componentsPath).toBe('custom-path');
    });

    it('should handle --components-path option without value (should be undefined, default handled in code)', () => {
      const { Command } = require('commander');
      const initCommand = commandsRegistry.init;
      const command = new Command(initCommand.name);
      command.description(initCommand.description);

      // Add options from registry
      if (initCommand.options && initCommand.options.length > 0) {
        const options = initCommand.options as unknown as Array<{
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

      // Test parsing without the option (default handled in init command code)
      command.parse(['init'], { from: 'user' });
      const options = command.opts();
      // The option won't be set, default is handled in init command action
      expect(options.componentsPath).toBeUndefined();
    });
  });
});
