'use server';

import type { CellEditActionInput, CellEditActionResult } from '@better-tables/core';
import { getTables } from '@/lib/adapter';
import { usersTable } from '@/lib/columns/user-columns';

/**
 * Save path for the homepage demo's editable cells — the same one-liner the
 * tickets demo uses. `tables.cellEditAction(usersTable)` derives which
 * columns are writable from the `.editable()` flags, coerces values by
 * column type, and routes joined columns (`profile.location`, `profile.bio`)
 * to the profiles table. Rows without a profile render those cells
 * read-only.
 */
export async function saveUserCell(input: CellEditActionInput): Promise<CellEditActionResult> {
  try {
    const tables = await getTables();
    return await tables.cellEditAction(usersTable)(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
