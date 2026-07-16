---
"@better-tables/adapters-drizzle": minor
---

feat(adapters): relation-aware row types drop inverse back-references (finding 12)

`RelationAwareRow` / `RowOf` / `$infer.Row` now include only FORWARD relations
— the reverse "what points back at me" edges (e.g. `customer.tickets` reached
from a `tickets` row) are omitted. Previously a two-way relation exploded the
inferred row into recursive unions (`customer` was `Customer | Customer & {
tickets: Ticket[] }`) that no `columns` selection ever returns, forcing
consumers to hand-shape a duplicate row type and cast
`table.columns as unknown as ColumnDefinition<MyRow>[]`.

Kept forward relations are also non-optional now, so the row is a clean
intersection (`Ticket & { customer: Customer }`) instead of an
"either-selected-or-not" union — directly usable as a consumer's row type.

This is a type-level change only; runtime query behavior is unchanged.
