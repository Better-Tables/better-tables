import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  detectTypeScript,
  findComponentsJson,
  getAliasPrefix,
  getConfig,
  readComponentsJson,
  resolveAliasPath,
  type ShadcnConfig,
} from '../src/lib/config';

describe('config', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'better-tables-test-'));
  });

  afterEach(async () => {
    if (testDir && existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('findComponentsJson', () => {
    it('should find components.json in current directory', async () => {
      const configPath = join(testDir, 'components.json');
      await writeFile(configPath, JSON.stringify({ style: 'default', rsc: false, tsx: true }));
      const result = findComponentsJson(testDir);
      expect(result).toBe(configPath);
    });

    it('should return null when components.json does not exist', () => {
      const result = findComponentsJson(testDir);
      expect(result).toBeNull();
    });
  });

  describe('readComponentsJson', () => {
    it('should read and parse valid components.json', async () => {
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: {
          config: 'tailwind.config.ts',
          baseColor: 'slate',
          cssVariables: true,
          prefix: '',
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
        },
      };
      const configPath = join(testDir, 'components.json');
      await writeFile(configPath, JSON.stringify(config));
      const result = readComponentsJson(configPath);
      expect(result).toEqual(config);
    });
  });

  describe('resolveAliasPath', () => {
    it('should resolve @/ alias to src/ directory', async () => {
      await mkdir(join(testDir, 'src', 'components'), { recursive: true });
      const result = resolveAliasPath('@/components', testDir);
      expect(result).toContain('src');
      expect(result).toContain('components');
    });

    it('should resolve @/ alias to app/ directory if src does not exist', async () => {
      await mkdir(join(testDir, 'app', 'components'), { recursive: true });
      const result = resolveAliasPath('@/components', testDir);
      expect(result).toContain('app');
      expect(result).toContain('components');
    });

    it('should resolve ~/ alias to src/ directory', async () => {
      await mkdir(join(testDir, 'src', 'components'), { recursive: true });
      const result = resolveAliasPath('~/components', testDir);
      expect(result).toContain('src');
      expect(result).toContain('components');
    });

    it('should resolve ~/ alias to app/ directory if src does not exist', async () => {
      await mkdir(join(testDir, 'app', 'components'), { recursive: true });
      const result = resolveAliasPath('~/components', testDir);
      expect(result).toContain('app');
      expect(result).toContain('components');
    });

    it('should resolve relative paths starting with ./', () => {
      const result = resolveAliasPath('./components', testDir);
      expect(result).toBe(resolve(testDir, './components'));
    });

    it('should resolve relative paths starting with ../', () => {
      const result = resolveAliasPath('../components', testDir);
      expect(result).toBe(resolve(testDir, '../components'));
    });

    it('should return absolute paths as-is', () => {
      const absolutePath = '/absolute/path';
      const result = resolveAliasPath(absolutePath, testDir);
      expect(result).toBe(absolutePath);
    });

    it('should resolve paths without prefix relative to cwd', () => {
      const result = resolveAliasPath('components', testDir);
      expect(result).toBe(resolve(testDir, 'components'));
    });

    it('should default to src/ when @/ alias parent does not exist', () => {
      const result = resolveAliasPath('@/components/utils', testDir);
      expect(result).toBe(resolve(testDir, 'src', 'components/utils'));
    });

    it('should default to src/ when ~/ alias parent does not exist', () => {
      const result = resolveAliasPath('~/components/utils', testDir);
      expect(result).toBe(resolve(testDir, 'src', 'components/utils'));
    });
  });

  describe('detectTypeScript', () => {
    it('should return true when tsconfig.json exists', async () => {
      await writeFile(join(testDir, 'tsconfig.json'), '{}');
      const result = detectTypeScript(testDir);
      expect(result).toBe(true);
    });

    it('should return false when tsconfig.json does not exist', () => {
      const result = detectTypeScript(testDir);
      expect(result).toBe(false);
    });
  });

  describe('getAliasPrefix', () => {
    it('should return @/ for @/ alias', () => {
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: { config: '', baseColor: '', cssVariables: true, prefix: '' },
        aliases: { components: '@/components', utils: '@/lib/utils' },
      };
      const result = getAliasPrefix(config);
      expect(result).toBe('@/');
    });

    it('should return ~/ for ~/ alias', () => {
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: { config: '', baseColor: '', cssVariables: true, prefix: '' },
        aliases: { components: '~/components', utils: '~/lib/utils' },
      };
      const result = getAliasPrefix(config);
      expect(result).toBe('~/');
    });

    it('should return ./ for relative alias', () => {
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: { config: '', baseColor: '', cssVariables: true, prefix: '' },
        aliases: { components: './components', utils: './lib/utils' },
      };
      const result = getAliasPrefix(config);
      expect(result).toBe('./');
    });
  });

  describe('getConfig', () => {
    it('should return null when components.json does not exist', () => {
      const result = getConfig(testDir);
      expect(result).toBeNull();
    });

    it('should return config with resolved paths', async () => {
      await mkdir(join(testDir, 'src', 'components'), { recursive: true });
      await writeFile(join(testDir, 'tsconfig.json'), '{}');
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: {
          config: 'tailwind.config.ts',
          baseColor: 'slate',
          cssVariables: true,
          prefix: '',
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
        },
      };
      await writeFile(join(testDir, 'components.json'), JSON.stringify(config));
      const result = getConfig(testDir);
      expect(result).not.toBeNull();
      expect(result?.config).toEqual(config);
      expect(result?.isTypeScript).toBe(true);
      expect(result?.resolvedPaths.components).toContain('components');
      expect(result?.resolvedPaths.utils).toMatch(/lib[\\/]utils/);
    });

    it('should resolve hooks path when hooks alias is provided', async () => {
      await mkdir(join(testDir, 'src', 'hooks'), { recursive: true });
      await writeFile(join(testDir, 'tsconfig.json'), '{}');
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: {
          config: 'tailwind.config.ts',
          baseColor: 'slate',
          cssVariables: true,
          prefix: '',
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
          hooks: '@/hooks',
        },
      };
      await writeFile(join(testDir, 'components.json'), JSON.stringify(config));
      const result = getConfig(testDir);
      expect(result?.resolvedPaths.hooks).toContain('hooks');
    });

    it('should default hooks path when hooks alias is not provided', async () => {
      await mkdir(join(testDir, 'src', 'components'), { recursive: true });
      await writeFile(join(testDir, 'tsconfig.json'), '{}');
      const config: ShadcnConfig = {
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: {
          config: 'tailwind.config.ts',
          baseColor: 'slate',
          cssVariables: true,
          prefix: '',
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
        },
      };
      await writeFile(join(testDir, 'components.json'), JSON.stringify(config));
      const result = getConfig(testDir);
      expect(result?.resolvedPaths.hooks).toBeDefined();
    });
  });
});
