import { describe, expect, it } from 'bun:test';
import type { ResolvedPaths } from '../src/lib/config';
import {
  generateFileMappings,
  getAllUiSourceFilePaths,
  getModuleSourceFilePaths,
  isUiModuleName,
  UI_MODULE_NAMES,
} from '../src/lib/file-operations';

/**
 * Plan 059: `init` copies the `core` module by default; `add <module>` copies
 * one opt-in module. These tests pin the module → file mapping so the default
 * set and each opt-in module stay exactly what the docs promise.
 */

const paths: ResolvedPaths = {
  components: '/proj/src/components',
  utils: '/proj/src/lib/utils',
  ui: '/proj/src/components/ui',
  lib: '/proj/src/lib',
  hooks: '/proj/src/hooks',
};

const ACTIONS_FILES = ['actions-toolbar.tsx', 'action-confirmation-dialog.tsx'];

describe('UI module mappings', () => {
  it('the default (core) copy set excludes the actions module files', () => {
    const sources = generateFileMappings(paths, 'better-tables-ui', ['core']).map(
      (m) => m.sourcePath
    );
    for (const file of ACTIONS_FILES) {
      expect(sources).not.toContain(`components/table/${file}`);
    }
    // Sanity: core still copies the table itself.
    expect(sources).toContain('components/table/table.tsx');
  });

  it('add actions copies exactly the two actions files into the table dir', () => {
    const mappings = generateFileMappings(paths, 'better-tables-ui', ['actions']);
    const sources = mappings.map((m) => m.sourcePath).sort();
    expect(sources).toEqual(
      [
        'components/table/action-confirmation-dialog.tsx',
        'components/table/actions-toolbar.tsx',
      ].sort()
    );
    // Destinations land under <components>/<out>/table/.
    for (const m of mappings) {
      expect(m.destPath).toContain('/proj/src/components/better-tables-ui/table/');
      expect(m.category).toBe('table');
    }
  });

  it('every module is disjoint and their union is the full source set', () => {
    const core = new Set(getModuleSourceFilePaths('core'));
    const actions = getModuleSourceFilePaths('actions');
    for (const file of actions) {
      expect(core.has(file)).toBe(false);
    }
    expect(actions.length).toBe(2);

    // The union of every module's files (summed, since modules are disjoint)
    // must equal the total unique source set — so adding a future module
    // without covering it, or double-counting a file, fails here.
    const perModuleTotal = UI_MODULE_NAMES.reduce(
      (sum, name) => sum + getModuleSourceFilePaths(name).length,
      0
    );
    const unionUnique = new Set(getAllUiSourceFilePaths()).size;
    expect(perModuleTotal).toBe(unionUnique);
  });

  it('isUiModuleName recognizes real modules and rejects others', () => {
    expect(isUiModuleName('core')).toBe(true);
    expect(isUiModuleName('actions')).toBe(true);
    expect(isUiModuleName('nope')).toBe(false);
    expect(UI_MODULE_NAMES[0]).toBe('core');
  });

  it('respects a custom components output path', () => {
    const mappings = generateFileMappings(paths, 'custom-ui', ['actions']);
    for (const m of mappings) {
      expect(m.destPath).toContain('/proj/src/components/custom-ui/table/');
    }
  });
});
