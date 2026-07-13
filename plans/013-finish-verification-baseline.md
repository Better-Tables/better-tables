# Plan 013: Finish the verification baseline — per-package typecheck green, script unification, turbo wiring, lint sweep

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. Touch
> only the files listed as in scope. If any STOP condition occurs, stop
> immediately and report. Do not improvise around obstacles. Commit in the
> worktree per the git workflow section. Skip updating `plans/README.md` —
> your reviewer maintains the index. Before reporting, audit every claim in
> your report against an actual tool result from this session.
>
> **Base check (run first — replaces the drift check)**: this plan builds ON
> TOP of plan 012's two approved commits. After cherry-picking them (Step 0),
> `git log --oneline -3` must show "Fix CLI tests for commander 14" and
> "Regenerate bun.lock to match workspace package.json ranges" atop `55dfd01`.
> If the cherry-picks conflict, STOP.

## Status

- **Priority**: P0 (completes the baseline; plan 001 depends on this)
- **Effort**: M–L
- **Risk**: MED (test-file refactors + a dependency dedupe; contained by the suite gates)
- **Depends on**: 012 steps 1–2 (consumed via cherry-pick in Step 0; commits `18b2eb7`, `2f3453a` on branch `repair-verification-baseline`)
- **Category**: bug / dx
- **Planned at**: commit `55dfd01`, 2026-07-12 (evidence from the 012 execution report, same day, reviewer-verified where noted)

## Why this matters

Plan 012 fixed the install-level breakage (lockfile) and the commander-14 test crash, but stopped at its typecheck step because **all four packages fail their own `tsc --noEmit`** with pre-existing errors — almost entirely in test files, which strongly suggests per-package typecheck has never been enforced. Additionally, the workspace's typecheck script names are inconsistent (`typecheck` vs `type-check`), so the intended `turbo run typecheck` would silently skip two packages even once errors are fixed. Until every package typechecks itself and one root command proves it, the "full typesafety" work (plans 005/006/011) has no regression net.

## Current state

Script names — **reviewer-verified 2026-07-12** via grep across all package.json files:

- `packages/core`: BOTH `"typecheck"` (line 22) and `"type-check"` (line 28), duplicates of `tsc --noEmit`
- `packages/ui`: BOTH (lines 23, 27)
- `packages/cli`: ONLY `"type-check"` (line 31)
- `packages/adapters/drizzle`: ONLY `"type-check"` (line 27)
- `apps/marketing`: only `"typecheck"` (line 10)
- `apps/docs`, `apps/marketing`: NEITHER

Per-package typecheck failures — **as reported by the 012 executor** (verify each yourself before fixing; counts may shift slightly):

- `packages/core` (15 errors): 14× TS2445 (protected member access) in `tests/builders/action-builder.test.ts`; 1× TS2349 (expression not callable) in `tests/types/column.test.ts`.
- `packages/ui` (4 errors): TS2322 ref-type mismatches in `src/components/filters/inputs/multi-option-filter-input.tsx`, `src/components/filters/inputs/option-filter-input.tsx`, `src/components/ui/scroll-area.tsx`; the error text shows two different `@types/react`/`csstype` resolution paths — a duplicate-`@types/react` in the dependency tree is the suspected root cause (the workspace catalog pins `@types/react: ^19.1.8`; find where a second copy comes from: `bun why @types/react` or inspect `bun.lock`).
- `packages/cli` (8 errors): all TS6059 ("not under rootDir") — `packages/cli/tsconfig.json` sets `rootDir: src` while its `include` covers `tests/**`; with `noEmit` a `rootDir` this narrow serves no purpose.
- `packages/adapters/drizzle` (20+ errors): TS2341 private-member access in tests; TS2578 unused `@ts-expect-error` directives; TS2769 generic-overload mismatches in `tests/adapter-postgres.test.ts`.

Environment facts from the 012 run you will also hit:

- Fresh worktrees have no `node_modules` and no `dist/`: run `bun install` first, and before running the drizzle test suite build core (`bun run build --filter=@better-tables/core`) or use `turbo run test` (its task `dependsOn: ["build"]`) — "Cannot find module '@better-tables/core'" from the drizzle tests means missing `dist`, not a regression.
- Drizzle Postgres/MySQL integration tests fail locally without `POSTGRES_TEST_URL`/`MYSQL_TEST_URL` (3 failures, ECONNREFUSED/env). Expected; only SQLite suites gate this plan.
- Lint baseline (from the 001 attempt): `bunx biome check .` → 163 errors + 76 warnings + 3 infos (+~222 truncated). The repo's root `lint` script IS the auto-fixer (`biome check --write --unsafe .`).
- `turbo.json` has no `typecheck` task; root `package.json` script is `"typecheck": "tsc --noEmit"` (whole-tree tsc — broken by construction, 314 errors from per-app `@/*` aliases).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`          | exit 0 (after Step 0) |
| Build core (for drizzle tests) | `bun run build --filter=@better-tables/core` | exit 0 |
| Per-package typecheck | `cd packages/<p> && bun run typecheck` | exit 0 |
| Root typecheck (after Step 6) | `bun run typecheck`     | exit 0, turbo fan-out |
| Lint count | `bunx biome check . 2>&1 | tail -5`     | summary line        |
| Lint sweep | `bun run lint` (MUTATES — Step 7 only)  | exit 0              |
| Suites    | `(cd packages/core && bun test)`, `(cd packages/cli && bun test)`, `(cd packages/adapters/drizzle && bun test)` | pass / pass / SQLite pass |

## Scope

**In scope**:
- Step 0 cherry-picks (bun.lock, packages/cli/tests/command-registry.test.ts — arrive as existing commits)
- `packages/*/package.json` and `apps/*/package.json` — script-name unification only
- `packages/cli/tsconfig.json` — the rootDir fix
- Test files: `packages/core/tests/builders/action-builder.test.ts`, `packages/core/tests/types/column.test.ts`, `packages/adapters/drizzle/tests/**` (type-error fixes only)
- `packages/ui` dependency resolution for the `@types/react` dedupe (root `package.json` `overrides`/catalog tweak or `bun.lock` via dedupe — smallest change that yields ONE `@types/react`) and, only if unavoidable, type-level fixes in the three named ui files
- `turbo.json`, root `package.json` (`typecheck` script)
- Files touched by the Step 7 lint sweep (formatting/lint-fix only, dedicated commit)

**Out of scope** (do NOT touch):
- `.github/workflows/test.yml` (plan 001 owns it)
- PRODUCTION source visibility changes (making private/protected members public so tests compile is an API change — STOP condition instead)
- `biome.json` rule changes
- Any dependency version change other than deduplicating `@types/react`/`csstype`
- Fixing `apps/docs`/`apps/marketing` type errors if they have them — those apps get a typecheck script ONLY if it passes; otherwise exclude and document (same rule as 012)

## Git workflow

- Branch: `finish-verification-baseline` (created on top of the Step 0 cherry-picks)
- Commits, in order (separate; split c per package if any diff is large):
  1. (cherry-picked) "Regenerate bun.lock…" and "Fix CLI tests for commander 14"
  2. "Unify typecheck script names across the workspace"
  3. "Fix per-package typecheck errors" — or one commit per package
  4. "Run typecheck per package via turbo"
  5. "Apply biome auto-fixes across the repo" (NOTHING else in it)
- Do NOT push or open a PR.

## Steps

### Step 0: Base on 012's approved commits

`git cherry-pick 18b2eb7 2f3453a` (both exist in the shared local object store). Then `bun install --frozen-lockfile`.

**Verify**: `git log --oneline -3` shows both commits atop `55dfd01`; frozen install → exit 0; `(cd packages/cli && bun test)` → 127 pass.

### Step 1: Unify script names

Every `packages/*` and `apps/*` package.json gets exactly one `"typecheck": "tsc --noEmit"`; delete every `"type-check"` entry. Exception: do NOT add the script to `apps/docs`/`apps/marketing` yet — that's Step 6's conditional. First `grep -rn "type-check" --include="*.json" --include="*.yml" --include="*.md" .` (excluding node_modules) to confirm nothing references the hyphenated name; if CI/docs reference it, update those references in the same commit and say so.

**Verify**: `grep -rn '"type-check"' packages apps --include=package.json` → 0 matches; `grep -c '"typecheck"' packages/core/package.json` → 1.

### Step 2: Fix `packages/cli` tsconfig (TS6059)

Remove or widen `rootDir` in `packages/cli/tsconfig.json` (with `noEmit`, `rootDir` has no output purpose; prefer deleting the field over widening `include`d dirs into `src`). Do not change emitted-build config if the package's build uses a separate tsconfig — check `tsdown` config/`build` script first.

**Verify**: `cd packages/cli && bun run typecheck` → exit 0.

### Step 3: Fix `packages/core` test type errors

`tests/builders/action-builder.test.ts` (14× TS2445 protected access): restructure assertions to observe public behavior — typically asserting on `.build()` output or via a small local `class TestActionBuilder extends ActionBuilder { public exposeConfig() { return this.config } }` test subclass (subclassing keeps `protected` honest without touching production code). `tests/types/column.test.ts` (TS2349): read the failing expression and fix the test's typing. Behavior of the tests must be preserved — same things asserted, now type-cleanly.

**Verify**: `cd packages/core && bun run typecheck` → exit 0 AND `bun test` → all pass (984 baseline).

### Step 4: Fix `packages/adapters/drizzle` test type errors

Delete stale `@ts-expect-error` directives (TS2578 means the error they suppressed is gone). For TS2341 private access, same technique as Step 3 (public-behavior assertions or a test subclass). For the TS2769 overload mismatches in `tests/adapter-postgres.test.ts`, read the failing calls — likely type-argument drift after the drizzle-orm range moved; fix the TEST call sites only.

**Verify**: `cd packages/adapters/drizzle && bun run typecheck` → exit 0 AND `bun test` → SQLite suites pass (build core first if needed).

### Step 5: Fix `packages/ui` type errors via dedupe

Diagnose the duplicate: `bun why @types/react` (or grep `bun.lock` for `@types/react@`). Expected: one copy via the workspace catalog (`^19.1.8`) and a second via some transitive dependency. Prefer, in order: `bun dedupe`-style lockfile consolidation; a root `package.json` `"overrides"` pinning `@types/react`/`@types/react-dom` to the catalog version; only as a last resort, explicit type annotations in the three component files. If the dedupe changes `bun.lock`, keep it in this step's commit with the explanation.

**Verify**: `cd packages/ui && bun run typecheck` → exit 0; `grep -c '"@types/react@' bun.lock` → 1 (or documented why >1 is unavoidable); `bun install --frozen-lockfile` still exit 0.

### Step 6: Turbo wiring

Add `"typecheck": { "outputs": [] }` to `turbo.json` tasks (add `"dependsOn": ["^build"]` only if a package's typecheck provably needs a dependency's `dist` — try without first). Root script → `"typecheck": "turbo run typecheck"`. For `apps/docs` and `apps/marketing`: add the script, run it; if an app fails on pre-existing errors, REMOVE its script again and record the app + first ~10 errors in NOTES (excluded-by-omission, same rule as 012).

**Verify**: `bun run typecheck` (root) → exit 0; turbo output lists a typecheck task for all four packages + `apps/marketing` (+ web/marketing if included).

### Step 7: Lint sweep

Before-count via `bunx biome check . 2>&1 | tail -5`. Run `bun run lint` (the repo's auto-fixer). Re-run the three suite gates (core, cli, drizzle-SQLite) — `--unsafe` fixes can change behavior. Dedicated commit. After-count; if residue remains, do not hand-fix more than ~10 trivial ones; report the residual grouped by rule (`bunx biome check . 2>&1 | grep -oE 'lint/[a-zA-Z/]+' | sort | uniq -c | sort -rn | head`).

**Verify**: after-count captured; suites still green; the sweep commit contains no non-lint changes (`git show --stat HEAD`).

### Step 8: Full baseline confirmation

In order, from root: `bun install --frozen-lockfile` → 0; `bun run typecheck` → 0; `bunx biome check .` → 0 or documented residue; core suite → pass; cli suite → pass; drizzle SQLite suites → pass. Capture all six outputs in the report.

**Verify**: all six recorded; `git log --oneline` shows the commit structure from the git workflow section.

## Test plan

No new tests. The gates are the existing suites, re-run after every mutating step; Steps 3–4 additionally require that the refactored tests still assert the same behaviors (reviewer will read the diffs for assertion-preservation, so keep test intent visibly identical).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn '"type-check"' packages apps --include=package.json` → 0 matches
- [ ] `cd packages/<p> && bun run typecheck` → exit 0 for core, ui, cli, adapters/drizzle
- [ ] `bun run typecheck` (root, turbo) → exit 0
- [ ] `bun install --frozen-lockfile` → exit 0
- [ ] Core suite passes; CLI suite 127+ pass; drizzle SQLite suites pass
- [ ] `bunx biome check .` → exit 0 OR residual documented by rule in the report
- [ ] Commit structure matches the git workflow section; lint sweep isolated
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- Step 0 cherry-picks conflict.
- Any test-type fix (Steps 3–4) cannot preserve the test's assertions without changing PRODUCTION code visibility or behavior — report the specific member and the options (test subclass vs API change) instead of choosing.
- Step 5's dedupe cannot reach one `@types/react` without moving other dependencies' resolved versions (beyond `@types/react`/`@types/react-dom`/`csstype`) — report what else would move.
- A package still fails typecheck after its designated step for reasons OUTSIDE test files and tsconfig (i.e., real production-code type errors) — report the errors; production fixes get their own plan.
- Step 7's sweep breaks a suite and the offending fix isn't obvious — revert the sweep commit and report the rule/files.

## Maintenance notes

- Plan 001 re-runs after this lands (its revision note says so): `static-checks` uses the now-working root typecheck; lint blocking-ness follows Step 7's residue (001 Step 4c).
- The suspicious concentration of type errors in test files means per-package typecheck was likely never run in anger — after 001 lands, it runs on every PR, which is the regression net for plans 005/006/011's type work.
- If web/marketing were excluded in Step 6, that's recorded debt in the index; re-including them requires fixing their errors, not deleting the record.
