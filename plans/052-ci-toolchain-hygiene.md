# Plan 052: CI & toolchain hygiene — cache CI, clear Biome residue → blocking lint, dep bumps, bun pin, unused deps, next typegen

> **Executor instructions**: Steps are largely independent — commit per step.
> Run every verification; on any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- .github/workflows/test.yml package.json apps/marketing/package.json biome.json bunfig.toml turbo.json`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (flipping lint to blocking gates every future PR)
- **Depends on**: 033 (touches test.yml + package.json; land 033 first, then rebase)
- **Category**: dx / dependencies
- **Planned at**: commit `787a816`, 2026-07-17
- **Maintainer decisions (2026-07-17)**: (1) NO git hooks — clear the Biome
  residue and flip CI's lint step to **blocking** instead. (2) Align the bun
  pin (`packageManager` + CI) up to the current local bun (**≥1.3.11**), so CI
  exercises the same isolated-linker environment the `bunfig.toml` workaround
  targets.

## Why this matters

Several tooling gaps make CI slow and its guarantees soft:

- **PERF-02/DX-02**: five CI jobs each cold-run `bun install --frozen-lockfile`
  with zero dependency caching, plus `test-ui`/`test-adapters` each rebuild
  core — the dominant redundant cost per run.
- **DX-03 / lint**: CI's lint step is `continue-on-error: true` (intentional
  until Biome residue hits 0). Residue is currently **44 errors + 78 warnings**
  — clearing it lets lint become a real gate.
- **DEPS-02**: postcss `<8.5.10` (moderate XSS) and turbo (`<2.9.14`
  CSRF/RCE) advisories — in-range bumps that also update currency (turbo
  2.6→2.10).
- **DEBT-07**: `usehooks-ts` + `react-icons` declared but unused in
  `apps/marketing`.
- **Bun pin drift**: `packageManager` + both workflows pin `bun@1.3.1`; local
  dev is on ≥1.3.11 (where the `bunfig.toml` `linker="hoisted"` fix matters) —
  CI never exercises that environment.
- **next typegen poisoning**: `apps/marketing` typecheck (`tsc --noEmit`) can
  be poisoned by a stale `.next/types/validator.ts` referencing deleted routes.

## Current state

Verified at `787a816`:

- `.github/workflows/test.yml`: jobs `static-checks`, `test-core`, `test-cli`,
  `test-ui`, `test-adapters`; each runs `bun install --frozen-lockfile`
  (`:48`, `:82`, `:135`, `:188`, `:257`); `grep actions/cache` → none.
  Lint step (`:51-53`): `bunx biome check .` with `continue-on-error: true`.
  `test-ui`/`test-adapters` rebuild core (`:190-194`, `:263-273`). Bun pinned
  `1.3.1` in `setup-bun`.
- `bunx biome check .` → **Found 44 errors, 78 warnings, 3 infos**. (Residue
  is core/cli/adapters per the ledger; marketing + ui are Biome-clean.)
- `bun audit`: postcss `<8.5.10` (moderate), turbo `<2.9.14` (moderate+low).
  Catalog: `postcss ^8.5.6` (`package.json:29`), `turbo 2.6.1` devDep (`:63`).
- `apps/marketing/package.json`: declares `usehooks-ts` + `react-icons` —
  `git grep` in `apps/marketing/` (excluding the manifest) → 0 references.
- `package.json`: `"packageManager": "bun@1.3.1"`; catalog pins.
- `bunfig.toml`: `linker = "hoisted"` (the isolated-linker workaround).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Build | `bun run build` | exit 0 |
| Biome check | `bunx biome check .` | errors → 0 by end |
| Biome safe-fix | `bunx biome check --write .` (per package or root — see Step) | applies safe fixes |
| Typecheck | `bun run typecheck` | exit 0 |
| All tests | `bun run test` | pass |
| Audit | `bun audit` | postcss/turbo advisories cleared |

## Scope

**In scope**:
- `.github/workflows/test.yml` (caching, bun version, lint blocking) +
  `release.yml` (bun version)
- `package.json` (catalog: postcss, turbo; `packageManager` bun pin)
- `apps/marketing/package.json` (remove unused deps; optionally prepend
  `next typegen` to its typecheck)
- Source/test files ONLY as needed to clear Biome residue (mechanical
  lint fixes — no behavior change)
- `bun.lock` (regenerated); `.changeset/*.md` if a published package's build
  deps changed materially (usually none — dev tooling); `plans/README.md`

**Out of scope**:
- Git hooks (maintainer declined).
- TypeScript 7 / other major-version holds (deliberate).
- Behavior changes disguised as lint fixes — if Biome's safe fix would change
  runtime behavior, STOP.

## Git workflow

- Branch: `ci-toolchain-hygiene`; commits `Plan 052 Step N: …`.

## Steps

### Step 1: CI dependency + build caching

In `test.yml`, add `actions/cache` for `~/.bun/install/cache` keyed on
`hashFiles('bun.lock')` in each job (or a composite/reusable setup step), and
a Turbo cache (cache `.turbo` or use a remote-cacheless local `--cache-dir`
persisted via `actions/cache`) so `typecheck`/`test` skip unchanged packages.
Build `@better-tables/core` once and reuse it across `test-ui`/`test-adapters`
(artifact or shared workspace build) so core is not rebuilt redundantly per job.

**Verify**: workflow YAML is valid; a `git diff` review shows cache keys on
`bun.lock`; core is built once and shared (not rebuilt per dependent job).
(CI timing is verified on the first real run once the remote is restored —
note this.)

### Step 2: Align the bun pin

Bump `packageManager` in root `package.json` and the `setup-bun` `bun-version`
in `test.yml` + `release.yml` to the current local bun (run `bun --version` to
get the exact ≥1.3.11 value; use that). Run `bun install` to confirm the
lockfile is stable under it.

**Verify**: `bun --version` matches the new pins; `bun install` exit 0;
`bun run typecheck` exit 0.

### Step 3: Dependency advisory bumps

Bump catalog `postcss` to `^8.5.10` and `turbo` devDep to `^2.10.5`. Run
`bun install`, then `bun run build` + `bun run typecheck` to confirm turbo
2.6→2.10 didn't break the pipeline.

**Verify**: `bun audit` → postcss + turbo advisories gone; `bun run build` +
`bun run typecheck` exit 0.

### Step 4: Remove unused marketing deps

Remove `usehooks-ts` + `react-icons` from `apps/marketing/package.json`. Run
`bun install` + `cd apps/marketing && bun run build` (or typecheck) to confirm
nothing imported them.

**Verify**: `git grep -n "usehooks-ts\|react-icons" apps/marketing/src` → 0;
marketing build/typecheck exit 0.

### Step 5: Clear Biome residue

Run `bunx biome check --write .` at the ROOT ONCE to apply SAFE fixes (this is
the sanctioned way to reduce residue; the CLAUDE.md warning is about using it
as a "just check" — here we're intentionally fixing). Review the diff: keep
only mechanical lint fixes; if `--write` changed anything that looks like a
behavior change, revert that file and fix it by hand or leave it. For the
remaining errors that `--write` can't fix, fix them by hand (or, for a small
number of genuinely-must-stay cases, add a scoped `biome-ignore` with a
reason comment). Goal: `bunx biome check .` → 0 errors (warnings may remain if
the team accepts them, but errors must be 0 to flip lint blocking).

**Verify**: `bunx biome check .` → 0 errors; `bun run test` → all suites pass
(confirming the lint fixes didn't change behavior); `bun run typecheck` exit 0.

### Step 6: Flip CI lint to blocking

In `test.yml`, remove `continue-on-error: true` from the lint step (and delete
the stale TODO comment). Now a lint error fails CI.

**Verify**: the lint step has no `continue-on-error`; `bunx biome check .` → 0
errors (so the gate would pass).

### Step 7 (optional): next typegen before marketing typecheck

Prepend `next typegen &&` to `apps/marketing`'s `typecheck` script (or add a
pre-step) so a stale `.next/types/validator.ts` can't poison it. Only if it
works cleanly with the pinned Next 16.

**Verify**: `rm -rf apps/marketing/.next && cd apps/marketing && bun run typecheck`
→ exit 0.

### Step 8: Gates + changeset + ledger

Full `bun run typecheck` + `bun run test` + `bun audit`. Changeset only if a
published package's shipped deps changed (postcss/turbo are dev/build tooling
— usually no changeset). Update plan 052 row.

## Test plan

- No new unit tests. The guards are: `bunx biome check .` = 0 errors (Step 5),
  `bun audit` clean of postcss/turbo (Step 3), full `bun run test` still green
  after lint fixes (Step 5).
- CI caching + timing verified on the first real CI run (post-remote-restore).

## Done criteria

- [ ] `test.yml` caches `~/.bun/install/cache` (keyed on bun.lock) + turbo cache; core not rebuilt redundantly
- [ ] `packageManager` + both workflows pin the current bun (≥1.3.11)
- [ ] `bun audit` → no postcss/turbo advisories; bumps applied in the catalog
- [ ] `usehooks-ts` + `react-icons` removed from marketing; build clean
- [ ] `bunx biome check .` → 0 errors; CI lint step no longer `continue-on-error`
- [ ] `bun run typecheck` + `bun run test` → green
- [ ] `plans/README.md` updated

## STOP conditions

- Biome `--write` (Step 5) changes behavior (not just style) in any file —
  revert that file, report, and fix by hand; do not accept a behavioral diff
  as a "lint fix".
- turbo 2.6→2.10 breaks the pipeline (task config incompatibility) — pin to
  the advisory-fix version (2.9.14) instead of latest and report.
- Clearing all 44 errors uncovers a case where the only fix is a real code
  change with risk — leave that one as a scoped `biome-ignore` with a reason
  and note it; don't block the whole plan on one thorny rule.
- Aligning the bun pin surfaces a lockfile churn or linker regression — report;
  the whole point is CI matching local, so a divergence is itself the finding.

## Maintenance notes

- Once lint is blocking, the ledger's long-standing "flip lint blocking when
  residue hits 0" carry-forward is DONE — remove it from the ledger notes.
- CI caching correctness is verified on the first post-remote-restore run;
  watch the first few runs for cache-key thrash.
- Reviewer scrutiny: Step 5's diff must be lint-only (no behavior), and the
  bun-pin bump must keep `bun.lock` stable.
