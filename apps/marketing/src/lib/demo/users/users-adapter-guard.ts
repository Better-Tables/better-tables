/**
 * Request-surface allowlist for `/api/tables/users`.
 *
 * Pins `primaryTable` / describeColumns and allowlists column ids so clients
 * cannot reach unrelated schema tables. Shared logic lives in
 * {@link createAdapterGuard}.
 */

import type { AdapterRequestBody } from '@better-tables/core';
import { createAdapterGuard } from '@/lib/demo/adapter-guard';
import { allUserColumnIds } from './columns';

const guard = createAdapterGuard('users', allUserColumnIds);

export const USERS_DEMO_COLUMN_IDS = guard.columnIds;

export function collectUsersAdapterColumnIds(body: AdapterRequestBody): string[] {
  return guard.collectColumnIds(body);
}

export function isAllowedUsersAdapterRequest(body: AdapterRequestBody): boolean {
  return guard.isAllowed(body);
}

export function constrainUsersAdapterRequest(body: AdapterRequestBody): AdapterRequestBody {
  return guard.constrain(body);
}
