import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { initCommand } from '../src/commands/init';
import * as configLib from '../src/lib/config';
import type { CopyResult } from '../src/lib/file-operations';
import * as fileOperationsLib from '../src/lib/file-operations';
import * as projectDetectionLib from '../src/lib/project-detection';
import * as promptsLib from '../src/lib/prompts';
import * as shadcnLib from '../src/lib/shadcn';

// This suite spies on the real lib modules (via spyOn + mockRestore) rather
// than using `mock.module()`, because `mock.module()` overrides the process-
// wide module registry for the lifetime of the `bun test` run and would leak
// into config.test.ts/shadcn.test.ts/prompts.test.ts/project-detection.test.ts,
// which import and exercise these same modules unmocked.

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
  { success: true, skipped: false, path: 'a.ts' },
  { success: true, skipped: false, path: 'b.ts' },
  { success: true, skipped: true, path: 'c.ts' },
];

describe('init command', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;
  let spies: ReturnType<typeof spyOn>[];

  function getLoggedOutput(): string {
    return consoleLogSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
  }

  function getErrorOutput(): string {
    return consoleErrorSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
  }

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Happy-path defaults for every lib dependency; individual tests override
    // as needed. All spies are torn down in afterEach so no leakage occurs.
    spies = [
      spyOn(projectDetectionLib, 'detectNextJS').mockImplementation(() => true),
      spyOn(projectDetectionLib, 'detectPackageManager').mockImplementation(() => 'bun'),
      spyOn(projectDetectionLib, 'installPackage').mockImplementation(() => ({ success: true })),
      spyOn(projectDetectionLib, 'isPackageInstalled').mockImplementation(() => true),
      spyOn(configLib, 'getConfig').mockImplementation(() => ({
        config: defaultConfig,
        configPath: '/tmp/project/components.json',
        resolvedPaths: defaultResolvedPaths,
        isTypeScript: true,
      })),
      spyOn(configLib, 'getAliasPrefix').mockImplementation(() => '@/'),
      spyOn(fileOperationsLib, 'copyAllFiles').mockImplementation(() =>
        Promise.resolve({ results: defaultCopyResults, categories: { table: 2 } })
      ),
      spyOn(promptsLib, 'confirm').mockImplementation(() => Promise.resolve(true)),
      spyOn(shadcnLib, 'isShadcnSetup').mockImplementation(() => true),
      spyOn(shadcnLib, 'getComponentStatus').mockImplementation(() => ({
        installed: [],
        missing: [],
        total: 21,
      })),
      spyOn(shadcnLib, 'installShadcnComponents').mockImplementation(() => ({ success: true })),
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

  it('should create an init command', () => {
    const command = initCommand();
    expect(command.name()).toBe('init');
  });

  it('should exit 1 and print an error with remediation for an invalid components path', async () => {
    const command = initCommand();

    try {
      await command.parseAsync(['--yes', '--components-path', '../escape'], { from: 'user' });
    } catch {
      // Expected: process.exit throws in tests
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Invalid components path');
    expect(getErrorOutput().length).toBeGreaterThan(0);
  });

  it('should exit 1 and print remediation when shadcn is not set up', async () => {
    (shadcnLib.isShadcnSetup as ReturnType<typeof spyOn>).mockImplementation(() => false);
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // Expected
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('shadcn/ui is not set up');
    expect(getErrorOutput()).toContain('bunx shadcn@latest init');
  });

  it('should exit 1 and print an error when a required package fails to install', async () => {
    (projectDetectionLib.isPackageInstalled as ReturnType<typeof spyOn>).mockImplementation(
      () => false
    );
    (projectDetectionLib.installPackage as ReturnType<typeof spyOn>).mockImplementation(() => ({
      success: false,
      error: 'network error',
    }));
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // Expected
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Failed to install');
    expect(getErrorOutput()).toContain('network error');
  });

  it('should exit 1 and print remediation when components.json cannot be read', async () => {
    (configLib.getConfig as ReturnType<typeof spyOn>).mockImplementation(() => null);
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // Expected
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Failed to read components.json');
  });

  it('should exit 1 and print an error when shadcn components fail to install', async () => {
    (shadcnLib.getComponentStatus as ReturnType<typeof spyOn>).mockImplementation(() => ({
      installed: [],
      missing: ['button'],
      total: 21,
    }));
    (shadcnLib.installShadcnComponents as ReturnType<typeof spyOn>).mockImplementation(() => ({
      success: false,
      error: 'add failed',
    }));
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // Expected
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Failed to install shadcn components');
    expect(getErrorOutput()).toContain('add failed');
  });

  it('should exit 1 and print an error when copying files throws', async () => {
    (fileOperationsLib.copyAllFiles as ReturnType<typeof spyOn>).mockImplementation(() =>
      Promise.reject(new Error('download failed'))
    );
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // Expected
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Failed to copy files');
    expect(getErrorOutput()).toContain('download failed');
  });

  it('should exit 0 and print an abort message when the user declines to copy files', async () => {
    (promptsLib.confirm as ReturnType<typeof spyOn>).mockImplementation(() =>
      Promise.resolve(false)
    );
    const command = initCommand();

    try {
      await command.parseAsync([], { from: 'user' });
    } catch {
      // Expected
    }

    expect(processExitSpy).toHaveBeenCalledWith(0);
    expect(getLoggedOutput()).toContain('Aborted');
  });

  it('should print a summary containing the copied-file count on success', async () => {
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // Not expected to throw on the success path, but guard just in case
    }

    expect(processExitSpy).not.toHaveBeenCalled();
    const output = getLoggedOutput();
    expect(output).toContain('2 files copied successfully');
    expect(output).toContain('initialized successfully');
  });

  it('copies the core module only by default (excludes opt-in modules)', async () => {
    const command = initCommand();
    await command.parseAsync(['--yes'], { from: 'user' });

    const call = (fileOperationsLib.copyAllFiles as ReturnType<typeof spyOn>).mock.calls[0];
    // 5th arg is the module list.
    expect(call?.[4]).toEqual(['core']);
  });

  it('opts modules in with --modules, always keeping core first', async () => {
    const command = initCommand();
    await command.parseAsync(['--yes', '--modules', 'actions'], { from: 'user' });

    const call = (fileOperationsLib.copyAllFiles as ReturnType<typeof spyOn>).mock.calls[0];
    expect(call?.[4]).toEqual(['core', 'actions']);
  });

  it('lists available opt-in modules in the next-steps output', async () => {
    const command = initCommand();
    await command.parseAsync(['--yes'], { from: 'user' });
    const output = getLoggedOutput();
    expect(output).toContain('better-tables add actions');
  });

  it('exits 1 and lists valid modules when --modules names an unknown module', async () => {
    const command = initCommand();
    try {
      await command.parseAsync(['--yes', '--modules', 'bogus'], { from: 'user' });
    } catch {
      // process.exit throws in tests
    }
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(getErrorOutput()).toContain('Unknown module');
  });

  it('should print failed file details to stderr and exit non-zero when some files fail to copy', async () => {
    (fileOperationsLib.copyAllFiles as ReturnType<typeof spyOn>).mockImplementation(() =>
      Promise.resolve({
        results: [
          { success: true, skipped: false, path: 'a.ts' },
          { success: false, skipped: false, path: 'bad.ts', error: 'permission denied' },
        ] as CopyResult[],
        categories: { table: 1 },
      })
    );
    const command = initCommand();

    try {
      await command.parseAsync(['--yes'], { from: 'user' });
    } catch {
      // process.exit throws in tests
    }

    expect(getErrorOutput()).toContain('1 files failed to copy');
    expect(getErrorOutput()).toContain('permission denied');
    // A genuine copy failure must not report success — exit non-zero.
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('does not exit non-zero when files are only skipped (not failed)', async () => {
    (fileOperationsLib.copyAllFiles as ReturnType<typeof spyOn>).mockImplementation(() =>
      Promise.resolve({
        results: [
          { success: true, skipped: false, path: 'a.ts' },
          { success: true, skipped: true, path: 'b.ts' },
        ] as CopyResult[],
        categories: { table: 1 },
      })
    );
    const command = initCommand();
    await command.parseAsync(['--yes'], { from: 'user' });
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
