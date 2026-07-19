# Plan 048: Design + build the visual filter group-builder (nested AND/OR authoring)

> **Executor instructions**: This is a DESIGN/BUILD plan. Do Step 1 (design
> doc) and get it reviewed before writing component code — the UI shape is the
> risky part. Run every verification; on any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/ui/src/components/filters packages/core/src/types/filter.ts packages/core/src/utils/filter-serialization.ts plans/design/core-contract-v2.md`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (net-new UI; the data contract already exists and is stable)
- **Depends on**: 015/016/017 (done — FilterNode core, state layer, group translation)
- **Category**: direction
- **Planned at**: commit `787a816`, 2026-07-17
- **Reconciled 2026-07-18 at `7b58ed8`** (Waves A+B merged on top): finding
  still valid — `filter-bar.tsx` remains flat (zero `FilterGroupNode`
  references). Two updates for the executor: (1) plan 041 rewrote the
  filter-bar handlers to stable identities via `useLatest` refs — the group
  builder MUST follow that handler idiom (and must not regress the
  badge render-count test from 041); (2) plan 042 gave every
  `inputs/*` filter input a value-emission test suite — model the group
  builder's leaf tests on those. Line refs in "Current state" may have
  shifted slightly; re-locate by symbol.
- **Maintainer decision (2026-07-17)**: **fast-follow after the 0.6 publish**,
  NOT gated into the release (per `core-contract-v2.md` open question (b)).
  The flat filter bar stays for 0.6 and is forward-compatible; this adds the
  nested-group authoring UI on top.

## Why this matters

The query contract for nested AND/OR groups already shipped: `FilterGroupNode`
types, `c2:` URL serialization, state-layer tree preservation (plans 015/016),
and Drizzle translation to real AND/OR SQL with a depth-3 cap (plan 017). But
the filter bar is still FLAT — the only way to author a group today is
programmatically or by hand-crafting a URL. The first consumers of OR queries
are API/URL callers (why it wasn't gated into 0.6), but a visual builder is
the productization of a capability the whole stack already supports end to
end — the classic "adjacent possible, one UI away".

## Current state

Verified at `787a816`:

- Data layer READY: `FilterGroupNode`/`FilterNode` in
  `packages/core/src/types/filter.ts`; serialization in
  `filter-serialization.ts` (`c2:` format with `c:` read fallback);
  state-layer tree preservation (`use-table-url-sync.ts` hydrate path, plan
  016); Drizzle group translation with depth cap 3 (plan 017).
- UI is FLAT: `packages/ui/src/components/filters/filter-bar.tsx` renders an
  implicit-AND array of badges; `active-filters.tsx`; the flat bar emits a
  valid implicit-AND `FilterNode` (forward-compatible per Step 1.6 of the
  design).
- Design context: `plans/design/core-contract-v2.md` open question (b) (the
  decision) and the flat-bar forward-compat rationale.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| UI tests | `cd packages/ui && bun test` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Preview | `cd apps/marketing && bun run dev` (verify against an examples page) | renders |

## Scope

**In scope**:
- `plans/design/filter-group-builder.md` (new design doc — Step 1)
- New UI: a group-builder component + supporting pieces under
  `packages/ui/src/components/filters/` (e.g. `filter-group-builder.tsx`,
  group/leaf row components, an AND/OR toggle)
- Tests under `packages/ui/tests/components/`
- One marketing example wiring it (optional showcase)
- `plans/README.md`; mark `core-contract-v2.md` (b) resolved

**Out of scope**:
- Any change to `FilterGroupNode`, serialization, or Drizzle translation —
  the contract is frozen and correct; this is UI only.
- The depth cap (stays 3).
- `@better-tables/ui` is private — no changeset.

## Git workflow

- Branch: `filter-group-builder-ui`; commits `Plan 048 Step N: …`.

## Steps

### Step 1: Design doc (review gate)

Write `plans/design/filter-group-builder.md`: the interaction model
(add-condition / add-group / AND-OR toggle per group / remove / drag or
nested indentation), how it maps to `FilterGroupNode` (every edit produces a
valid tree the existing state layer + serializer accept), the depth-3 cap's
UX (disable "add nested group" at depth 3), mobile behavior, and how it
coexists with / replaces the flat bar (a mode toggle, or the builder IS the
new bar). Reuse `DESIGN.md`/design-system tokens if the repo has them
(`plans/design/` or a `seed-design`/`shadcn` skill). Enumerate open UX
questions for the maintainer.

**Verify**: the doc exists and covers tree-mapping, depth cap, mobile, and
flat-bar coexistence. STOP here for review if the executor is a fresh model —
do not build UI before the design is confirmed.

### Step 2: Build the group + leaf primitives

Implement the group container (AND/OR toggle, add-condition, add-nested-group
gated at depth 3, remove) and leaf rows (reusing the existing `inputs/*`
filter inputs — do NOT duplicate them). State edits go through the existing
FilterNode state layer; the component is controlled by / emits
`FilterGroupNode`.

**Verify**: `cd packages/ui && bun test` — new component tests: building a
2-level AND/OR tree emits the correct `FilterGroupNode`; the depth-3 cap
disables further nesting; removing a leaf/group updates the tree.

### Step 3: Integrate + serialize round-trip

Wire the builder so its tree round-trips through the existing serializer
(`c2:` URL) and hydrates back — reusing plans 015/016's paths unchanged.
Assert a build → serialize → hydrate → identical-tree cycle.

**Verify**: a UI test drives build → URL → rehydrate and asserts tree
equality; `bun run typecheck` exit 0.

### Step 4: Showcase + gates + ledger

Optionally wire one `apps/marketing` example demonstrating an OR query, and
verify it in the browser (dev server → apply a nested group → rows narrow →
URL shows `c2:`). Full UI gates. Mark `core-contract-v2.md` (b) resolved with
a pointer to this plan; update plan 048 row.

## Test plan

- Component tests: tree emission for AND/OR + nesting; depth-cap gating;
  add/remove.
- Round-trip test: build → `c2:` → hydrate → equal tree.
- Optional browser verification of the marketing example.
- Patterns: existing `packages/ui/tests/components/*` and the FilterNode
  round-trip tests in core.

## Done criteria

- [ ] `plans/design/filter-group-builder.md` exists and was review-gated
- [ ] A group-builder component emits valid `FilterGroupNode` trees, reuses existing `inputs/*`, and enforces the depth-3 cap
- [ ] Build → serialize → hydrate round-trip test passes (tree equality)
- [ ] `cd packages/ui && bun test` pass; `bun run typecheck` exit 0
- [ ] `core-contract-v2.md` (b) marked resolved; `plans/README.md` updated

## STOP conditions

- The design (Step 1) surfaces a real limitation in `FilterGroupNode` or the
  serializer that would require a contract change — STOP; the contract is
  supposed to be sufficient (plans 015-017), so a gap is a finding, not a
  freelance contract edit.
- The depth-3 cap conflicts with a desired UX (users need depth 4) — report
  to the maintainer (the cap is a decided default with a per-call override at
  the type level, but the UI cap is a product call).
- Building the group UI requires duplicating the `inputs/*` components rather
  than reusing them — stop and reconsider the integration.

## Maintenance notes

- Ship AFTER the 0.6 publish (maintainer decision) — the flat bar covers 0.6.
- The flat bar's forward-compat (emits implicit-AND `FilterNode`) means no
  rework is thrown away; the builder can replace or coexist with it.
- Reviewer scrutiny: every builder edit must produce a serializer-valid tree;
  the depth-cap gating must match plan 017's translation cap exactly.
