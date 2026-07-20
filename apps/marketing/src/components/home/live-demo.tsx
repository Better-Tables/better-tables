import { flattenFilterNode, isFilterGroupNode, parseTableSearchParams } from '@better-tables/core';
import { ResetDemoButton } from '@/components/home/reset-demo-button';
import { SqlReadout } from '@/components/home/sql-readout';
import { UsersTableClient } from '@/components/home/users-table-client';
import { SectionRow } from '@/components/site/section-row';
import { getUsersBackendMeta } from '@/lib/demo/users/adapter';
import { dialectMeta } from '@/lib/demo/users/dialect';
import { fetchUsers } from '@/lib/demo/users/fetch-users';

interface LiveDemoProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

/**
 * Homepage flagship demo: server-fetch via `tables.fetchData` (not `/api/users`).
 * URL state drives this RSC; the client table receives rows as props.
 */
export async function LiveDemo({ searchParams }: LiveDemoProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const { page, limit, filters: filterNode, sorting } = tableParams;
  const initialFilters = isFilterGroupNode(filterNode) ? flattenFilterNode(filterNode) : filterNode;

  // Soft-fail meta init the same way fetchUsers soft-fails, so a total backend
  // outage shows the inline alert instead of throwing the RSC.
  const [metaOutcome, { result, queries, error: fetchError }] = await Promise.all([
    getUsersBackendMeta()
      .then((meta) => ({ meta, error: null as string | null }))
      .catch((error: unknown) => ({
        meta: dialectMeta('sqlite'),
        error: error instanceof Error ? error.message : 'Failed to initialize demo backend',
      })),
    fetchUsers({
      page,
      limit,
      filters: filterNode,
      sorting,
    }),
  ]);

  const meta = metaOutcome.meta;
  const error = fetchError ?? metaOutcome.error;

  if (error) {
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    console.error('[live-demo]', error);
  }

  return (
    <SectionRow
      index="01"
      label="live demo"
      id="demo"
      title={meta.title}
      description={
        <>
          {meta.description}{' '}
          <span className="font-mono text-[12px] tracking-wide text-muted-foreground">
            ({meta.dialectLabel})
          </span>
        </>
      }
      aside={<ResetDemoButton supportsReset={meta.supportsReset} />}
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load demo data. Please try again.
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
