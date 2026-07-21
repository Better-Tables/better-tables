# Plan 056: Make root `bun run typecheck` deterministic (toolkit race)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- turbo.json .github/workflows/test.yml`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (one-line task-graph change; worst case is slightly longer wall-clock for the root typecheck)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `27c59b9`, 2026-07-20

## Why this matters

`bun run typecheck` at the repo root intermittently fails with
`Failed: @better-tables/adapters-toolkit#typecheck` while the very same
`cd packages/adapters/toolkit && bun run typecheck` passes standalone. It was
observed failing twice in one session on 2026-07-19/20 and then passing on
later runs with no code change. A flaky root gate trains people to re-run
until green, which eventually masks a real type error. CI runs the same turbo
task (`.github/workflows/test.yml:112` → `bun run typecheck`), so the same
latent race exists there even though it has not been observed to fire in CI
yet.

## Current state

Verified at `27c59b9`:

- `turbo.json` — the `typecheck` task depends only on **upstream** builds,
  not the package's own build:

  ```json
  "test": {
    "dependsOn": ["build"],
    ...
  },
  "typecheck": {
    "dependsOn": ["^build"],
    "outputs": []
  },
  ```

  Note the asymmetry: `test` already depends on the package's **own**
  `build` (`"build"`), while `typecheck` depends only on `^build`
  (upstream packages' builds).

- Because of that, turbo schedules a package's `typecheck` **concurrently
  with its own `build`**. Captured live from a root run at `27c59b9` (log
  order):

  ```
  @better-tables/adapters-toolkit:build: cache miss, executing 43727fc847fdfa26
  @better-tables/adapters-toolkit:typecheck: cache miss, executing 477f65ab801ed6b4
  @better-tables/adapters-toolkit:build: $ tsdown
  @better-tables/adapters-toolkit:typecheck: $ tsc --noEmit
  @better-tables/adapters-toolkit:build: ℹ Cleaning 8 files
  ```

  `tsdown` **deletes** the package's `dist/` ("Cleaning 8 files") and then
  rewrites it while `tsc --noEmit` is running in the same package. Any file
  the typecheck resolves out of a `dist/` directory that is being cleaned or
  half-rewritten at that moment produces spurious errors.

- `packages/adapters/toolkit/tsconfig.json` — `"include": ["src/**/*",
  "tests"]`, `"exclude": ["node_modules", "dist"]`. The `exclude` only
  filters the include globs; files reached through **module resolution**
  (e.g. `@better-tables/core` → `packages/core/dist/index.d.mts`, per core's
  `package.json` `types` field) are still read from `dist/` directories.

- The exact tsc error text was not captured when the failure fired (only
  turbo's `Failed: @better-tables/adapters-toolkit#typecheck` summary
  line). Step 1 captures it if the race reproduces.

- Repo conventions: `turbo.json` is small and hand-maintained; match its
  existing style (the `test` task is the exemplar for "depends on own
  build").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Root typecheck | `bun run typecheck` | exit 0, `Tasks: 10 successful` |
| Forced (no cache) | `bunx turbo typecheck --force` | exit 0 |
| Toolkit standalone | `cd packages/adapters/toolkit && bun run typecheck` | exit 0 |
| Full test suite | `bun run test` | all pass |

## Scope

**In scope** (the only files you should modify):
- `turbo.json`

**Out of scope** (do NOT touch, even though they look related):
- `packages/adapters/toolkit/tsconfig.json` — its include/exclude is correct;
  the race is a task-ordering problem, not a tsconfig problem.
- `packages/*/package.json` `types`/`exports` fields — resolving types from
  `dist/` is the intended published-package shape.
- `.github/workflows/test.yml` — it runs the same root command; it inherits
  the fix automatically.
- Any `tsdown.config.ts` — do not disable cleaning.

## Git workflow

- Branch: continue on the current working branch unless the operator says
  otherwise; commit message style: `Plan 056: make typecheck depend on own
  build` (repo uses plain imperative subjects, see `git log --oneline -10`).

## Steps

### Step 1: Try to reproduce and capture the error text (time-boxed)

Run up to 10 forced, uncached root typechecks and save output:

```bash
for i in $(seq 1 10); do
  bunx turbo typecheck --force > "/tmp/typecheck-run-$i.log" 2>&1 || { echo "FAILED on run $i"; break; }
done
grep -l "Failed" /tmp/typecheck-run-*.log
```

If a run fails, extract the toolkit error lines
(`grep -A20 "adapters-toolkit:typecheck" /tmp/typecheck-run-N.log`) and paste
them into this plan file under a new "## Captured failure" heading — that
recording is the reproduction evidence. If no run fails, that's fine (the
race is timing-dependent); proceed to Step 2 regardless — the ordering fix
is correct whether or not the race fires today.

**Verify**: the loop ran; any captured error text is recorded in this file.

### Step 2: Order each package's typecheck after its own build

In `turbo.json`, change the `typecheck` task to also depend on the package's
own `build`, matching the existing `test` task convention:

```json
"typecheck": {
  "dependsOn": ["build", "^build"],
  "outputs": []
},
```

This removes every window in which `tsdown` cleans/rewrites a `dist/` that a
concurrently running `tsc --noEmit` in the same graph may resolve into:
within a package, typecheck now runs strictly after its own build; across
packages, `^build` (already present) plus the build graph's own `^build`
chain guarantees upstream `dist/` directories are complete before any
dependent's typecheck starts.

**Verify**: `bun run typecheck` → exit 0. Inspect the log: for the toolkit
package, the `build` task's output must complete before
`adapters-toolkit:typecheck: $ tsc --noEmit` appears.

### Step 3: Stability loop

```bash
for i in $(seq 1 10); do bunx turbo typecheck --force >/dev/null 2>&1 || echo "FAILED on run $i"; done; echo done
```

**Verify**: prints only `done` — zero `FAILED` lines.

### Step 4: Confirm no regression in wall-clock or tests

- Time one cold root typecheck (`time bunx turbo typecheck --force`) and
  record the number in your report — expect low tens of seconds; the added
  serialization is per-package only.
- `bun run test` → all suites pass (turbo graph unchanged for tests).

**Verify**: both commands exit 0.

## Test plan

No unit tests — this is build-graph configuration. The verification is the
Step 3 stability loop (10 consecutive forced runs green). Record the loop
output in the PR/commit description.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `turbo.json` `typecheck.dependsOn` equals `["build", "^build"]` **plus a
  `@better-tables/site#typecheck` override of `["^build"]`** (see "Resolution
  deviation" — the literal one-liner alone tripped STOP condition #2)
- [x] `bun run typecheck` exits 0
- [x] 10 consecutive `bunx turbo typecheck --force` runs exit 0 (Step 3 loop
  prints no FAILED) — verified after the refinement
- [x] `bun run test` exits 0
- [x] Only `turbo.json` modified for the ordering itself (guard test + ledger
  updates are separate commits for separate tasks in this session)
- [x] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A Step 3 run fails **after** the Step 2 change — capture the full toolkit
  error text. That would falsify the same-package-ordering diagnosis and
  point at turbo cache **restoration** corruption instead (a cached
  `dist/**` being replayed non-atomically); the fix for that is different
  (investigate `outputs` correctness / turbo version bump), and it should be
  decided by a human, not improvised.
- The Step 2 change makes the root typecheck take dramatically longer
  (> ~2× the Step 1 baseline) — report the timing rather than reverting
  silently.

## Captured failure (execution, 2026-07-21)

Two independent forced stability loops (10 + 12 runs) each produced ONE
failure — but NOT in the toolkit and NOT cache-restoration corruption. Both
failures were the **marketing site** typecheck:

```
@better-tables/site:build: ✓ Compiled successfully in 32.8s
@better-tables/site:typecheck: $ next typegen && tsc --noEmit
@better-tables/site:typecheck: ✓ Types generated successfully
@better-tables/site:typecheck: src/lib/source.ts(1,22): error TS2306: File
  '/home/user/better-tables/apps/marketing/.source/server.ts' is not a module.
Failed:    @better-tables/site#typecheck
```

Root cause of the failure (distinct from the toolkit race this plan targets):
adding `build` to the global `typecheck` task pulled **`@better-tables/site#build`
(a full `next build`, ~33s)** into the `bun run typecheck` graph — the task
list went from the expected 10 to 12 (`+cli#build`, `+site#build`). The
fumadocs `.source/` directory is regenerated by the Next build / `next
typegen`; when `next build` participates in the same forced run, the
marketing `tsc` intermittently reads a half-rewritten `.source/server.ts`
(TS2306). The marketing typecheck run **in isolation is 8/8 clean** — the
flake only appears once `next build` is in the graph. The toolkit typecheck
itself passed **all 22 forced runs** — this plan's actual diagnosis holds.

This tripped STOP condition #2 (dramatically longer: a full Next production
build was now part of typecheck).

## Resolution deviation (approved 2026-07-21)

The literal `["build", "^build"]` change is kept for the library packages
(which is where the tsdown `dist/` race lives), but a per-package override
keeps the marketing site's typecheck off its own expensive, race-inducing
Next build:

```json
"typecheck": {
  "dependsOn": ["build", "^build"],
  "outputs": []
},
"@better-tables/site#typecheck": {
  "dependsOn": ["^build"],
  "outputs": []
},
```

`@better-tables/site#typecheck` needs only upstream library `dist/` (`^build`)
— it runs `next typegen && tsc`, it does not consume its own `.next` output —
so excluding `site#build` removes both the slowdown and the `.source` flake
while preserving the plan's goal (every library package's typecheck runs
strictly after its own tsdown build). Post-refinement the toolkit ordering is
unchanged; the graph drops `site#build` and keeps the cheap `cli#build`.

## Maintenance notes

- If a future task ever needs "typecheck without building" (e.g. a fast CI
  lane), add a separate task name rather than weakening this ordering.
- The marketing `.source` race (`next typegen && tsc` reading a
  mid-regeneration `.source/server.ts`) is a **separate, pre-existing**
  marketing-only issue, now un-exposed by the override rather than fixed. If
  it ever resurfaces, fix it in `apps/marketing` (e.g. make `.source`
  generation complete before `tsc`), not in `turbo.json`.
- Reviewer scrutiny: just the one-line diff and the recorded stability loop.
- Related but deliberately untouched: `tsdown`'s clean step. If tsdown ever
  gains an atomic-write mode, the ordering here is still correct — keep it.
