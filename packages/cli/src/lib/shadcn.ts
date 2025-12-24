import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedPaths } from './config';

/**
 * List of required shadcn UI components for Better Tables
 */
export const REQUIRED_SHADCN_COMPONENTS = [
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
] as const;

export type ShadcnComponent = (typeof REQUIRED_SHADCN_COMPONENTS)[number];

/**
 * Check which shadcn components are already installed in the user's project
 */
export function checkInstalledComponents(uiPath: string): ShadcnComponent[] {
  const installed: ShadcnComponent[] = [];
  for (const component of REQUIRED_SHADCN_COMPONENTS) {
    const componentPath = join(uiPath, `${component}.tsx`);
    if (existsSync(componentPath)) {
      installed.push(component);
    }
  }
  return installed;
}

/**
 * Get the list of missing shadcn components
 */
export function getMissingComponents(uiPath: string): ShadcnComponent[] {
  const installed = checkInstalledComponents(uiPath);
  return REQUIRED_SHADCN_COMPONENTS.filter(
    (component) => !installed.includes(component)
  ) as ShadcnComponent[];
}

/**
 * Install shadcn components using npx shadcn@latest add
 */
export function installShadcnComponents(
  components: ShadcnComponent[],
  cwd: string
): { success: boolean; error?: string } {
  if (components.length === 0) {
    return { success: true };
  }
  try {
    const componentList = components.join(' ');
    execSync(`npx shadcn@latest add ${componentList} --yes`, {
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

/**
 * Check if shadcn is set up in the project (components.json exists)
 */
export function isShadcnSetup(cwd: string): boolean {
  return existsSync(join(cwd, 'components.json'));
}

/**
 * Get a summary of component installation status
 */
export function getComponentStatus(resolvedPaths: ResolvedPaths): {
  installed: ShadcnComponent[];
  missing: ShadcnComponent[];
  total: number;
} {
  const installed = checkInstalledComponents(resolvedPaths.ui);
  const missing = getMissingComponents(resolvedPaths.ui);
  return {
    installed,
    missing,
    total: REQUIRED_SHADCN_COMPONENTS.length,
  };
}
