import { describe, expect, it } from 'bun:test';
import { Command } from 'commander';

describe('CLI', () => {
  it('should have correct name and description', async () => {
    // Import and create a new command instance to test
    const { docsCommand } = await import('../src/commands/docs');
    const program = new Command();

    program
      .name('better-tables')
      .description('Command-line utilities for Better Tables')
      .version('0.5.3');

    program.addCommand(docsCommand());

    expect(program.name()).toBe('better-tables');
    expect(program.description()).toBe('Command-line utilities for Better Tables');
  });

  it('should register docs command', async () => {
    const { docsCommand } = await import('../src/commands/docs');
    const program = new Command();

    program.addCommand(docsCommand());

    const commands = program.commands.map((cmd) => cmd.name());
    expect(commands).toContain('docs');
  });
});
