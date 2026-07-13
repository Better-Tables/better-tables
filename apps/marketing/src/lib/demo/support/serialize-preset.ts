import { serializeTableStateToUrl } from '@better-tables/core';
import type { SupportScenarioPreset } from './relationship-trail';

/**
 * DX-FINDING-3: the WIP originally hand-rolled sorting compression with the
 * `lz-string` package (not installed -- compile error) because
 * `serializeFiltersToURL` only covers filters. `@better-tables/core` already
 * exports `serializeTableStateToUrl`, which serializes filters + sorting (+
 * pagination/columnVisibility/columnOrder) together using the package's OWN
 * built-in compression -- no external dependency needed. See
 * plans/findings/029-dx-findings.md #3.
 */
export function serializeSupportPresetToUrl(
  preset: Pick<SupportScenarioPreset, 'filters' | 'sorting'>
): Record<string, string | null> {
  return serializeTableStateToUrl({
    filters: preset.filters,
    sorting: preset.sorting ?? [],
    pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
  });
}
