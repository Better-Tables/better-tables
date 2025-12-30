import type { FilterState, SortingParams } from '@better-tables/core';
import { NextResponse } from 'next/server';
import { getAdapter } from '@/lib/adapter';

/**
 * API route for fetching data for export.
 * Supports pagination, filtering, and sorting.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { offset, limit, filters, sorting } = body as {
      offset: number;
      limit: number;
      filters?: FilterState[];
      sorting?: SortingParams[];
    };

    const adapter = await getAdapter();

    // Calculate page from offset
    const page = Math.floor(offset / limit) + 1;

    const result = await adapter.fetchData({
      pagination: { page, limit },
      filters,
      sorting,
    });

    return NextResponse.json({
      data: result.data,
      total: result.total,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch data for export' }, { status: 500 });
  }
}
