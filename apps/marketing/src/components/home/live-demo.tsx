import { flattenFilterNode, isFilterGroupNode, parseTableSearchParams } from '@better-tables/core';
import { ResetDemoButton } from '@/components/home/reset-demo-button';
import { SqlReadout } from '@/components/home/sql-readout';
import { UsersTableClient } from '@/components/home/users-table-client';
import { SectionRow } from '@/components/site/section-row';
import { fetchUsers } from '@/lib/demo/fetch-users';

interface LiveDemoProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export async function LiveDemo({ searchParams }: LiveDemoProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const { page, limit, filters: filterNode, sorting } = tableParams;
  const initialFilters = isFilterGroupNode(filterNode) ? flattenFilterNode(filterNode) : filterNode;

  const { result, queries, error } = await fetchUsers({
    page,
    limit,
    filters: filterNode,
    sorting,
  });

  return (
    <SectionRow
      index="01"
      label="live demo"
      id="demo"
      title="5,000 rows. Zero mocks."
      description={
        <>
          A seeded SQLite database runs inside this page&apos;s server. Filter by joined profile
          fields, stack sorts, select rows — and watch the readout below show the exact SQL the
          adapter generates for every interaction.
        </>
      }
      aside={<ResetDemoButton />}
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load demo data: {error}
        </div>
      ) : null}

      <div className="rounded-lg border bg-card p-3 md:p-5">
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

      <div className="mt-4">
        <SqlReadout queries={queries} />
      </div>
    </SectionRow>
  );
}
