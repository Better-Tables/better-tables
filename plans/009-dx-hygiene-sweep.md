# Plan 009: DX hygiene sweep — truthful README, publishable packages, talking CLI, agent onboarding

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- README.md tsconfig.json packages/ui/package.json packages/adapters/drizzle/package.json packages/cli/src/commands/init.ts packages/ui/tsdown.config.ts .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (many small, independent fixes — steps can be separate commits)
- **Risk**: LOW–MED (packaging changes need verification; everything else is docs/config truth-telling)
- **Depends on**: none (001 recommended so CI covers the touched packages)
- **Category**: dx / docs
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

The first five minutes of a new user's experience currently fail: the README quick-start imports a package that is `"private": true` and not on npm, links to a `docs/` directory that doesn't exist, and advertises `memory`/`rest`/`pro` packages that aren't in the repo. The flagship CLI onboarding command prints nothing — it exits code 1 with no message on every failure path. The Drizzle adapter forces every consumer (including Postgres users) to compile the native `better-sqlite3` addon and bundles its own copy of `drizzle-orm`, and the UI package defeats tree-shaking and RSC usage. For a project whose stated goal is "the best DX in the world," these are the cheapest, highest-visibility wins in the repo.

## Current state

All verified at commit `55dfd01`:

1. **Phantom docs/packages.** `README.md:330-348` links `docs/GETTING_STARTED.md`, `docs/core/USER_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/CONTRIBUTING.md`, etc. — there is no `docs/` directory. `README.md:8` badge links `CONTRIBUTING.md` — doesn't exist. `README.md:498-508` status table: `@better-tables/adapters-memory` "✅ Ready", `@better-tables/adapters-rest` "🚧 In Progress", `@better-tables/pro` "📋 Planned" — none exist (`packages/adapters/` contains only `drizzle`). `README.md:197-205` shows a `RestAdapter` import example. `README.md:70` tells users to `bun add @better-tables/adapters-rest`.
2. **Phantom tsconfig paths.** Root `tsconfig.json` `paths` maps `@better-tables/rest`, `@better-tables/memory`, `@better-tables/pro` to non-existent directories.
3. **Unpublishable UI package.** `packages/ui/package.json` has `"private": true` (plus an ineffective `publishConfig`); README quick-start does `import { BetterTable } from '@better-tables/ui'` and the status table says "✅ Ready".
4. **Wrong dependency classes.** `packages/adapters/drizzle/package.json`:

   ```json
   "dependencies": {
     "better-sqlite3": "^12.4.6",
     "drizzle-orm": "^0.45.1"
   },
   ```

   while `postgres`/`mysql2` are correctly peers. A bundled `drizzle-orm` risks type/instance mismatch with the consumer's copy; `better-sqlite3` is a native addon all consumers must build.
5. **Silent CLI.** `packages/cli/src/commands/init.ts` contains **zero** `console.*` calls; empty `if (isNextJS) { } else { }` branches, silent `process.exit(1)` on invalid path / missing shadcn / install failure / missing config. Other CLI files use `picocolors` — the convention exists (check `packages/cli/src` siblings for the styling pattern). **Update 2026-07-13 (plan 013, commit `7b01cb5`)**: the four dead bindings this plan's audit cited as evidence (`isTypeScript`, `_componentsBasePath`, `_successful`, `_aliasPrefix`) were DELETED to unblock typecheck, along with their orphaned `join`/`getAliasPrefix` import specifiers — line numbers in this section have shifted, and Step 6 must RECOMPUTE those values (e.g. `results.filter((r) => r.success && !r.skipped).length` for the summary count, re-importing what it needs) rather than expecting the variables to exist. The empty branches/loops remain.
6. **Tree-shaking/RSC.** No `sideEffects` field in any package.json (core, ui, cli, drizzle). `packages/ui/tsdown.config.ts` bundles a single entry with a global banner:

   ```typescript
   entry: ['src/index.ts'],
   ...
   banner: { js: '"use client";' },
   ```

   so the entire package is one client-boundary chunk; per-file `'use client'` directives already exist in the component sources (45 files).
7. **Misleading env example.** Root `.env.example` documents only `MYSQL_TEST_URL`/`POSTGRES_TEST_URL` (drizzle integration-test URLs, placeholder credentials) with nothing telling a newcomer the demo app (`apps/demo`, SQLite + seed) needs no env at all.
8. **No agent/contributor onboarding.** No `CLAUDE.md`, `AGENTS.md`, or root `CONTRIBUTING.md`. The de-facto knowledge base is a 504 KB `wiki.md` at repo root — unusable as working context.
9. **React version claim.** `README.md:6` badge says "React 18+"; the workspace catalog pins `react: ^19.2.0` and packages reference `"react": "catalog:"` in peerDeps. Decide the truth (see Step 4).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                | exit 0              |
| Typecheck | `bun run typecheck` (root)               | exit 0              |
| Build     | `bun run build` (root)                   | exit 0              |
| CLI tests | `cd packages/cli && bun test`            | all pass            |
| Link check| `grep -oE '\]\((docs/[^)]+|CONTRIBUTING.md)\)' README.md` | 0 matches after fix |
| Publish dry-run | `cd packages/adapters/drizzle && bun pm pack --dry-run` (or `npm pack --dry-run`) | manifest sane |

## Scope

**In scope**:
- `README.md`
- `tsconfig.json` (root — remove 3 phantom paths)
- `packages/ui/package.json`, `packages/ui/tsdown.config.ts`
- `packages/core/package.json`, `packages/cli/package.json`, `packages/adapters/drizzle/package.json` (sideEffects + dependency classes)
- `packages/cli/src/commands/init.ts` (+ its tests in `packages/cli/tests/`)
- `.env.example` (move/annotate) and `packages/adapters/drizzle/.env.example` (create)
- `CLAUDE.md`, `CONTRIBUTING.md` (create at root)
- `.changeset/*.md`

**Out of scope** (do NOT touch):
- `wiki.md` content (distill FROM it; don't edit it)
- Deleting or restructuring `apps/marketing`/`apps/web`
- The decision to actually publish `@better-tables/ui` to npm — this plan makes the README truthful about TODAY's distribution and removes the `private` flag ONLY if the maintainer's distribution answer is "publish" (see STOP conditions / Step 3)
- Per-component subpath exports for ui (larger packaging redesign; record as follow-up)

## Git workflow

- Branch: `dx-hygiene-sweep`
- One commit per numbered step (they're independently revertable); style: imperative sentence, e.g. "Make README reflect shipped packages only"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Truthful README

Remove/rewrite: every `docs/*` link (link to existing `packages/*/README.md` and `packages/adapters/drizzle/docs/ADVANCED_USAGE.md`, `packages/ui/docs/URL_SYNC.md` instead); the status table (keep rows only for `core`, `ui`, `cli`, `adapters-drizzle` with honest statuses; move memory/rest/pro to a "Roadmap" bullet list explicitly marked not-yet-started); the `RestAdapter` example (`:197-205`) and `bun add @better-tables/adapters-rest` (`:70`); the `// TODO: UI package will a CLI...` line (`:76`) — replace the quick-start with the actual working path (see Step 3's outcome). Keep tone/structure otherwise.

**Verify**: `grep -nE "adapters-rest|adapters-memory|better-tables/pro|RestAdapter" README.md` → 0 matches; `grep -oE '\]\(docs/[^)]+\)' README.md` → 0 matches

### Step 2: Prune phantom tsconfig paths

Remove the `@better-tables/rest`, `@better-tables/memory`, `@better-tables/pro` entries from root `tsconfig.json` `paths`.

**Verify**: `bun run typecheck` (root) → exit 0 (nothing imported them; if something does, STOP)

### Step 3: Resolve the ui distribution contradiction

Default assumption (verify against any maintainer note in `plans/README.md` before executing): the CLI copy-flow is the intended distribution (shadcn-style), matching the CLI's existence and the README TODO. Under that assumption: keep `"private": true`, delete the ineffective `publishConfig` from `packages/ui/package.json`, and rewrite the README quick-start to the CLI flow (`bunx @better-tables/cli init` — verify the actual binary name in `packages/cli/package.json` `bin` field first). If instead the maintainer wants ui on npm, the step is the inverse (remove `private`, verify `catalog:` peer ranges are rewritten on publish by testing `bun pm pack --dry-run` in `packages/ui`). Either way the README and the manifest must stop contradicting each other.

**Verify**: README quick-start names only installable-or-copyable things; `node -e "const p=require('./packages/ui/package.json'); if(p.private && p.publishConfig) process.exit(1)"` → exit 0

### Step 4: Correct the React support claim

The catalog pins `react: ^19.2.0`, so published peer ranges resolve to React 19-only. DECIDED per the RELEASE POLICY in `plans/README.md` (2026-07-12, breaking-is-fine): change the badge to "React 19+" and do NOT widen the catalog — supporting React 18 is a compatibility burden the project explicitly declines pre-1.0. Do not add an 18-compat footnote; the migration guide states React 19 as a requirement.

**Verify**: README badge matches the effective peer range; `bun install` clean

### Step 5: Fix dependency classes in the drizzle adapter

In `packages/adapters/drizzle/package.json`: move `drizzle-orm` from `dependencies` to `peerDependencies` (range `>=0.44 <0.46` — verify the adapter compiles against the low bound only if convenient; otherwise pin `^0.45.0` and say so), keep it in `devDependencies` for local dev/tests; move `better-sqlite3` to `devDependencies` only, and add `peerDependenciesMeta` marking driver packages (`better-sqlite3`, `postgres`, `mysql2`) optional. Add a changeset (minor — dependency-resolution behavior changes for consumers).

**Verify**: `bun install` at root → exit 0; `cd packages/adapters/drizzle && bun run typecheck && bun test` → SQLite suites pass; `node -e "const p=require('./packages/adapters/drizzle/package.json'); if(p.dependencies && (p.dependencies['drizzle-orm']||p.dependencies['better-sqlite3'])) process.exit(1)"` → exit 0

### Step 6: Make `init` talk

Restore user feedback in `packages/cli/src/commands/init.ts` following the picocolors style used by sibling CLI files: a progress line per step (project detection result, shadcn check, package installs, config resolution, files copied), a summary block (empty category/failed-results loops remain in the file as the intended emission points — fill them; note the summary VALUES must be recomputed since plan 013 deleted the dead `_successful`/`_aliasPrefix`/`_componentsBasePath` bindings and their orphaned imports — see Current state item 5), and an error message with remediation before **every** `process.exit(1)` (7 sites, e.g. shadcn missing → "Run `bunx shadcn@latest init` first"). Extend `packages/cli/tests/` (see existing `cli.test.ts` patterns for output capture) with: failure paths print to stderr and exit 1; success path prints a summary containing the copied-file count.

**Verify**: `cd packages/cli && bun test` → all pass including new output assertions; `grep -c "console\.\|log(" packages/cli/src/commands/init.ts` → > 0

### Step 7: Tree-shaking + RSC packaging

Add `"sideEffects": false` to `packages/core/package.json`, `packages/ui/package.json`, `packages/adapters/drizzle/package.json` (first `grep -rn "^import ['\"]" packages/<pkg>/src --include="*.ts*"` in each to confirm no bare side-effect imports — CSS imports would need listing as exceptions). In `packages/ui/tsdown.config.ts`, remove the global `banner: { js: '"use client";' }` and rely on the per-file directives — then verify the built output preserves them (`bun run build`, then `grep -rl '"use client"' packages/ui/dist/ | head`; tsdown/rolldown must keep leading directives — if the built files do NOT contain the directives, revert the banner removal and record the blocker). Build `apps/demo` against the result as the smoke test.

**Verify**: `bun run build` → exit 0; directives present in `packages/ui/dist`; `cd apps/demo && bun run build` (Next build) → exit 0

### Step 8: Env example + onboarding docs

Move DB test URLs to `packages/adapters/drizzle/.env.example` with a comment ("integration tests only; SQLite tests need nothing"); shrink root `.env.example` to a pointer comment. Create root `CLAUDE.md` (≤120 lines): package map + data flow one-liner (columns → adapter → ui), the command table (install/typecheck/test/lint/build, per-package `bun test`), test-suite locations, the mutating-root-lint caveat, published-vs-private package list, link to `wiki.md` sections by heading for deep dives. Create `CONTRIBUTING.md` (setup, branch/commit conventions from git history, changeset requirement, PR checklist) and fix the README badge link to it.

**Verify**: files exist; `wc -l CLAUDE.md` ≤ 120; README `CONTRIBUTING.md` link resolves (`test -f CONTRIBUTING.md`)

## Test plan

CLI output tests (Step 6) are the only new automated tests. Packaging steps verify via build + demo build + pack dry-runs as specified per step. README/docs steps verify via greps in Done criteria.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -nE "adapters-rest|adapters-memory|better-tables/pro" README.md tsconfig.json` → 0 matches
- [ ] `test -f CLAUDE.md && test -f CONTRIBUTING.md` → pass
- [ ] `grep -c "console\." packages/cli/src/commands/init.ts` → > 0; CLI tests pass
- [ ] drizzle package.json: `drizzle-orm`/`better-sqlite3` not in `dependencies`
- [ ] `"sideEffects": false` present in core/ui/drizzle package.json
- [ ] `bun run typecheck && bun run build` (root) exit 0; `cd apps/demo && bun run build` exit 0
- [ ] `.changeset/*.md` exists covering drizzle dep-class and ui packaging changes
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 3: you cannot determine the intended ui distribution model and the CLI's `init` doesn't actually copy ui components (inspect what it copies — `packages/cli/src` config/registry) — the README rewrite then has no truthful quick-start to point at; report both options with evidence.
- Step 5: moving `drizzle-orm` to peers breaks type resolution in the adapter build (peer + devDep should suffice; if not, report the tsdown/bun behavior).
- Step 7: built output loses `'use client'` directives (known bundler footgun) — revert that sub-change, keep the banner, record the blocker; do NOT ship a ui build without client directives.
- Any step reveals the demo app doesn't build even before your changes — report baseline breakage.

## Maintenance notes

- Follow-up (recorded in `plans/README.md`, not planned): per-component subpath exports for `@better-tables/ui` so `calendar`/`command`/dnd stop shipping to consumers who don't use them.
- CLAUDE.md must be updated when plans 007/008 add packages — reviewers should treat a new package without a CLAUDE.md line as an incomplete PR.
- The README status table will drift again; consider (follow-up) a CI check that every package named in it exists in `packages/`.
