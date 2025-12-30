import { parseTableSearchParams } from '@better-tables/core';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '@/lib/adapter';
import { defaultVisibleColumns } from '@/lib/demo-columns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const tableParams = parseTableSearchParams(params, {
      page: 1,
      limit: 10,
    });

    const { page, limit, filters, sorting } = tableParams;

    // Fetch data using the Drizzle adapter
    const adapter = await getAdapter();
    // Filter out computed fields and request a posts column to ensure posts relationship is fetched
    const columnsToFetch = defaultVisibleColumns
      .filter((col) => col !== 'posts_count') // posts_count is computed client-side
      .concat('posts.id'); // Request posts.id to ensure posts relationship is fetched for posts_count
    const result = await adapter.fetchData({
      columns: columnsToFetch,
      primaryTable: 'users', // Explicitly specify the primary table
      pagination: { page, limit },
      filters,
      sorting,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch table data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
