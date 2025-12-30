import type { FetchDataResult } from '@better-tables/core';
import { parseTableSearchParams } from '@better-tables/core';
import { Section } from '@/components/section';
import type { DemoUser } from '@/lib/demo-columns';
import { DemoTableClient } from './demo-table-client';

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

  const { page, limit, filters, sorting } = tableParams;

  // Fetch data from API route
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL('/api/demo-table', baseUrl);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('limit', limit.toString());
  if (filters.length > 0) {
    url.searchParams.set('filters', JSON.stringify(filters));
  }
  if (sorting.length > 0) {
    url.searchParams.set('sorting', JSON.stringify(sorting));
  }

  let result: FetchDataResult<DemoUser>;
  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
    });
    result = await response.json();
  } catch {
    result = {
      data: [],
      total: 0,
      pagination: {
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  return (
    <Section id="interactive-demo">
      <div className="border-x border-t">
        <div className="p-6 lg:p-12">
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">Try Better Tables Live</h3>
            <p className="text-muted-foreground">
              Experience the power of automatic relationship filtering. Filter across joined tables
              without writing a single JOIN query. The adapter handles everything automatically.
            </p>
          </div>
          <div className="w-full">
            <DemoTableClient
              data={result.data || []}
              totalCount={result.total || 0}
              initialPagination={
                result.pagination || {
                  page: 1,
                  limit: 10,
                  totalPages: 1,
                  hasNext: false,
                  hasPrev: false,
                }
              }
              initialSorting={sorting}
              initialFilters={filters}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
