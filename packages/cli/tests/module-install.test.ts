import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { CopyResult } from '../src/lib/file-operations';
import {
  isValidRelativeSubpath,
  printCopySummary,
  resolveModuleNames,
} from '../src/lib/module-install';

/**
 * Direct coverage for the shared `init`/`add` helpers so regressions in path
 * validation, module resolution, and summary reporting are caught here rather
 * than only through the full command flows.
 */

describe('isValidRelativeSubpath', () => {
  it('accepts plain relative subpaths', () => {
    expect(isValidRelativeSubpath('better-tables-ui')).toBe(true);
    expect(isValidRelativeSubpath('ui/nested')).toBe(true);
  });

  it('rejects empty, absolute, traversal, and null-byte paths', () => {
    expect(isValidRelativeSubpath('')).toBe(false);
    expect(isValidRelativeSubpath('/abs')).toBe(false);
    expect(isValidRelativeSubpath('C:\\abs')).toBe(false);
    expect(isValidRelativeSubpath('../escape')).toBe(false);
    expect(isValidRelativeSubpath('ui/../../escape')).toBe(false);
    expect(isValidRelativeSubpath('.')).toBe(false);
    expect(isValidRelativeSubpath('ui\0hidden')).toBe(false);
  });
});

describe('resolveModuleNames', () => {
  let errorSpy: ReturnType<typeof spyOn>;
  beforeEach(() => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('resolves known names, preserving order', () => {
    expect(resolveModuleNames(['actions'])).toEqual(['actions']);
    expect(resolveModuleNames(['core', 'actions'])).toEqual(['core', 'actions']);
  });

  it('dedupes repeated names', () => {
    expect(resolveModuleNames(['actions', 'actions', 'core', 'actions'])).toEqual([
      'actions',
      'core',
    ]);
  });

  it('returns an empty list for no names', () => {
    expect(resolveModuleNames([])).toEqual([]);
  });

  it('returns null and lists valid modules for an unknown name', () => {
    expect(resolveModuleNames(['bogus'])).toBeNull();
    const output = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).toContain('Unknown module');
    expect(output).toContain('bogus');
    expect(output).toContain('actions');
  });
});

describe('printCopySummary', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('returns true and reports the count when nothing failed', () => {
    const results: CopyResult[] = [
      { success: true, skipped: false, path: 'a.ts' },
      { success: true, skipped: true, path: 'b.ts' },
    ];
    const ok = printCopySummary(results, { table: 1 });
    expect(ok).toBe(true);
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).toContain('1 files copied successfully');
    expect(output).toContain('1 files skipped');
  });

  it('returns false and prints failed-file details when a copy fails', () => {
    const results: CopyResult[] = [
      { success: true, skipped: false, path: 'a.ts' },
      { success: false, skipped: false, path: 'bad.ts', error: 'permission denied' },
    ];
    const ok = printCopySummary(results, { table: 1 });
    expect(ok).toBe(false);
    const errors = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(errors).toContain('1 files failed to copy');
    expect(errors).toContain('permission denied');
  });
});
