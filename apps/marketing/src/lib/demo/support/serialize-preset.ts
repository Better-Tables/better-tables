import type { FilterGroupNode, FilterState, SortingState } from '@better-tables/core';
import { serializeFiltersToURL } from '@better-tables/core';
import LZString from 'lz-string';
import type { SupportScenarioPreset } from './relationship-trail';

function serializeSortingToUrl(sorting: SortingState): string {
  const shortened = sorting.map((item) => ({
    c: item.columnId,
    d: item.direction,
  }));
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(shortened));
  return `c:${compressed}`;
}

export function serializeSupportPresetToUrl(
  preset: Pick<SupportScenarioPreset, 'filters' | 'sorting'>
): Record<string, string | null> {
  const params: Record<string, string | null> = {
    page: '1',
    limit: '10',
  };

  const isEmptyArray = Array.isArray(preset.filters) && preset.filters.length === 0;
  params.filters = isEmptyArray ? null : serializeFiltersToURL(preset.filters);

  if (preset.sorting && preset.sorting.length > 0) {
    params.sorting = serializeSortingToUrl(preset.sorting);
  } else {
    params.sorting = null;
  }

  return params;
}

export function isRelationshipFilter(filter: FilterState | FilterGroupNode): filter is FilterState {
  return 'columnId' in filter;
}
