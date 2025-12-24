import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

// Create a mock function for open BEFORE importing the command
const openMock = mock(() => Promise.resolve());

// Mock the open module before any imports that use it
mock.module('open', () => ({
  default: openMock,
}));

// Now import after mocking
import { docsCommand } from '../src/commands/docs';

describe('docs command', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Create spies
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Reset mock call count
    openMock.mockClear();
  });

  afterEach(() => {
    // Restore original functions
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should create a docs command', () => {
    const command = docsCommand();
    expect(command.name()).toBe('docs');
    expect(command.description()).toContain('Open Better Tables documentation');
  });

  it('should open main documentation by default', async () => {
    const command = docsCommand();

    try {
      // When calling parseAsync on the command itself, don't include the command name
      await command.parseAsync([], { from: 'user' });
    } catch {
      // Ignore process.exit error
    }

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith('https://github.com/Better-Tables/better-tables#readme');
    expect(consoleLogSpy).toHaveBeenCalledWith('Opening main documentation...');
  });

  it('should open core documentation when type is "core"', async () => {
    const command = docsCommand();

    try {
      await command.parseAsync(['core'], { from: 'user' });
    } catch {
      // Ignore process.exit error
    }

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/Better-Tables/better-tables/tree/main/packages/core#readme'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Opening core documentation...');
  });

  it('should open ui documentation when type is "ui"', async () => {
    const command = docsCommand();

    try {
      await command.parseAsync(['ui'], { from: 'user' });
    } catch {
      // Ignore process.exit error
    }

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/Better-Tables/better-tables/tree/main/packages/ui#readme'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Opening ui documentation...');
  });

  it('should open drizzle documentation when type is "drizzle"', async () => {
    const command = docsCommand();

    try {
      await command.parseAsync(['drizzle'], { from: 'user' });
    } catch {
      // Ignore process.exit error
    }

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/Better-Tables/better-tables/tree/main/packages/adapters/drizzle#readme'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Opening drizzle documentation...');
  });

  it('should handle case-insensitive doc types', async () => {
    const command = docsCommand();

    try {
      await command.parseAsync(['CORE'], { from: 'user' });
    } catch {
      // Ignore process.exit error
    }

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/Better-Tables/better-tables/tree/main/packages/core#readme'
    );
  });

  it('should handle unknown doc types and exit with error', async () => {
    const command = docsCommand();

    try {
      await command.parseAsync(['unknown'], { from: 'user' });
    } catch {
      // Expected - process.exit throws
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Unknown documentation type: unknown');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Available types:'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle errors when opening browser', async () => {
    const command = docsCommand();
    const errorMock = mock(() => Promise.reject(new Error('Failed to open')));

    // Temporarily replace the mock
    const originalMock = openMock.getMockImplementation();
    openMock.mockImplementation(errorMock);

    try {
      try {
        await command.parseAsync([], { from: 'user' });
      } catch {
        // Ignore process.exit error
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open documentation')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    } finally {
      // Restore original mock
      if (originalMock) {
        openMock.mockImplementation(originalMock);
      } else {
        openMock.mockImplementation(() => Promise.resolve());
      }
    }
  });
});
