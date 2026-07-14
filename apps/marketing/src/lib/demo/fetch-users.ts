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
      // Every DB-backed field any column can render must be requested here:
      // `columns` drives which relations are SELECTed and embedded in the
      // result rows (plan 030, finding 10), and column visibility is
      // client-side, so hidden-but-toggleable columns need their data too.
      // (profile.hasBio and roleTags are computed client-side from these.)
      columns: [
        'name',
        'email',
        'age',
        'role',
        'status',
        'createdAt',
        'profile.bio',
        'profile.website',
        'profile.location',
        'profile.github',
      ],
      // DX-FINDING-16: `fetchData()` returns `FetchDataResult<unknown>`
      // regardless of adapter/table -- see
      // plans/findings/029-dx-findings.md #16.
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
