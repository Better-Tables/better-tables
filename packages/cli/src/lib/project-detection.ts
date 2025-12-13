import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Package manager detection result
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Package.json structure
 */
export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detect if the project is a Next.js project
 * Checks for both config file and package.json dependency
 */
export function detectNextJS(cwd: string): boolean {
  // Check for Next.js config files
  const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
  for (const configFile of configFiles) {
    if (existsSync(join(cwd, configFile))) {
      return true;
    }
  }
  // Check package.json for next dependency
  const packageJson = readPackageJson(cwd);
  if (packageJson) {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    return 'next' in allDeps;
  }
  return false;
}

/**
 * Read and parse package.json file
 */
export function readPackageJson(cwd: string): PackageJson | null {
  const packageJsonPath = join(cwd, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Check if a package is installed in the project
 */
export function isPackageInstalled(cwd: string, packageName: string): boolean {
  const packageJson = readPackageJson(cwd);
  if (!packageJson) {
    return false;
  }
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return packageName in allDeps;
}

/**
 * Detect which package manager is being used
 * Checks for lock files in order: pnpm-lock.yaml, yarn.lock, package-lock.json, bun.lockb
 */
export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(cwd, 'bun.lockb'))) {
    return 'bun';
  }
  // Default to npm if package-lock.json exists or as fallback
  if (existsSync(join(cwd, 'package-lock.json'))) {
    return 'npm';
  }
  // Default fallback
  return 'npm';
}

/**
 * Install a package using the detected package manager
 */
export function installPackage(
  cwd: string,
  packageName: string
): { success: boolean; error?: string } {
  const packageManager = detectPackageManager(cwd);
  let executable: string;
  let args: string[];
  switch (packageManager) {
    case 'pnpm':
      executable = 'pnpm';
      args = ['add', packageName];
      break;
    case 'yarn':
      executable = 'yarn';
      args = ['add', packageName];
      break;
    case 'bun':
      executable = 'bun';
      args = ['add', packageName];
      break;
    case 'npm':
    default:
      executable = 'npm';
      args = ['install', packageName];
      break;
  }
  try {
    execFileSync(executable, args, {
      cwd,
      stdio: 'inherit',
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
