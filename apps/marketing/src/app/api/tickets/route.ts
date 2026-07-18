import { parseTableSearchParams } from '@better-tables/core';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchTickets } from '@/lib/demo/support/fetch-tickets';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const { page, limit, filters, sorting } = tableParams;
  const { result, error } = await fetchTickets({ page, limit, filters, sorting });

  if (error) {
    console.error('[api/tickets]', error);
    return NextResponse.json({ error: 'Failed to load demo data.' }, { status: 500 });
  }

  return NextResponse.json({
    data: result.data,
    total: result.total,
    pagination: result.pagination,
    meta: result.meta,
  });
}
