import type { FilterState, SortingState } from '@better-tables/core';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '@/lib/adapter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '10', 10);

    // Parse filters
    let filters: FilterState[] = [];
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch (e) {
        console.error('Error parsing filters:', e);
      }
    }

    // Parse sorting
    let sorting: SortingState = [];
    const sortingParam = searchParams.get('sorting');
    if (sortingParam) {
      try {
        sorting = JSON.parse(sortingParam);
      } catch (e) {
        console.error('Error parsing sorting:', e);
      }
    }

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
