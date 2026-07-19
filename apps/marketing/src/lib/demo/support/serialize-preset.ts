import { serializeTableStateToUrl } from '@better-tables/core';
import type { SupportScenarioPreset } from './relationship-trail';

/** Serialize a scenario preset into URL search params (filters + sorting). */
export function serializeSupportPresetToUrl(
  preset: Pick<SupportScenarioPreset, 'filters' | 'sorting'>
): Record<string, string | null> {
  return serializeTableStateToUrl({
    filters: preset.filters,
    sorting: preset.sorting ?? [],
    pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
  });
}
