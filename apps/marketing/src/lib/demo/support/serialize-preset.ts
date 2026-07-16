import { serializeTableStateToUrl } from '@better-tables/core';
import type { SupportScenarioPreset } from './relationship-trail';

/**
 * `serializeFiltersToURL` only covers filters; `serializeTableStateToUrl`
 * serializes filters + sorting (+ pagination/columnVisibility/columnOrder)
 * together using core's own built-in compression -- so a preset link needs no
 * hand-rolled compression and no extra dependency (finding 3).
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
