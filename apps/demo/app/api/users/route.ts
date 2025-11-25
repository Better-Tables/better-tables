import { parseTableSearchParams } from '@better-tables/ui/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '@/lib/adapter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse URL params using the utility (handles decompression automatically)
    const params = Object.fromEntries(searchParams.entries());
    const tableParams = parseTableSearchParams(params, {
      page: 1,
      limit: 10,
    });

    const { page, limit, filters, sorting } = tableParams;

    // Get adapter and fetch data
    const adapter = await getAdapter();
    const result = await adapter.fetchData({
      pagination: { page, limit },
      filters,
      sorting,
    });

    return NextResponse.json({
      data: result.data,
      total: result.total,
      pagination: result.pagination,
      meta: result.meta,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
