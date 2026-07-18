import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  readUiSourceFile,
  resetUiSourceRootCacheForTests,
  resolveUiSourceRoot,
} from '../src/lib/file-operations';

const cliPkgRoot = resolve(import.meta.dir, '..');
const bundledRoot = join(cliPkgRoot, 'ui-src');

describe('bundled UI source', () => {
  let bundledBackup: string | null = null;

  beforeEach(() => {
    resetUiSourceRootCacheForTests();
  });

  afterEach(() => {
    resetUiSourceRootCacheForTests();
    if (bundledBackup && existsSync(bundledBackup)) {
      renameSync(bundledBackup, bundledRoot);
      bundledBackup = null;
    }
  });

  function hideBundledRoot(): void {
    if (existsSync(bundledRoot)) {
      bundledBackup = `${bundledRoot}.test-bak`;
      renameSync(bundledRoot, bundledBackup);
    }
  }

  it('prefers ui-src when present', () => {
    if (!existsSync(bundledRoot)) {
      mkdirSync(join(bundledRoot, 'components', 'table'), { recursive: true });
      writeFileSync(join(bundledRoot, 'components', 'table', 'table.tsx'), 'export {};\n');
    }

    const root = resolveUiSourceRoot();
    expect(root).toBe(bundledRoot);
  });

  it('falls back to workspace packages/ui/src when ui-src is absent', () => {
    hideBundledRoot();

    const root = resolveUiSourceRoot();
    expect(root.endsWith('packages/ui/src')).toBe(true);
    expect(existsSync(join(root, 'components', 'table', 'table.tsx'))).toBe(true);
  });

  it('throws when a file is missing from bundled UI source', async () => {
    hideBundledRoot();

    await expect(readUiSourceFile('components/table/does-not-exist.tsx')).rejects.toThrow(
      'File not found in bundled UI source: components/table/does-not-exist.tsx'
    );
  });
});
