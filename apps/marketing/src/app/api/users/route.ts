import { type NextRequest, NextResponse } from 'next/server';
import { getUsersBackendMeta, getUsersDialect, resetUsersDatabase } from '@/lib/demo/users/adapter';
import { parseUserIds, userIdsErrorMessage } from '@/lib/demo/users/ids';
import {
  deleteUsersByIds,
  isUserStatus,
  USER_STATUSES,
  updateUsersStatus,
} from '@/lib/demo/users/mutations';

/**
 * Mutations for the homepage users demo.
 *
 * Reads do NOT go through this route — `LiveDemo` (RSC) calls
 * `tables.fetchData(usersTable)` via `fetchUsers` and passes rows as props.
 * This file only serves bulk actions + SQLite reset.
 */

/** Bulk delete — powers the demo table's "Delete Selected" action. */
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const dialect = await getUsersDialect();
  const ids = parseUserIds(body?.ids, dialect);
  if (!ids) {
    return NextResponse.json({ error: userIdsErrorMessage(dialect) }, { status: 400 });
  }

  try {
    const deleted = await deleteUsersByIds(ids);
    return NextResponse.json({ deleted });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    console.error('[api/users:delete]', error);
    return NextResponse.json({ error: 'Failed to delete users.' }, { status: 500 });
  }
}

/** Bulk status update — powers the demo table's "Suspend Selected" action. */
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const dialect = await getUsersDialect();
  const ids = parseUserIds(body?.ids, dialect);
  const status = body?.status;
  if (!ids || !isUserStatus(status)) {
    return NextResponse.json(
      {
        error: `${userIdsErrorMessage(dialect)} Status must be one of: ${USER_STATUSES.join(', ')}.`,
      },
      { status: 400 }
    );
  }

  try {
    const updated = await updateUsersStatus(ids, status);
    return NextResponse.json({ updated });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    console.error('[api/users:patch]', error);
    return NextResponse.json({ error: 'Failed to update users.' }, { status: 500 });
  }
}

/** Reset the in-memory SQLite demo database. Not available on Postgres. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body?.action !== 'reset') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  const meta = await getUsersBackendMeta();
  if (!meta.supportsReset) {
    return NextResponse.json(
      { error: 'Reset is only available for the in-memory SQLite fallback.' },
      { status: 400 }
    );
  }

  await resetUsersDatabase();
  return NextResponse.json({ reset: true });
}
