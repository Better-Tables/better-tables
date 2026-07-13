# Plan 001: Make CI gate every package with typecheck, lint, and tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- .github/workflows/test.yml package.json turbo.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 012 + 013 (HARD — an execution attempt on 2026-07-12 hit STOP conditions: the repo baseline itself is broken; 012 fixed install+CLI, 013 finishes typecheck/lint; do not start until 013 shows DONE)
- **Category**: dx
- **Planned at**: commit `55dfd01`, 2026-07-12; revised 2026-07-12 after a blocked execution attempt

> **Revision note (2026-07-12)**: a first execution stopped at Step 5 because (a) `bun install --frozen-lockfile` fails at HEAD (bun.lock out of sync with `packages/cli/package.json` — commander ^14.0.2 vs locked 12.1.0), meaning existing CI jobs fail at install today; (b) root `tsc --noEmit` reports 314 pre-existing errors (whole-tree tsc can't resolve per-app `@/*` aliases); (c) `bunx biome check .` reports 163+ pre-existing errors. Plan 012 repairs all three. Do not start this plan until 012 shows DONE in `plans/README.md`. A reference diff of Steps 1–4 (verified individually) exists in the blocked executor's worktree branch `worktree-agent-ac9e43cf1d2219eaa` — redoing them fresh is fine too, they're small.

## Why this matters

The CI workflow only triggers on changes to `packages/core/**` and `packages/adapters/**`, and even when it runs it executes `bun test` only — no typecheck, no lint, no build. A PR that touches only `packages/ui` or `packages/cli` triggers **no workflow at all**, which is how real bugs in the UI hooks (see plans 010) merged unverified. The UI package has zero tests today, so type-checking is the only automated signal it can get. Every other plan in this directory relies on CI to prove it didn't break anything; this plan is the verification baseline and should land first.

## Current state

- `.github/workflows/test.yml` — the only test workflow. Both `pull_request` and `push` triggers filter paths to:

  ```yaml
  # .github/workflows/test.yml:8-14 (same list repeated for push at :19-25)
  paths:
    - 'packages/core/**'
    - 'packages/adapters/**'
    - 'package.json'
    - 'bun.lock'
    - 'turbo.json'
    - '.github/workflows/test.yml'
  ```

  `packages/ui/**`, `packages/cli/**`, and `apps/**` are absent.

- Jobs: `test-core` (working-directory `packages/core`) and `test-adapters` (working-directory `packages/adapters/drizzle`, with MySQL 8 and Postgres 16 service containers). Each runs only `bun test`. Bun is set up with:

  ```yaml
  # .github/workflows/test.yml:44-47
  - name: Setup Bun
    uses: oven-sh/setup-bun@v2
    with:
      bun-version: latest
  ```

  `latest` is non-reproducible — a Bun release can change CI behavior with no repo change.

- Root `package.json` scripts (the commands CI should call): `"typecheck": "tsc --noEmit"`, `"test": "turbo run test"`, `"build": "turbo run build"`. NOTE: the root `"lint"` script is `biome check --write --unsafe .` — it **mutates files**; CI must use the check-only form `bunx biome check .` (package-level `lint` scripts, e.g. `packages/core/package.json`, are already check-only `biome check .`).
- Per-package scripts: `packages/core`, `packages/ui`, `packages/cli`, `packages/adapters/drizzle` all define `"test": "bun test"` and `"typecheck": "tsc --noEmit"`.
- `packages/cli` has 8 test files (`packages/cli/tests/*.test.ts`) that CI never runs. `packages/ui` has none (expected — don't add a UI test job step that fails on "no tests"; `bun test` exits non-zero when no test files match, so gate UI with typecheck/lint only until plan 010 adds tests).
- The root `packageManager` field pins `bun@1.3.1` — use that exact version for the CI pin.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `bun install` (repo root)        | exit 0              |
| Typecheck | `bun run typecheck` (root)       | exit 0, no errors   |
| Lint (check-only) | `bunx biome check .`     | exit 0              |
| Core tests | `cd packages/core && bun test`  | all pass            |
| CLI tests | `cd packages/cli && bun test`    | all pass            |
| Workflow syntax | `bunx yaml-lint .github/workflows/test.yml` or push to a branch and check Actions tab | parses |

Note: the drizzle adapter's Postgres/MySQL integration tests need the service containers; locally they may fail without `POSTGRES_TEST_URL`/`MYSQL_TEST_URL` (see `.env.example`). Do not treat local adapter-test failures caused by missing databases as a regression — CI provides the services.

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/test.yml`

**Out of scope** (do NOT touch, even though they look related):
- `.github/workflows/release.yml` and `stale.yml` — release automation is riskier and not part of this finding.
- Adding tests to `packages/ui` — that is plan 010.
- Root `package.json` scripts — changing the mutating `lint` script is a behavior change for local workflows; CI just avoids it.

## Git workflow

- Branch: `ci-gate-all-packages` (repo convention: short kebab topic branches, e.g. `adapter-relationship`, `filters`)
- Commit style: imperative sentence, e.g. "Gate all packages in CI with typecheck, lint, and tests" (matches history like "Enhance type safety in DrizzleAdapter by refining schema filtering")
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Broaden the path filters

In `.github/workflows/test.yml`, add to BOTH the `pull_request.paths` and `push.paths` lists:

```yaml
    - 'packages/ui/**'
    - 'packages/cli/**'
    - 'tsconfig.json'
    - 'biome.json'
```

**Verify**: `grep -c "packages/ui/\*\*" .github/workflows/test.yml` → `2`

### Step 2: Pin Bun

Replace both occurrences of `bun-version: latest` with `bun-version: '1.3.1'` (match root `packageManager`). Note for the reviewer in the commit body that future Bun bumps happen via this pin plus the `packageManager` field together. (Dependency caching was dropped from this step — `oven-sh/setup-bun@v2` has no dependency-cache input and `bun install` is fast; an `actions/cache` layer on `~/.bun/install/cache` is an optional follow-up, not part of this plan.)

**Verify**: `grep -c "bun-version: latest" .github/workflows/test.yml` → `0`; `grep -c "bun-version: '1.3.1'" .github/workflows/test.yml` → (number of setup-bun blocks, ≥2)

### Step 3: Add a repo-wide static-checks job

Add a new first job `static-checks` that runs from the repo root:

```yaml
  static-checks:
    name: Typecheck & Lint (all packages)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: '1.3.1'
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Typecheck
        run: bun run typecheck
      - name: Lint (check only)
        run: bunx biome check .
```

Use check-only biome (see Current state — the root `lint` script mutates).

**Verify**: workflow YAML parses (push branch, or `bunx js-yaml .github/workflows/test.yml >/dev/null` → exit 0)

### Step 4: Add a CLI test job

Mirror the `test-core` job shape for `packages/cli` (working-directory `packages/cli`, install from root, `bun test`). No service containers needed.

**Verify**: `cd packages/cli && bun test` locally → all 8 test files pass

### Step 4b: Include the new jobs in `test-summary`

The workflow ends with a pre-existing `test-summary` aggregation job whose `needs:` lists only `[test-core, test-adapters]`. If branch protection keys off `test-summary` rather than individual job statuses, the new gates would never actually block merges. Add `static-checks` and the CLI job to its `needs:` array and to whatever per-job status reporting the summary body does (read the job — mirror its existing pattern for the two new entries).

**Verify**: `grep -A2 "needs:" .github/workflows/test.yml | grep -c "static-checks"` → ≥ 1; YAML still parses (`bunx js-yaml .github/workflows/test.yml >/dev/null` → exit 0)

### Step 4c: Lint gate policy

If plan 012's report documented residual biome diagnostics (nonzero after its sweep), set `continue-on-error: true` on the `static-checks` lint step with a `# TODO: make blocking once biome residue is cleared (see plans/012 report)` comment; if 012 got the count to zero, leave the lint step blocking.

**Verify**: the lint step's blocking-ness matches 012's reported residue.

### Step 5: Confirm the whole workflow is coherent

Run the full local equivalent from the repo root:

```
bun install && bun run typecheck && bunx biome check . && (cd packages/core && bun test) && (cd packages/cli && bun test)
```

**Verify**: exit 0. If `bun run typecheck` fails on pre-existing errors unrelated to your change, STOP (see STOP conditions) — the baseline itself is broken and that must be reported, not patched around silently.

## Test plan

This plan is CI config; its "tests" are the gates themselves. After merging (or on the PR), confirm in the Actions tab that: a change under `packages/ui/**` triggers the workflow; `static-checks`, `test-core`, `test-adapters`, and `test-cli` all run and pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "packages/ui/\*\*" .github/workflows/test.yml` → 2 (pull_request + push)
- [ ] `grep -c "bun-version: latest" .github/workflows/test.yml` → 0
- [ ] Workflow contains jobs: `static-checks`, `test-core`, `test-adapters`, and a CLI test job
- [ ] `bun run typecheck` exits 0 at root
- [ ] `bunx biome check .` exits 0 (or only pre-existing, reported diagnostics)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `bun run typecheck` at root fails on code you did not touch — the repo baseline is broken; report the errors instead of adding excludes or `skipLibCheck` hacks.
- `bunx biome check .` reports more than ~20 pre-existing diagnostics — decide-with-human whether CI should start non-blocking (`continue-on-error`) for lint.
- `packages/cli` tests fail locally on a clean checkout.

## Maintenance notes

- When plan 010 adds UI tests, add a `test-ui` job (or fold into a matrix) — the typecheck-only gate for UI is a stopgap.
- The Bun pin must be bumped together with root `packageManager`; drift between them will confuse local-vs-CI behavior.
- Reviewers should watch that nobody re-introduces the mutating `biome check --write` into CI.
