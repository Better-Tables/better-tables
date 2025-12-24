import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { helpCommand } from '../src/commands/help';

describe('help command', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should create a help command', () => {
    const command = helpCommand();
    expect(command.name()).toBe('help');
    expect(command.description()).toContain('Display help information');
  });

  it('should display all available commands', async () => {
    const command = helpCommand();

    try {
      await command.parseAsync([], { from: 'user' });
    } catch {
      // Ignore any errors
    }

    // Check that console.log was called
    expect(consoleLogSpy).toHaveBeenCalled();

    // Get all log calls
    const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => call[0]);
    const logOutput = logCalls.join('\n');

    // Should contain the help header
    expect(logOutput).toContain('Better Tables CLI - Available Commands');
    expect(logOutput).toContain('Usage: better-tables <command> [options]');
    expect(logOutput).toContain('Commands:');

    // Should list help command
    expect(logOutput).toContain('help');
    expect(logOutput).toContain('Display help information');

    // Should list docs command
    expect(logOutput).toContain('docs');
    expect(logOutput).toContain('Open Better Tables documentation');
  });

  it('should show command syntax with arguments', async () => {
    const command = helpCommand();

    try {
      await command.parseAsync([], { from: 'user' });
    } catch {
      // Ignore any errors
    }

    const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => call[0]);
    const logOutput = logCalls.join('\n');

    // Should show docs command with argument syntax
    expect(logOutput).toContain('docs [type]');
  });

  it('should provide instructions for detailed help', async () => {
    const command = helpCommand();

    try {
      await command.parseAsync([], { from: 'user' });
    } catch {
      // Ignore any errors
    }

    const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => call[0]);
    const logOutput = logCalls.join('\n');

    expect(logOutput).toContain('For more information on a specific command');
    expect(logOutput).toContain('better-tables <command> --help');
  });
});
