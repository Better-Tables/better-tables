import type { FilterGroupNode, FilterState } from '@better-tables/core';
import { deserializeFiltersFromURL } from '@better-tables/core';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupportTables } from '@/lib/demo/support/db';

const FACETABLE_COLUMNS = new Set([
  'status',
  'priority',
  'channel',
  'customer.plan',
  'customer.region',
  'assignee.team',
]);

/**
 * DX-FINDING-7a: `getFacetedValues`/`getMinMaxValues` return a `Map`, which
 * `NextResponse.json()` can't serialize (a `Map` stringifies to `{}`) --
 * converted to a plain `[value, count][]` array here. See
 * plans/findings/029-dx-findings.md #7.
 *
 * GET /api/facets?column=status&filters=c2:...&kind=values|minmax
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const columnId = searchParams.get('column');
  const kind = searchParams.get('kind') === 'minmax' ? 'minmax' : 'values';
  const filtersParam = searchParams.get('filters');

  if (!columnId || (kind === 'values' && !FACETABLE_COLUMNS.has(columnId))) {
    return NextResponse.json({ error: `Unknown facet column: ${columnId}` }, { status: 400 });
  }

  let filters: FilterState[] | FilterGroupNode;
  try {
    filters = filtersParam ? deserializeFiltersFromURL(filtersParam) : [];
  } catch {
    filters = [];
  }

  try {
    const supportTables = await getSupportTables();
    const adapter = supportTables.database;

    if (kind === 'minmax') {
      const [min, max] = await adapter.getMinMaxValues(columnId, { filters });
      return NextResponse.json({ min, max });
    }

    const facetMap = await adapter.getFacetedValues(columnId, { filters });
    return NextResponse.json({ values: Array.from(facetMap.entries()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load facets' },
      { status: 500 }
    );
  }
}
