import type { FetchDataResult } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode, parseTableSearchParams } from '@better-tables/core';
import Link from 'next/link';
import { Section } from '@/components/section';
import { buttonVariants } from '@/components/ui/button';
import { getTables } from '@/lib/adapter';
import { usersTable } from '@/lib/columns/user-columns';
import type { UserWithRelations } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { UsersTableClient } from './users-table-client';

interface InteractiveDemoProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export async function InteractiveDemo({ searchParams }: InteractiveDemoProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const { page, limit, filters: filterNode, sorting } = tableParams;
  const initialFilters = isFilterGroupNode(filterNode) ? flattenFilterNode(filterNode) : filterNode;

  let error: string | null = null;
  let result: FetchDataResult<UserWithRelations> = {
    data: [],
    total: 0,
    pagination: {
      page,
      limit,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  };

  try {
    const tables = await getTables();
    // Table-scoped: `primaryTable` comes from `usersTable` and the rows are
    // typed as its row -- no cast (findings 9 + 16).
    result = await tables.fetchData(usersTable, {
      pagination: { page, limit },
      filters: filterNode,
      sorting,
    });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Failed to load users';
  }

  return (
    <Section id="interactive-demo">
      <div className="border-x border-t">
        <div className="p-6 lg:p-12">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Try Better Tables Live</h3>
              <p className="text-muted-foreground max-w-2xl">
                Experience automatic relationship filtering on a seeded user directory. Filter
                across joined profile fields without writing a single JOIN query.
              </p>
            </div>
            <Link
              href="/examples/relationship-filtering"
              className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0')}
            >
              Open full support example
            </Link>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              Could not load demo data: {error}
            </div>
          ) : null}

          <div className="w-full">
            <UsersTableClient
              data={result.data ?? []}
              totalCount={result.total ?? 0}
              initialPagination={
                result.pagination ?? {
                  page: 1,
                  limit: 10,
                  totalPages: 1,
                  hasNext: false,
                  hasPrev: false,
                }
              }
              initialSorting={sorting}
              initialFilters={initialFilters}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
