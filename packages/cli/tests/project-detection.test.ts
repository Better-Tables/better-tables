import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  detectNextJS,
  detectPackageManager,
  installPackage,
  isPackageInstalled,
  readPackageJson,
} from '../src/lib/project-detection';

// Mock execFileSync
const execFileSyncMock = mock(() => {});

mock.module('child_process', () => ({
  execFileSync: execFileSyncMock,
}));

describe('project-detection', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'better-tables-project-detection-test-'));
    execFileSyncMock.mockClear();
  });

  afterEach(async () => {
    if (testDir && existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('readPackageJson', () => {
    it('should return null when package.json does not exist', () => {
      const result = readPackageJson(testDir);
      expect(result).toBeNull();
    });

    it('should read and parse valid package.json', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = readPackageJson(testDir);
      expect(result).not.toBeNull();
      expect(result?.dependencies).toEqual(packageJson.dependencies);
      expect(result?.devDependencies).toEqual(packageJson.devDependencies);
    });

    it('should return null when package.json contains invalid JSON', async () => {
      await writeFile(join(testDir, 'package.json'), '{ invalid json }');
      const result = readPackageJson(testDir);
      expect(result).toBeNull();
    });

    it('should handle package.json with only dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = readPackageJson(testDir);
      expect(result?.dependencies).toEqual(packageJson.dependencies);
      expect(result?.devDependencies).toBeUndefined();
    });

    it('should handle package.json with only devDependencies', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = readPackageJson(testDir);
      expect(result?.dependencies).toBeUndefined();
      expect(result?.devDependencies).toEqual(packageJson.devDependencies);
    });

    it('should handle empty package.json', async () => {
      const packageJson = {
        name: 'test-project',
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = readPackageJson(testDir);
      expect(result).not.toBeNull();
      expect(result?.dependencies).toBeUndefined();
      expect(result?.devDependencies).toBeUndefined();
    });
  });

  describe('detectNextJS', () => {
    it('should return true when next.config.js exists', async () => {
      await writeFile(join(testDir, 'next.config.js'), 'module.exports = {};');
      const result = detectNextJS(testDir);
      expect(result).toBe(true);
    });

    it('should return true when next.config.ts exists', async () => {
      await writeFile(join(testDir, 'next.config.ts'), 'export default {};');
      const result = detectNextJS(testDir);
      expect(result).toBe(true);
    });

    it('should return true when next.config.mjs exists', async () => {
      await writeFile(join(testDir, 'next.config.mjs'), 'export default {};');
      const result = detectNextJS(testDir);
      expect(result).toBe(true);
    });

    it('should return true when next is in dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = detectNextJS(testDir);
      expect(result).toBe(true);
    });

    it('should return true when next is in devDependencies', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          next: '^14.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = detectNextJS(testDir);
      expect(result).toBe(true);
    });

    it('should return false when neither config file nor next dependency exists', () => {
      const result = detectNextJS(testDir);
      expect(result).toBe(false);
    });

    it('should return false when package.json exists but next is not in dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = detectNextJS(testDir);
      expect(result).toBe(false);
    });

    it('should prioritize config file over package.json dependency', async () => {
      await writeFile(join(testDir, 'next.config.js'), 'module.exports = {};');
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = detectNextJS(testDir);
      expect(result).toBe(true);
    });
  });

  describe('isPackageInstalled', () => {
    it('should return false when package.json does not exist', () => {
      const result = isPackageInstalled(testDir, 'react');
      expect(result).toBe(false);
    });

    it('should return true when package is in dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = isPackageInstalled(testDir, 'react');
      expect(result).toBe(true);
    });

    it('should return true when package is in devDependencies', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = isPackageInstalled(testDir, 'typescript');
      expect(result).toBe(true);
    });

    it('should return false when package is not in dependencies or devDependencies', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = isPackageInstalled(testDir, 'vue');
      expect(result).toBe(false);
    });

    it('should return false when package.json has no dependencies', async () => {
      const packageJson = {
        name: 'test-project',
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      const result = isPackageInstalled(testDir, 'react');
      expect(result).toBe(false);
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      await writeFile(join(testDir, 'pnpm-lock.yaml'), '');
      const result = detectPackageManager(testDir);
      expect(result).toBe('pnpm');
    });

    it('should detect yarn when yarn.lock exists', async () => {
      await writeFile(join(testDir, 'yarn.lock'), '');
      const result = detectPackageManager(testDir);
      expect(result).toBe('yarn');
    });

    it('should detect bun when bun.lockb exists', async () => {
      await writeFile(join(testDir, 'bun.lockb'), '');
      const result = detectPackageManager(testDir);
      expect(result).toBe('bun');
    });

    it('should detect npm when package-lock.json exists', async () => {
      await writeFile(join(testDir, 'package-lock.json'), '{}');
      const result = detectPackageManager(testDir);
      expect(result).toBe('npm');
    });

    it('should default to npm when no lock files exist', () => {
      const result = detectPackageManager(testDir);
      expect(result).toBe('npm');
    });

    it('should prioritize pnpm over other lock files', async () => {
      await writeFile(join(testDir, 'pnpm-lock.yaml'), '');
      await writeFile(join(testDir, 'yarn.lock'), '');
      await writeFile(join(testDir, 'package-lock.json'), '{}');
      const result = detectPackageManager(testDir);
      expect(result).toBe('pnpm');
    });

    it('should prioritize yarn over npm and bun', async () => {
      await writeFile(join(testDir, 'yarn.lock'), '');
      await writeFile(join(testDir, 'package-lock.json'), '{}');
      await writeFile(join(testDir, 'bun.lockb'), '');
      const result = detectPackageManager(testDir);
      expect(result).toBe('yarn');
    });

    it('should prioritize bun over npm', async () => {
      await writeFile(join(testDir, 'bun.lockb'), '');
      await writeFile(join(testDir, 'package-lock.json'), '{}');
      const result = detectPackageManager(testDir);
      expect(result).toBe('bun');
    });
  });

  describe('installPackage', () => {
    it('should use npx pnpm when pnpm-lock.yaml exists', async () => {
      await writeFile(join(testDir, 'pnpm-lock.yaml'), '');
      execFileSyncMock.mockImplementation(() => {});
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'npx',
        ['-y', 'pnpm', 'add', 'react'],
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
          env: expect.any(Object),
        })
      );
    });

    it('should use npx yarn when yarn.lock exists', async () => {
      await writeFile(join(testDir, 'yarn.lock'), '');
      execFileSyncMock.mockImplementation(() => {});
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'npx',
        ['-y', 'yarn', 'add', 'react'],
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
          env: expect.any(Object),
        })
      );
    });

    it('should use bun when bun.lockb exists', async () => {
      await writeFile(join(testDir, 'bun.lockb'), '');
      execFileSyncMock.mockImplementation(() => {});
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'bun',
        ['add', 'react'],
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
          env: expect.any(Object),
        })
      );
    });

    it('should use npm when package-lock.json exists', async () => {
      await writeFile(join(testDir, 'package-lock.json'), '{}');
      execFileSyncMock.mockImplementation(() => {});
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'npm',
        ['install', 'react'],
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
          env: expect.any(Object),
        })
      );
    });

    it('should default to npm when no lock files exist', () => {
      execFileSyncMock.mockImplementation(() => {});
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'npm',
        ['install', 'react'],
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
          env: expect.any(Object),
        })
      );
    });

    it('should return error when execFileSync throws', () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error('Command failed');
      });
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });

    it('should handle non-Error exceptions', () => {
      execFileSyncMock.mockImplementation(() => {
        throw 'String error';
      });
      const result = installPackage(testDir, 'react');
      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should handle package names with special characters safely', async () => {
      await writeFile(join(testDir, 'package-lock.json'), '{}');
      execFileSyncMock.mockImplementation(() => {});
      // Test that package names with special characters are passed as literal arguments
      const packageName = '@scope/package-name';
      const result = installPackage(testDir, packageName);
      expect(result.success).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'npm',
        ['install', packageName],
        expect.objectContaining({
          cwd: testDir,
          stdio: 'inherit',
          env: expect.any(Object),
        })
      );
    });
  });
});
