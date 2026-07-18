# Plan 043: Cross-package integration test + optional E2E smoke over the examples

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/ui packages/adapters/drizzle apps/marketing/src/app/(marketing)/examples`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW (new test infra; no product change)
- **Depends on**: 033 (marketing test wiring + turbo cache), 042 (UI unit coverage lands first)
- **Category**: tests
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

Every layer is tested against a mock of the next: UI tests use a stub
adapter (`grep 'adapters-drizzle|bun:sqlite' packages/ui/tests` → none), the
one marketing test deliberately bypasses production (`better-sqlite3` can't
load under Bun's engine, so it uses `bun:sqlite` + a direct adapter cast),
and there is no Playwright/Cypress config anywhere. So the full flow the
library exists for — column defs → Drizzle SQL → UI render + URL sync — is
never validated end-to-end by any automated test. A regression at a seam
(e.g. the CORR-01 refetch loop, the CORR-02 string-date rendering, or a
facet contract mismatch) passes every mocked suite.

## Current state

Verified at `787a816`:

- UI tests all use `packages/ui/tests/helpers/stub-adapter.ts`; no real
  adapter.
- `apps/marketing/src/lib/demo/support/fetch-tickets.test.ts` uses `bun:sqlite`
  + a direct `DrizzleAdapter` cast (its header explains the native-binding
  reason) — proving a real drizzle adapter over `bun:sqlite` is testable in
  this repo's runner.
- `betterTables()`/`defineTable()` flagship API + the `drizzleAdapter(db)`
  auto-detect path exist and are demonstrated in
  `apps/marketing/src/lib/demo/support/db.ts`.
- No E2E infra: no `playwright.config.*`, no `e2e/`, no `*.e2e.*`. The
  `/examples` demo pages were browser-verified manually (per ledger).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build deps | `bun run build --filter=@better-tables/core --filter=@better-tables/adapters-toolkit --filter=@better-tables/adapters-drizzle` | exit 0 |
| Run the integration test | `cd packages/ui && bun test components/integration.test.tsx` (or wherever placed) | pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- One new integration test that mounts a real `BetterTable` (`@better-tables/ui`)
  against a `bun:sqlite`-backed Drizzle adapter with seed data. Placement:
  `packages/ui/tests/components/integration-drizzle.test.tsx` (UI can
  dev-depend on drizzle for tests) OR a small new
  `packages/integration/` workspace if adding drizzle as a UI devDep is
  undesirable — prefer the former; decide in Step 1.
- Optional (Step 4, only if trivially wired): a Playwright smoke config +
  one test over `/examples`.
- `packages/ui/package.json` (add `@better-tables/adapters-drizzle` +
  `drizzle-orm` as devDependencies if Step 1 chooses the in-`ui` path)
- `plans/README.md`

**Out of scope**:
- A toolkit-native in-memory adapter (that's direction DIR-05, deferred by
  the maintainer this wave — use `bun:sqlite` + Drizzle instead).
- Changing product source.
- CI E2E execution if it needs browsers CI doesn't have (gate it behind a
  manual/opt-in job; note it, don't force it green).

## Git workflow

- Branch: `integration-e2e-harness`; commits `Plan 043 Step N: …`.

## Steps

### Step 1: Decide placement, add the seam

Choose the in-`ui` path (add drizzle + drizzle-orm as `devDependencies` to
`packages/ui/package.json`, catalog-pinned) unless that creates a dependency
cycle (ui does not depend on drizzle at runtime; a devDep is fine). Build a
tiny seeded `bun:sqlite` database + `drizzleAdapter(db)` test fixture,
modeled on `apps/marketing/src/lib/demo/support/fetch-tickets.test.ts`.

**Verify**: `bun install` → exit 0, no dependency cycle; `bun run typecheck`
→ exit 0.

### Step 2: The integration test

Render `<BetterTable>` (or the flagship data component) with the real
adapter and `defineTable` columns. Assert the full flow:
1. Initial render shows seeded rows (real Drizzle fetch → UI render).
2. Applying a filter refetches and narrows the rows (drives the fetch hook
   against the real adapter — this exercises the CORR-01 loop path with a
   resolving adapter, and CORR-02 date rendering with real values).
3. A date column renders formatted (not raw), and a facet read returns real
   counts.
Keep it deterministic (fixed seed, no wall-clock waits — use the fake-timer
approach from plan 042 for any debounce).

**Verify**: `cd packages/ui && bun test <the new file>` → pass.

### Step 3: Wire it into CI

Ensure the new test runs under `cd packages/ui && bun test` (it will, being in
`tests/`). If it needs the built drizzle dist, confirm turbo's `test` task
`dependsOn: ["build"]` covers it (drizzle build must precede). Confirm the
`test-ui` CI job builds drizzle first or that the dependency is expressed.

**Verify**: from a clean state, `bun run test --filter=@better-tables/ui`
builds deps then runs the integration test green.

### Step 4 (optional): Playwright smoke over /examples

Only if it can be wired without fighting the environment: add a minimal
`playwright.config.ts` + one test that loads an `/examples` page against
`next dev`/`next start`, asserts the table renders rows, applies one filter,
and asserts the URL updated + rows changed. Gate it behind an opt-in script
(`test:e2e`) and a manual CI job (not the default `test` gate) since CI may
lack browsers. If it's not trivially wired, SKIP and record the E2E gap as
remaining backlog rather than half-building it.

**Verify**: `bun run test:e2e` (if added) passes locally; document whether
CI runs it.

### Step 5: Gates + ledger

`bun run typecheck`; `cd packages/ui && bun test`. Update plan 043 row,
noting whether E2E (Step 4) was included or deferred.

## Test plan

- The integration test (Step 2) is the deliverable: real drizzle + real UI +
  URL sync in one flow.
- Optional Playwright smoke (Step 4).
- Pattern: `apps/marketing/src/lib/demo/support/fetch-tickets.test.ts` for
  the `bun:sqlite` + Drizzle fixture; `packages/ui/tests/components/*` for the
  render/interaction style.

## Done criteria

- [ ] An integration test mounts real `BetterTable` + real `bun:sqlite` Drizzle adapter and asserts render → filter → refetch → formatted-date render
- [ ] It runs under `cd packages/ui && bun test` and via `bun run test --filter=@better-tables/ui` (deps built first)
- [ ] `bun run typecheck` exit 0
- [ ] Step 4 either lands (opt-in `test:e2e` + config) or is explicitly recorded as deferred in `plans/README.md`
- [ ] No product `src/**` modified
- [ ] `plans/README.md` updated

## STOP conditions

- Adding drizzle as a UI devDep creates a real dependency cycle or breaks the
  ui build — switch to a dedicated `packages/integration` workspace and note it.
- `better-sqlite3` (not `bun:sqlite`) turns out to be required by the adapter
  path under test and won't load in `bun test` — use the `bun:sqlite` +
  direct-adapter approach the marketing test already proves, and note the
  production-driver path remains covered only by manual/CI-node runs.
- The integration test surfaces a real seam bug — report it (it may already
  be covered by plan 034/035; cross-reference).

## Maintenance notes

- This is the test that would have caught CORR-01/CORR-02 pre-ship — keep it
  green as the canary for adapter↔UI contract drift.
- If direction DIR-05 (in-memory adapter) later lands, this test can swap the
  `bun:sqlite` fixture for it and drop the drizzle devDep.
- Reviewer scrutiny: determinism (fixed seed, no wall-clock waits) and that
  the filter step actually re-queries the DB, not a cached result.
