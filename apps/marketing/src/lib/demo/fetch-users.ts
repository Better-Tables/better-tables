import type {
  FetchDataResult,
  FilterGroupNode,
  FilterState,
  SortingState,
} from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { getTables } from '@/lib/adapter';
import { usersTable } from '@/lib/columns/user-columns';
import type { UserWithRelations } from '@/lib/db/schema';
import { type CapturedQuery, withSqlCapture } from '@/lib/db/sql-capture';

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
  /** Every SQL statement the adapter generated for this fetch. */
  queries: CapturedQuery[];
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
    const tables = await getTables();
    // Table-scoped: `primaryTable` comes from `usersTable` and the result is
    // typed as its row -- no cast (findings 9 + 16).
    const { result, queries } = await withSqlCapture(() =>
      tables.fetchData(usersTable, {
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
      })
    );

    return {
      result,
      filters: flatFilters,
      sorting,
      queries,
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
      queries: [],
      error: error instanceof Error ? error.message : 'Failed to load users',
    };
  }
}
