'use server';

import type { FetchDataParams, FetchDataResult } from '@better-tables/core';
import { getAdapter } from '@/lib/adapter';
import type { UserWithRelations } from '@/lib/db/schema';

/**
 * Server action for fetching export data.
 * This replaces the need for a separate API route.
 */
export async function fetchExportData(
  params: FetchDataParams
): Promise<FetchDataResult<UserWithRelations>> {
  const adapter = await getAdapter();
  return adapter.fetchData(params);
}
