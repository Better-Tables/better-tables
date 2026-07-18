/**
 * Persist an inline cell edit for the tickets demo.
 * Cell-edit save path for the support-ticket demos.
 */
export async function persistTicketCellEdit(ctx: {
  rowId: string;
  field: string | null;
  value: unknown;
}): Promise<void> {
  if (!ctx.field) {
    throw new Error('No writable field for this column');
  }
  const value = ctx.value instanceof Date ? ctx.value.toISOString() : ctx.value;
  const response = await fetch('/api/tables/tickets/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: ctx.rowId, field: ctx.field, value }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Save failed (${response.status})`);
  }
}
