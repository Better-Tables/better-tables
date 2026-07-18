import { NextResponse } from 'next/server';
import { ticketsTable } from '@/lib/demo/support/columns';
import { getSupportTables } from '@/lib/demo/support/db';

/** Own-table fields the demo allows inline edits for (plan 053 dogfood). */
const ALLOWED_FIELDS = new Set(['subject', 'status', 'slaBreached', 'createdAt']);

/**
 * Persist a single cell edit from the tickets demo table.
 *
 * The browser uses `httpAdapter` for reads (no write proxy by design), so
 * editable cells call this route via `onCellEdit`. The handler writes through
 * the real Drizzle adapter (`tables.updateRecord`).
 */
export async function POST(request: Request) {
  let body: { id?: string; field?: string; value?: unknown };
  try {
    body = (await request.json()) as { id?: string; field?: string; value?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const id = body.id;
  const field = body.field;
  if (!id || typeof id !== 'string' || !field || typeof field !== 'string') {
    return NextResponse.json({ error: 'id and field are required.' }, { status: 400 });
  }
  if (!ALLOWED_FIELDS.has(field)) {
    return NextResponse.json({ error: `Field "${field}" is not editable.` }, { status: 403 });
  }

  try {
    const tables = await getSupportTables();
    const value =
      field === 'createdAt' && typeof body.value === 'string' ? new Date(body.value) : body.value;
    const updated = await tables.updateRecord(ticketsTable, id, { [field]: value });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('[api/tables/tickets/update]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed.' },
      { status: 500 }
    );
  }
}
