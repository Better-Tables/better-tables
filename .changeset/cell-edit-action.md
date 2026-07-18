---
"@better-tables/core": minor
---

Zero-boilerplate cell saves: `tables.cellEditAction(def)`, the `saveAction`
prop, joined-table editing, and an opt-in HTTP write proxy

Plan 053's editable cells needed a hand-written POST route (allow-list,
value coercion, error mapping) plus a client fetch shim per table.
Everything that route did by hand is derivable from the table definition —
so now it is:

- **`tables.cellEditAction(def)`** generates a PLAIN async save function
  over serializable input/output (`{ id, field, value }` →
  `{ ok, data? | error }`) — exactly what a framework server boundary wants
  (`'use server'` one-liner in Next, `createServerFn` in TanStack Start).
  The policy (`buildCellEditPolicy`, exported) admits exactly the
  `.editable()` columns, coerces by column type (ISO/epoch → `Date`, enum
  membership for options, finite numbers, …), runs ValidationRules, and
  persists via `updateRecord` with an explicit table target. Errors are
  generic — internals never cross the boundary.
- **`saveAction` prop** on `BetterTable`/`VirtualizedTable`: save
  resolution is now `onCellEdit` → `saveAction` → direct adapter. Dates
  serialize to ISO on the way out; `{ ok: false }` triggers the same
  rollback + cell-error path as an adapter rejection.
- **Joined-table editing** (supersedes 053's dot-id restriction):
  `t.text('customer.company').editable()` edits the RELATED customer row.
  New adapter capability `resolveCellWriteTarget(columnId, table?)` returns
  a `CellWriteTarget` (real target table/field, `relatedIdPath` to the
  related row's id, one-to-many + writability flags). One-to-many columns
  are never cell-editable; a null related object renders that row's cell
  read-only. `resolveEditableField`/`normalizeEditableConfig`/
  `runValidationRules` moved into core (`@better-tables/ui` re-exports) so
  there is ONE implementation.
- **Opt-in HTTP write proxy** (deliberately reverses the "writes are never
  proxied" boundary, under DOUBLE opt-in): `writes` on
  `createAdapterRouteHandler` (boolean or `{ columns }` narrowing —
  recommended) AND `writes: true` on `httpAdapter`. The server fails
  closed: every `cellEdit` is re-resolved and coerced via the adapter's own
  schema introspection; disabled endpoints answer 403
  (`kind: 'forbidden'`); enabling writes without `authorize` logs a dev
  warning. Without the opt-ins, behavior is unchanged (read-only client
  shape, `update: false`). Only for genuinely separated frontend/backend
  deployments — monoliths should use `cellEditAction`.
