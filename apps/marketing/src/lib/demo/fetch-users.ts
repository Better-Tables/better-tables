import type { FetchDataResult, FilterGroupNode, FilterState, SortingState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { getAdapter } from '@/lib/adapter';
import type { UserWithRelations } from '@/lib/db/schema';

export interface FetchUsersParams {
  page?: number;
  limit?: number;
  filters?: FilterState[] | FilterGroupNode;
  sorting?: SortingState;
}

export interface FetchUsersResult {
  result: FetchDataResult<UserWithRelations>;
  filters: FilterState[];
  sorting: SortingState;
  error: string | null;
}

function flattenFilters(filters?: FilterState[] | FilterGroupNode): FilterState[] {
  if (!filters) return [];
  if (isFilterGroupNode(filters)) return flattenFilterNode(filters);
  return filters;
}

export async function fetchUsers({
  page = 1,
  limit = 10,
  filters,
  sorting = [],
}: FetchUsersParams): Promise<FetchUsersResult> {
  const flatFilters = flattenFilters(filters);

  try {
    const adapter = await getAdapter();
    const result = (await adapter.fetchData({
      pagination: { page, limit },
      filters,
      sorting,
    })) as FetchDataResult<UserWithRelations>;

    return {
      result,
      filters: flatFilters,
      sorting,
      error: null,
    };
  } catch (error) {
    return {
      result: {
        data: [],
        total: 0,
        pagination: {
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
      filters: flatFilters,
      sorting,
      error: error instanceof Error ? error.message : 'Failed to load users',
    };
  }
}
