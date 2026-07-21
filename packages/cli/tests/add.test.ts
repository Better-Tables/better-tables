import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { addCommand } from '../src/commands/add';
import * as configLib from '../src/lib/config';
import type { CopyResult } from '../src/lib/file-operations';
import * as fileOperationsLib from '../src/lib/file-operations';
import * as promptsLib from '../src/lib/prompts';

// Same spy-not-mock.module approach as init.test.ts (see its note): spying on
// the real lib modules keeps other suites' unmocked imports intact.

const defaultConfig: configLib.ShadcnConfig = {
  style: 'default',
  rsc: true,
  tsx: true,
  tailwind: { config: 'tailwind.config.ts', baseColor: 'slate', cssVariables: true, prefix: '' },
  aliases: { components: '@/components', utils: '@/lib/utils' },
};

const defaultResolvedPaths: configLib.ResolvedPaths = {
  components: '/tmp/project/src/components',
  utils: '/tmp/project/src/lib/utils',
  ui: '/tmp/project/src/components/ui',
  lib: '/tmp/project/src/lib',
  hooks: '/tmp/project/src/hooks',
};

const defaultCopyResults: CopyResult[] = [
  { success: true, skipped: false, path: 'actions-toolbar.tsx' },
  { success: true, skipped: false, path: 'action-confirmation-dialog.tsx' },
];

describe('add command', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;
  let copyAllFilesSpy: ReturnType<typeof spyOn>;
  let spies: ReturnType<typeof spyOn>[];

  function getErrorOutput(): string {
    return consoleErrorSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
  }

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    copyAllFilesSpy = spyOn(fileOperationsLib, 'copyAllFiles').mockImplementation(() =>
      Promise.resolve({ results: defaultCopyResults, categories: { table: 2 } })
    );
    spies = [
      copyAllFilesSpy,
      spyOn(configLib, 'getConfig').mockImplementation(() => ({
        config: defaultConfig,
        configPath: '/tmp/project/components.json',
        resolvedPaths: defaultResolvedPaths,
        isTypeScript: true,
      })),
      spyOn(configLib, 'getAliasPrefix').mockImplementation(() => '@/'),
      spyOn(promptsLib, 'confirm').mockImplementation(() => Promise.resolve(true)),
    ];
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    for (const spy of spies) {
      spy.mockRestore();
    }
  });

  it('creates an add command', () => {
    expect(addCommand().name()).toBe('add');
  });

  it('copies the requested module(s) via copyAllFiles', async () => {
    const command = addCommand();
    await command.parseAsync(['actions', '--yes'], { from: 'user' });

    expect(copyAllFilesSpy).toHaveBeenCalledTimes(1);
    const call = copyAllFilesSpy.mock.calls[0];
    // 5th arg is the module list; `add` copies only the named modules (not core).
    expect(call?.[4]).toEqual(['actions']);
  });

  it('exits 1 and lists valid modules for an unknown module', async () => {
    const command = addCommand();
    try {
      await command.parseAsync(['bogus', '--yes'], { from: 'user' });
    } catch {
      // process.exit throws in tests
    }
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Unknown module');
    expect(getErrorOutput()).toContain('actions');
    expect(copyAllFilesSpy).not.toHaveBeenCalled();
  });

  it('exits 1 for an invalid components path', async () => {
    const command = addCommand();
    try {
      await command.parseAsync(['actions', '--yes', '--components-path', '../escape'], {
        from: 'user',
      });
    } catch {
      // Expected
    }
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Invalid components path');
  });

  it('exits 1 with remediation when components.json cannot be read', async () => {
    (configLib.getConfig as ReturnType<typeof spyOn>).mockImplementation(() => null);
    const command = addCommand();
    try {
      await command.parseAsync(['actions', '--yes'], { from: 'user' });
    } catch {
      // Expected
    }
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Failed to read components.json');
  });

  it('dedupes repeated module names', async () => {
    const command = addCommand();
    await command.parseAsync(['actions', 'actions', '--yes'], { from: 'user' });
    expect(copyAllFilesSpy.mock.calls[0]?.[4]).toEqual(['actions']);
  });
});
