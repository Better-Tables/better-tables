import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResolvedPaths } from '../src/lib/config';
import {
  checkInstalledComponents,
  getComponentStatus,
  getMissingComponents,
  installShadcnComponents,
  isShadcnSetup,
  REQUIRED_SHADCN_COMPONENTS,
  type ShadcnComponent,
} from '../src/lib/shadcn';

// Mock execSync
const execSyncMock = mock(() => {});

mock.module('child_process', () => ({
  execSync: execSyncMock,
}));

describe('shadcn', () => {
  let testDir: string;
  let uiPath: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'better-tables-shadcn-test-'));
    uiPath = join(testDir, 'src', 'components', 'ui');
    await mkdir(uiPath, { recursive: true });
    execSyncMock.mockClear();
  });

  afterEach(async () => {
    if (testDir && existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('REQUIRED_SHADCN_COMPONENTS', () => {
    it('should contain 21 components', () => {
      expect(REQUIRED_SHADCN_COMPONENTS.length).toBe(21);
    });

    it('should include all expected components', () => {
      const expected: ShadcnComponent[] = [
        'alert-dialog',
        'badge',
        'button',
        'calendar',
        'checkbox',
        'command',
        'context-menu',
        'dialog',
        'dropdown-menu',
        'input',
        'label',
        'pagination',
        'popover',
        'radio-group',
        'scroll-area',
        'select',
        'separator',
        'skeleton',
        'switch',
        'table',
        'tooltip',
      ];
      for (const component of expected) {
        expect(REQUIRED_SHADCN_COMPONENTS).toContain(component);
      }
    });
  });

  describe('checkInstalledComponents', () => {
    it('should return empty array when no components are installed', () => {
      const result = checkInstalledComponents(uiPath);
      expect(result).toEqual([]);
    });

    it('should detect installed components', async () => {
      await writeFile(join(uiPath, 'button.tsx'), 'export const Button = () => null;');
      await writeFile(join(uiPath, 'input.tsx'), 'export const Input = () => null;');
      const result = checkInstalledComponents(uiPath);
      expect(result).toContain('button');
      expect(result).toContain('input');
      expect(result.length).toBe(2);
    });

    it('should only detect .tsx files', async () => {
      await writeFile(join(uiPath, 'button.tsx'), 'export const Button = () => null;');
      await writeFile(join(uiPath, 'button.ts'), 'export const Button = () => null;');
      await writeFile(join(uiPath, 'button.jsx'), 'export const Button = () => null;');
      const result = checkInstalledComponents(uiPath);
      expect(result).toContain('button');
      expect(result.length).toBe(1);
    });

    it('should detect all installed components', async () => {
      // Install all components
      for (const component of REQUIRED_SHADCN_COMPONENTS) {
        await writeFile(
          join(uiPath, `${component}.tsx`),
          `export const ${component} = () => null;`
        );
      }
      const result = checkInstalledComponents(uiPath);
      expect(result.length).toBe(REQUIRED_SHADCN_COMPONENTS.length);
      expect(result.sort()).toEqual([...REQUIRED_SHADCN_COMPONENTS].sort());
    });
  });

  describe('getMissingComponents', () => {
    it('should return all components when none are installed', () => {
      const result = getMissingComponents(uiPath);
      expect(result.length).toBe(REQUIRED_SHADCN_COMPONENTS.length);
      expect(result.sort()).toEqual([...REQUIRED_SHADCN_COMPONENTS].sort());
    });

    it('should return only missing components', async () => {
      await writeFile(join(uiPath, 'button.tsx'), 'export const Button = () => null;');
      await writeFile(join(uiPath, 'input.tsx'), 'export const Input = () => null;');
      const result = getMissingComponents(uiPath);
      expect(result).not.toContain('button');
      expect(result).not.toContain('input');
      expect(result.length).toBe(REQUIRED_SHADCN_COMPONENTS.length - 2);
    });

    it('should return empty array when all components are installed', async () => {
      for (const component of REQUIRED_SHADCN_COMPONENTS) {
        await writeFile(
          join(uiPath, `${component}.tsx`),
          `export const ${component} = () => null;`
        );
      }
      const result = getMissingComponents(uiPath);
      expect(result).toEqual([]);
    });
  });

  describe('getComponentStatus', () => {
    it('should return correct status when no components are installed', () => {
      const resolvedPaths: ResolvedPaths = {
        components: join(testDir, 'src', 'components'),
        utils: join(testDir, 'src', 'lib', 'utils'),
        ui: uiPath,
        lib: join(testDir, 'src', 'lib'),
        hooks: join(testDir, 'src', 'hooks'),
      };
      const status = getComponentStatus(resolvedPaths);
      expect(status.installed).toEqual([]);
      expect(status.missing.length).toBe(REQUIRED_SHADCN_COMPONENTS.length);
      expect(status.total).toBe(REQUIRED_SHADCN_COMPONENTS.length);
    });

    it('should return correct status when some components are installed', async () => {
      await writeFile(join(uiPath, 'button.tsx'), 'export const Button = () => null;');
      await writeFile(join(uiPath, 'input.tsx'), 'export const Input = () => null;');
      const resolvedPaths: ResolvedPaths = {
        components: join(testDir, 'src', 'components'),
        utils: join(testDir, 'src', 'lib', 'utils'),
        ui: uiPath,
        lib: join(testDir, 'src', 'lib'),
        hooks: join(testDir, 'src', 'hooks'),
      };
      const status = getComponentStatus(resolvedPaths);
      expect(status.installed.length).toBe(2);
      expect(status.missing.length).toBe(REQUIRED_SHADCN_COMPONENTS.length - 2);
      expect(status.total).toBe(REQUIRED_SHADCN_COMPONENTS.length);
    });

    it('should return correct status when all components are installed', async () => {
      for (const component of REQUIRED_SHADCN_COMPONENTS) {
        await writeFile(
          join(uiPath, `${component}.tsx`),
          `export const ${component} = () => null;`
        );
      }
      const resolvedPaths: ResolvedPaths = {
        components: join(testDir, 'src', 'components'),
        utils: join(testDir, 'src', 'lib', 'utils'),
        ui: uiPath,
        lib: join(testDir, 'src', 'lib'),
        hooks: join(testDir, 'src', 'hooks'),
      };
      const status = getComponentStatus(resolvedPaths);
      expect(status.installed.length).toBe(REQUIRED_SHADCN_COMPONENTS.length);
      expect(status.missing).toEqual([]);
      expect(status.total).toBe(REQUIRED_SHADCN_COMPONENTS.length);
    });
  });

  describe('isShadcnSetup', () => {
    it('should return true when components.json exists', async () => {
      await writeFile(join(testDir, 'components.json'), '{}');
      const result = isShadcnSetup(testDir);
      expect(result).toBe(true);
    });

    it('should return false when components.json does not exist', () => {
      const result = isShadcnSetup(testDir);
      expect(result).toBe(false);
    });
  });

  describe('installShadcnComponents', () => {
    it('should return success when components array is empty', () => {
      const result = installShadcnComponents([], testDir);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('should call execSync with correct command for single component', () => {
      const result = installShadcnComponents(['button'], testDir);
      expect(result.success).toBe(true);
      expect(execSyncMock).toHaveBeenCalledWith(
        'npx shadcn@latest add button --yes',
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
        })
      );
    });

    it('should call execSync with correct command for multiple components', () => {
      const components: ShadcnComponent[] = ['button', 'input', 'table'];
      const result = installShadcnComponents(components, testDir);
      expect(result.success).toBe(true);
      expect(execSyncMock).toHaveBeenCalledWith(
        'npx shadcn@latest add button input table --yes',
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
        })
      );
    });

    it('should return error when execSync throws', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('Command failed');
      });
      const result = installShadcnComponents(['button'], testDir);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });

    it('should handle non-Error exceptions', () => {
      execSyncMock.mockImplementation(() => {
        throw 'String error';
      });
      const result = installShadcnComponents(['button'], testDir);
      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });
});
