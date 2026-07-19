# Plan 049: Execute the plugin hook seam (beforeFetch/afterFetch), validated by one real plugin

> **Executor instructions**: DESIGN + BUILD plan. Do Step 1 (hook-signature
> design) and lock it against ONE concrete plugin before wiring more hook
> points. Run every verification; on any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/factory.ts packages/core/src/types/factory.ts plans/design/table-definition-dx.md`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (design doc warns: committing hook signatures before a second real plugin risks redesign)
- **Depends on**: 018 (done — the `plugins` config seam exists)
- **Category**: direction
- **Planned at**: commit `787a816`, 2026-07-17
- **Reconciled 2026-07-18 at `7b58ed8`**: finding still valid — the seam is
  still stored-only (`git grep beforeFetch\|afterFetch packages/core/src` →
  nothing; `plugins?: TableDefPlugin[]` now at `types/factory.ts:59`).
  Plan 047 added instance WRITE methods to `factory.ts` (createRecord/
  updateRecord/deleteRecord, ~`:141-170`) — line refs in "Current state"
  shifted; the fetch choke point (`instance.fetchData`) is unchanged in
  shape. Consider whether `beforeFetch`/`afterFetch` should be joined by
  write-path hooks NOW that writes exist on the instance — the plan's
  minimal-hooks rule still says no (wait for a second real plugin); plan
  053's `commitEdit` is designed to adopt a future `beforeSave`/`afterSave`
  without rework.
- **Maintainer decision (2026-07-17)**: build this. It is the delivery vehicle
  the Export UI (plan 050) and future saved-views want. Validate the seam with
  a first real plugin so the interface is proven, not speculative.

## Why this matters

`betterTables({ plugins })` accepts and STORES plugins but never runs them —
`packages/core/src/types/factory.ts:58` literally comments "Plugin seam —
stored, not yet executed (hooks are a follow-up)". Every cross-cutting
capability (export, saved views, audit/logging, row transforms) currently has
nowhere to hook and must bolt onto the fetch path ad hoc. Wiring
`beforeFetch`/`afterFetch` into the fetch pipeline ONCE turns the existing
config seam into the extension point the roadmap promises
(`README.md:476` "Plugin system", v1.0). The design doc
(`plans/design/table-definition-dx.md:309-352`) sketches the hooks and names
the first two plugins (`csvExport()`, `savedFilters()`).

## Current state

Verified at `787a816`:

- `packages/core/src/types/factory.ts:36` — `TableDefPlugin` is just
  `{ name: string; [key: string]: unknown }` — NO hooks modeled.
- `:58` — `plugins?: TableDefPlugin[]` ("stored, not yet executed").
- `packages/core/src/factory.ts:78` — `plugins: config.plugins ?? []` stored
  on the instance; `:22` example shows `plugins: []`. Nothing invokes them.
- The instance fetch path: `factory.ts:103-111` — `instance.fetchData`
  delegates to `asTableAdapter(config.database).fetchData({...params, primaryTable})`.
  This is the single choke point where `beforeFetch`/`afterFetch` would wrap.
- Design sketch: `table-definition-dx.md:309-352` (`beforeFetch`/`afterFetch`
  hooks, `csvExport()` + `savedFilters()` as the first plugins).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Core tests | `cd packages/core && bun test` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Perf gate | (the core benchmark) | within budget |

## Scope

**In scope**:
- `packages/core/src/types/factory.ts` (model `TableDefPlugin` hooks:
  `beforeFetch?`, `afterFetch?`)
- `packages/core/src/factory.ts` (execute hooks around the instance fetch
  path, in registration order)
- One first plugin to validate the seam (a minimal `logPlugin` or the
  `csvExport` skeleton — coordinate with plan 050 if csvExport is the choice)
- `packages/core/tests/*`; `.changeset/*.md` (core minor); `MIGRATION.md`
  (plugin hooks now execute); `plans/design/table-definition-dx.md` (note the
  hook contract landed); `plans/README.md`

**Out of scope**:
- Adding MORE hook points than `beforeFetch`/`afterFetch` (the design doc
  warns to wait for a second real plugin — deliberately minimal).
- Hooks on facet/write paths (fast-follow once a plugin needs them).
- The Export UI itself (plan 050 — this plan provides the seam it plugs into).

## Git workflow

- Branch: `plugin-hook-execution`; commits `Plan 049 Step N: …`.

## Steps

### Step 1: Model the hook signatures (design, lock against one plugin)

Extend `TableDefPlugin` with optional async hooks:

```ts
interface TableDefPlugin {
  name: string;
  beforeFetch?(ctx: { params: FetchDataParams; table?: TableDefinition<...> }): FetchDataParams | Promise<FetchDataParams>;
  afterFetch?(ctx: { params: FetchDataParams; result: FetchDataResult<...> }): FetchDataResult<...> | Promise<FetchDataResult<...>>;
  [key: string]: unknown;
}
```

(Exact generics: match the instance fetch surface. `beforeFetch` returns
possibly-modified params; `afterFetch` returns possibly-modified result. Keep
the `[key: string]: unknown` escape hatch for plugin-specific extras like an
`export()` method.) Decide the exact ctx shape by writing the FIRST plugin
(Step 3) against it before finalizing — if the plugin can't express its need,
adjust the signature now, not after publish.

**Verify**: `bun run typecheck` → exit 0 with the new type; a plugin object
literal with hooks type-checks.

### Step 2: Execute hooks in the fetch pipeline

In `factory.ts`, wrap `instance.fetchData`: run each plugin's `beforeFetch`
in registration order (threading the possibly-modified params forward), call
the adapter, then run each plugin's `afterFetch` (threading the result). Hooks
are async; a throwing hook should fail the fetch (do NOT swallow — surface it,
consistent with the repo's log-never-swallow policy from plan 023). Preserve
the `primaryTable` injection.

**Verify**: `cd packages/core && bun test` — add tests: a `beforeFetch` that
adds a filter narrows the result; an `afterFetch` that maps rows transforms
the output; hook order is registration order; a throwing hook propagates.

### Step 3: One real plugin

Ship a minimal but real plugin to prove the seam — either a `logPlugin({ onFetch })`
or the `csvExport()` skeleton (if coordinating with plan 050, ship the
csvExport plugin's data-collection half here and let 050 add the UI). The
plugin must exercise at least one hook meaningfully.

**Verify**: a test wiring the plugin through `betterTables({ plugins: [...] })`
and asserting its hook ran with real data.

### Step 4: Docs + changeset + perf gate + ledger

- `MIGRATION.md`: plugins now execute `beforeFetch`/`afterFetch` (was
  stored-only); show a minimal plugin.
- `table-definition-dx.md`: note the hook contract landed (and that more hook
  points await a second plugin).
- Changeset `@better-tables/core` (minor). Perf gate (hooks add a wrapper —
  confirm negligible when no plugins). Update plan 049 row.

## Test plan

- Core: beforeFetch param mutation; afterFetch result mutation; registration
  order; throwing-hook propagation; the real plugin's hook firing.
- Perf: no-plugin path stays within budget (the wrapper must be near-free
  when `plugins` is empty).
- Patterns: `packages/core/tests/factory.test.ts`.

## Done criteria

- [ ] `TableDefPlugin` models `beforeFetch`/`afterFetch`; `factory.ts` executes them around the fetch path in registration order
- [ ] A throwing hook propagates (not swallowed); no-plugin path is unaffected
- [ ] One real plugin exists and a test proves its hook runs with real data
- [ ] `MIGRATION.md` + design doc updated; changeset exists; perf gate within budget
- [ ] `bun run typecheck` exit 0; core tests pass; `plans/README.md` updated

## STOP conditions

- The first plugin (Step 3) can't express its need with `beforeFetch`/
  `afterFetch` alone — adjust the signature BEFORE finalizing (that's the
  point of validating against a real plugin); if it needs a facet/write hook,
  report and scope minimally rather than adding many hook points speculatively.
- Executing hooks measurably regresses the no-plugin fetch path — report; the
  wrapper must short-circuit when `plugins` is empty.
- Wiring hooks requires changing the adapter contract (it shouldn't — hooks
  live at the instance layer) — STOP.

## Maintenance notes

- Additional hook points (facet, write, per-row) are DELIBERATELY deferred
  until a second real plugin validates a second shape — the design doc's
  explicit warning. Don't add them preemptively.
- Plan 050 (Export UI) builds `csvExport()` on this seam; plan-direction
  saved-views would build `savedFilters()` on it later.
- Reviewer scrutiny: hook execution order, error propagation, and the
  empty-plugins fast path.
