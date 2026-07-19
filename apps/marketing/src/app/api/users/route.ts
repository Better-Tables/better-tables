import { parseTableSearchParams } from '@better-tables/core';
import { inArray } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { getDatabase, resetDatabase } from '@/lib/db';
import { schema } from '@/lib/db/schema';
import { fetchUsers } from '@/lib/demo/fetch-users';

const MAX_MUTATION_IDS = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const { page, limit, filters, sorting } = tableParams;
  const { result, error } = await fetchUsers({ page, limit, filters, sorting });

  if (error) {
    // biome-ignore lint/suspicious/noConsole: server-side demo log, asserted in route.test.ts
    console.error('[api/users]', error);
    return NextResponse.json({ error: 'Failed to load demo data.' }, { status: 500 });
  }

  return NextResponse.json({
    data: result.data,
    total: result.total,
    pagination: result.pagination,
    meta: result.meta,
  });
}

function parseIds(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MUTATION_IDS) {
    return null;
  }
  const ids = input.map((id) => Number(id));
  return ids.every((id) => Number.isInteger(id) && id > 0) ? ids : null;
}

/** Bulk delete — powers the demo table's "Delete Selected" action. */
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids = parseIds(body?.ids);
  if (!ids) {
    return NextResponse.json({ error: 'Provide 1-100 numeric ids.' }, { status: 400 });
  }

  try {
    const { db } = await getDatabase();
    // No ON DELETE CASCADE in the demo DDL — remove children first.
    await db.delete(schema.posts).where(inArray(schema.posts.userId, ids));
    await db.delete(schema.profiles).where(inArray(schema.profiles.userId, ids));
    await db.delete(schema.users).where(inArray(schema.users.id, ids));
    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    console.error('[api/users:delete]', error);
    return NextResponse.json({ error: 'Failed to delete users.' }, { status: 500 });
  }
}

const USER_STATUSES = ['active', 'inactive', 'pending', 'suspended'] as const;
type UserStatus = (typeof USER_STATUSES)[number];

/** Bulk status update — powers the demo table's "Suspend Selected" action. */
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids = parseIds(body?.ids);
  const status = body?.status;
  if (!ids || !USER_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Provide 1-100 numeric ids and a status in: ${USER_STATUSES.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    const { db } = await getDatabase();
    await db
      .update(schema.users)
      .set({ status: status as UserStatus })
      .where(inArray(schema.users.id, ids));
    return NextResponse.json({ updated: ids.length });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: server-side demo log
    console.error('[api/users:patch]', error);
    return NextResponse.json({ error: 'Failed to update users.' }, { status: 500 });
  }
}

/** Reset the in-memory demo database to its seeded state. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body?.action !== 'reset') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  await resetDatabase();
  return NextResponse.json({ reset: true });
}
