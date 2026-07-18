# Plan 054: Schema-driven auto columns — `t.auto()`, no-factory `define`, inferred enum options, facet-fallback dropdowns

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md` unless
> a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8ea4f4..HEAD -- packages/core/src packages/adapters/drizzle/src packages/ui/src/components/table/editable-cell.tsx packages/ui/src/hooks`
> This plan assumes plan 053 (`editable-cells` branch, tip `a8ea4f4`) is
> merged to main FIRST. If it isn't, STOP. If in-scope files changed beyond
> that merge, reconcile the excerpts before proceeding.

## Status

- **Priority**: P2 (Wave C — the "magic DX" pillar 1)
- **Effort**: L
- **Risk**: MED (new adapter capability + type-mapping correctness)
- **Depends on**: 053 merged. Plan 055 consumes this plan's `describeColumns`
  for its HTTP-proxy allow-list (soft dependency, 054 first is the clean order).
- **Category**: direction / feature
- **Planned at**: `editable-cells` tip `a8ea4f4`, 2026-07-18
- **Maintainer decisions (2026-07-18)**, binding:
  - Auto-column inference ships in **both forms**: `tables.define('users')`
    with NO factory (fully inferred) AND `t.auto()` spread inside a factory
    (inferred base + explicit overrides; explicit wins by id).
  - Option dropdown choices: **enum, then facets** — DB enum values populate
    options at inference time (humanized labels); option columns without enum
    metadata lazily fetch `adapter.getFilterOptions(columnId)` when the
    dropdown opens. Declared options always win.
  - **Per-column enrichment is independent of `t.auto()`** (clarified
    2026-07-18): an explicitly declared column — `t.option('status')` with no
    `.options()` — resolves its missing config (notably option choices) from
    `describeColumns` through the SAME lazy resolution. `t.auto()`'s ONLY job
    is column-SET inclusion ("and the rest of the table's columns"); it is
    never a prerequisite for inference, and auto-inclusion must never become
    the default (declaring a subset is deliberate — schemas contain columns
    that must not silently render, e.g. password hashes, internal fields).
  - `.editable()` remains **per-column** (decided 2026-07-18 — no table-level
    enable-all). Inferred columns are read-only until explicitly overridden:
    `[...t.auto(), t.text('subject').editable()]`.

## Why this matters

The adapter already knows everything a column definition contains — name,
type, nullability, primary/foreign keys, enum values — because it introspects
the Drizzle schema to run queries at all. Yet users hand-write a
`ColumnDefinition` per column, and option columns must re-declare choices the
database enum already knows (the 053 editable dropdown literally renders
"No options" when `filter.options` is undeclared). This plan makes the
adapter's knowledge flow into column definitions automatically: a table
mounts with zero column boilerplate, enums become dropdowns with humanized
labels by themselves, and explicit definitions remain the override mechanism
rather than the entry fee. This is pillar 1 of the "mount it and it works"
DX; plan 055 (direct save path) is pillar 2.

## Current state

Verified at `a8ea4f4` (053 implemented) unless noted.

- **No inference exists at runtime**: `defineTable` REQUIRES a factory —
  `packages/core/src/factory.ts:231` `defineTableImpl(tableName, factory)`
  calls `factory(t)` unconditionally. `schema-inference.ts` (drizzle) is
  TYPE-level utilities only.
- **The adapter has the raw material**:
  `packages/adapters/drizzle/src/utils/drizzle-schema-utils.ts:106-140` —
  `getTableColumns(tableSchema): ColumnInfo[]` (WeakMap-memoized, plan 040)
  returns per column: `name`, `column` (the live Drizzle column object),
  `isPrimaryKey` (`drizzleColumn.primary === true`), `isForeignKey`,
  `isNullable` (`notNull !== true`), `dataType` (`drizzleColumn.dataType`),
  `isArray`. Drizzle column objects additionally expose `enumValues`
  (text-with-enum / pgEnum) and `columnType` (e.g. `SQLiteTimestamp`) at
  runtime — VERIFY both on a real column in Step 2 before relying on them.
- **Type mapping targets**: `ColumnType` runtime source is
  `COLUMN_TYPES` in `packages/core/src/types/column.ts` (plan 038);
  `humanize()` lives in `packages/core/src/lib/format-utils.ts` (plan 046)
  and already drives `t.option()` label defaults.
- **Option editor's declared-options dependency** (the gap this closes):
  `packages/ui/src/components/table/editable-cell.tsx:405-407` (branch) —
  `const options = column.filter?.options ?? []; if (options.length === 0)`
  → renders `"No options"`. The option FILTER input has the same
  declared-options source.
- **Wire protocol** (post-035): `packages/core/src/adapters/http-protocol.ts`
  — `AdapterMethod` is the four READ methods; facet-style methods carry
  `{ method, columnId, params? }`. A `describeColumns` read fits this
  envelope exactly.
- **Lazy-resolution constraint**: the curried `defineTable<typeof tables>()`
  form is deliberately RUNTIME-ADAPTER-FREE (RSC-safe, type-only import —
  `factory.ts:246-262` doc comment). Auto columns therefore CANNOT resolve
  at definition time in that form; resolution must be lazy, at mount,
  against the adapter (which the UI/data layer has). The instance METHOD
  form (`tables.define('users')`) does hold the adapter but should use the
  same lazy mechanism for consistency.
- 041's httpAdapter TTL cache (`sendCacheable`) covers facet-method reads —
  a proxied `describeColumns` gets caching for free if routed the same way.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Core tests | `cd packages/core && bun test` | pass |
| UI tests | `cd packages/ui && bun test` | pass |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | pass (env-DB suites skip) |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bunx biome check .` | 0 errors |

## Scope

**In scope**:
- `packages/core/src/types/adapter.ts` — `InferredColumnSpec` +
  `describeColumns?` on `TableAdapter`
- `packages/core/src/types/factory.ts`, `packages/core/src/factory.ts` —
  no-factory `define` overload, `t.auto()` marker, lazy-resolution contract
  (`TableDefinition.autoColumns` marker + a resolver helper)
- `packages/core/src/adapters/http-protocol.ts`, `http-handler.ts`,
  `http-adapter.ts` — proxy `describeColumns` (read method)
- `packages/adapters/drizzle/src/` — implement `describeColumns`
  (type mapping + enumValues + humanize)
- `packages/ui/src/` — resolve auto columns at mount (BetterTable /
  `useTableData` seam); option editor + option filter input facet-fallback
- `packages/cli/src/lib/file-operations.ts` — manifest additions if new ui
  files are created
- Tests across core/drizzle/ui; `.changeset/*.md`; docs (wiki editable/
  columns sections); `plans/README.md`
- One marketing example demonstrating `[...t.auto(), overrides]`

**Out of scope**:
- Any editable-gating change (per-column `.editable()` stands).
- Relationship-path auto columns (own-table columns only in v1; relations
  stay explicit).
- The write proxy / save paths (plan 055).
- Prisma (hold stands) — but `describeColumns` is deliberately part of the
  neutral adapter contract so future adapters inherit it.

## Git workflow

- Branch: `schema-auto-columns`; commits `Plan 054 Step N: <summary>`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The `describeColumns` adapter capability (core contract)

In `packages/core/src/types/adapter.ts`:

```ts
/** Schema-derived column description — the raw material for auto columns. */
export interface InferredColumnSpec {
  /** Storage field name (own-table). Doubles as the auto column id. */
  field: string;
  /** Mapped Better Tables column type. */
  columnType: ColumnType;
  /** Humanized display label. */
  label: string;
  /** Declared enum choices, when the schema knows them. */
  options?: Array<{ value: string; label: string }>;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey: boolean;
  /** False for PKs and anything the adapter cannot write back. */
  writable: boolean;
}

// on TableAdapter:
/**
 * Optional: describe a table's columns from the underlying schema —
 * powers auto column inference (`t.auto()` / no-factory `define`).
 * `table` follows the same resolution as `FetchDataParams.primaryTable`.
 */
describeColumns?(table?: string): Promise<InferredColumnSpec[]>;
```

**Verify**: `bun run typecheck` exit 0 (optional member — no adapter breaks).

### Step 2: Drizzle implements `describeColumns`

In the drizzle adapter (place beside the other read methods; reuse
`resolvePrimaryTableForRead` for the `table` argument): map each
`getTableColumns` entry to an `InferredColumnSpec`:

- **Type mapping** (verify each against real Drizzle column objects in the
  test schema — this is the correctness heart): `dataType 'string'` → `text`;
  `'number'` → `number`; `'boolean'` → `boolean`; `'date'` OR `columnType`
  matching the timestamp family (`SQLiteTimestamp`, `PgTimestamp`,
  `MySqlDateTime`, … — reuse/extend the emitter's existing
  `isTimestampColumn` knowledge rather than re-listing) → `date`;
  `column.enumValues` non-empty → `option` with
  `options = enumValues.map(v => ({ value: v, label: humanize(v) }))`;
  `isArray` → `multiOption`; `dataType 'json'` → `json`; anything else →
  `text` with a dev-mode warn (never throw — inference must be total).
- `label: humanize(name)`; `writable: !isPrimaryKey` (v1 rule; FKs are
  writable-but-flagged — the UI decides, plan 055's allow-lists decide
  server-side).
- Memoize per table (schema is static; follow the WeakMap pattern from 040).

**Verify**: new drizzle test file: against the existing test schema (and one
enum + one timestamp + one array column — extend a fixture if none has all),
assert the full spec list for a table: types, humanized labels, enum options,
PK `writable: false`. `cd packages/adapters/drizzle && bun test` green.

### Step 3: Proxy it over the wire

`http-protocol.ts`: add `'describeColumns'` to `AdapterMethod` with body
`{ method: 'describeColumns'; table?: string }`. Handler: dispatch to
`adapter.describeColumns?.(body.table)` — absent capability returns
`{ ok: false, kind: 'bad_request', error: 'Adapter does not support describeColumns.' }`.
Client `httpAdapter`: implement `describeColumns` through `sendCacheable`
(041's TTL cache — schema answers are stable). This is a READ — it does NOT
touch the writes boundary.

**Verify**: extend `packages/core/tests/adapters/http-adapter.test.ts`:
round-trip a spec list; absent-capability error; second call within TTL hits
the cache (fetch stub count).

### Step 4: One lazy resolver — enrich explicit columns, then append `t.auto()`/no-factory columns

Core:

- `TableDefinition` gains an internal marker: `autoColumns?: boolean` (set
  when column-SET inference is requested). `t.auto()` returns a sentinel
  entry the column builder pipeline recognizes (`buildTableColumns` filters
  it out and sets the marker); `tables.define('users')` /
  `defineTable<T>()('users')` with NO factory produce `columns: []` +
  `autoColumns: true`.
- ONE resolver helper in core (exported for the UI):
  `resolveTableColumns(def, adapter): Promise<ColumnDefinition[]>`, doing
  BOTH halves against a single `adapter.describeColumns(def.tableName)` call:
  1. **Enrichment (always runs, `t.auto()` NOT required)**: for every
     EXPLICIT column whose id matches a spec field, fill config the user
     didn't declare — an `option`/`multiOption` column with no declared
     options gets the spec's enum options; emit a dev-mode warn when a
     declared column type contradicts the schema type (e.g. `t.text` on a
     boolean field). Declared values always win; enrichment only fills gaps.
  2. **Column-set inference (only when `autoColumns` is set)**: build real
     `ColumnDefinition`s for the remaining spec fields (id = field, accessor
     = `row => row[field]`, type/label/options from the spec,
     `sortable/filterable/hideable: true`) and MERGE: explicit columns win
     by id, inferred fill the rest, order = explicit first then inferred
     (stable schema order).
  Memoize per (def, adapter) pair. When the adapter lacks `describeColumns`,
  enrichment silently no-ops (columns behave exactly as declared) and
  `autoColumns` resolves to the explicit list with a dev warn.
- Auto-inferred columns are NOT editable (per-column decision) — `.editable()`
  requires an explicit entry.

UI: at the mount seam where `BetterTable` receives `table={def}` (and the
virtualized path), resolve via `resolveTableColumns` whenever the def has
`autoColumns` OR any explicit column with enrichable gaps (an option column
without options); otherwise skip the async hop entirely — fully-declared
tables must not pay a resolution round-trip. Async resolution renders the
existing loading state; follow the stable-identity idioms so this adds no
render churn — the 025/041 perf-lock tests must stay green.

**Verify**: core tests — no-factory define sets the marker; `t.auto()`
merge semantics (explicit wins, order, dedupe); **enrichment WITHOUT
`t.auto()`**: a def containing only `t.option('status')` (no `.options()`,
no `t.auto()`) resolves with the enum options filled in; declared options
suppress enrichment; type-mismatch dev-warn fires; fully-declared def skips
resolution (stub `describeColumns` never called). UI test — a `BetterTable`
mounted with a no-factory def + stub `describeColumns` renders the inferred
headers/cells; an override column replaces its inferred twin; an explicit
`t.option` column shows enum choices with zero `t.auto()` in the def.
Perf-lock tests unchanged.

### Step 5: Facet-fallback options for option dropdowns

In `editable-cell.tsx`'s option editor AND the option FILTER input: when the
column is `option`-typed and has no declared/inferred options, lazily call
`adapter.getFilterOptions(columnId)` on first open (loading state, then
cached — component-level memo; over HTTP 041's TTL cache dedups). Declared >
inferred-enum > facet-fetched precedence. Keep the "No options" fallback only
for a fetch that returns empty/fails.

**Verify**: ui tests — option editor with no options + stub adapter fetches
once, renders fetched choices, selection commits the VALUE; failure path
falls back to "No options" without crashing; declared options never trigger
a fetch.

### Step 6: Dogfood, docs, changesets, gates

1. Marketing: convert one example table to `[...t.auto(), <two explicit
   overrides with .editable()>]` — the DIRECT/monolith example per the
   2026-07-18 decision (no httpAdapter in this example; its save path is
   plan 055's action — if 055 hasn't landed, keep the existing save wiring
   and note it). Browser-verify inferred headers, enum dropdown with
   humanized labels.
2. Docs: wiki "Defining columns" section gains the auto-columns story +
   precedence rules; editable section notes options auto-population.
3. Changesets: core minor (`describeColumns`, `t.auto()`, no-factory define,
   resolver), drizzle minor (describeColumns), ui private (none).
4. Full gates incl. `bunx biome check .` 0 errors.

**Verify**: all gates green; browser observation reported;
`plans/README.md` row updated.

## Test plan

- Drizzle: spec-mapping suite (types/labels/enums/PK-writability).
- Core: marker/merge/resolver suites; http round-trip + cache + absent-capability.
- UI: auto-mount render, override precedence, facet-fallback fetch-once/
  failure/no-fetch-when-declared; perf-locks unchanged.
- Patterns: 042's value-emission style; 043's integration harness for one
  end-to-end auto-columns render against real `bun:sqlite`.

## Done criteria

- [ ] `InferredColumnSpec` + `TableAdapter.describeColumns?` exported from core; drizzle implements it with the mapping suite green
- [ ] `'describeColumns'` on the wire: round-trip + TTL-cache + absent-capability tests pass
- [ ] `tables.define('users')` (no factory) and `[...t.auto(), overrides]` both work; merge/precedence tests pass; auto columns are NOT editable without explicit override
- [ ] Enrichment is independent of `t.auto()`: a def with ONLY `t.option('status')` (no options, no `t.auto()`) renders the enum choices; a fully-declared def never calls `describeColumns` (tests prove both)
- [ ] Option editor + option filter input fall back enum→facets; fetch-once/failure/declared-wins tests pass; "No options" only after a failed/empty fetch
- [ ] 025/041 perf-lock tests unchanged; integration test renders an auto-columns table against real sqlite
- [ ] Changesets (core minor, drizzle minor) exist; wiki updated
- [ ] Root `bun run typecheck` exit 0; all package suites green; `bunx biome check .` 0 errors
- [ ] `plans/README.md` row updated

## STOP conditions

- `enumValues` or the timestamp `columnType` family is NOT reliably present
  on runtime Drizzle column objects across sqlite/pg/mysql fixtures — report
  what IS available before inventing a fallback mapping.
- Lazy resolution forces an async waterfall that visibly delays first paint
  beyond the existing loading state, or breaks the perf-lock tests.
- The `t.auto()` sentinel can't flow through `buildTableColumns` without
  changing `TableDefResult`'s public shape in a breaking way.
- Inference produces a column the fetch path can't actually select (id ≠
  selectable field for some column class) — that's a mapping bug, not a
  merge problem; report it.

## Maintenance notes

- Plan 055's HTTP write proxy uses `describeColumns` server-side as its
  schema-derived allow-list — keep `writable` semantics conservative.
- Future adapters (in-memory, Prisma post-hold) must implement
  `describeColumns` to get auto columns — it's part of the neutral contract
  on purpose.
- v2 candidates: relationship-path auto columns, per-column inference hints
  (`t.auto({ exclude: [...] })`), write-side `multiOption` editor consuming
  the same options plumbing.
