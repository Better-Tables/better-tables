# Plan 039: Documentation truth — teach the 0.6 flagship API everywhere, kill dead links

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP condition, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- README.md wiki.md CLAUDE.md packages/core/README.md packages/adapters/drizzle/README.md packages/adapters/drizzle/examples packages/adapters/toolkit SECURITY.md MIGRATION.md`
> On any change, reconcile "Current state" against live content before proceeding.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW (docs + two uncompiled example files; no shipped runtime)
- **Depends on**: none (but 018's flagship API must be current — it is)
- **Category**: docs
- **Planned at**: commit `787a816`, 2026-07-17
- **Maintainer decision (2026-07-17)**: replace `wiki.md` with a **lean,
  hand-written 0.6 handbook** covering exactly the sections `CLAUDE.md`
  points agents at, taught on `betterTables()`/`defineTable()`. Archive the
  old auto-generated wiki out of the agent path. Add an `@deprecated`-style
  JSDoc nudge to `createColumnBuilder`/`defineColumns`.

## Why this matters

The 0.6 rewrite (plan 018) made `betterTables()` + `defineTable()` + path
builders the flagship API and `MIGRATION.md` documents removing the old
per-table surface — but every human- and agent-facing doc still teaches the
superseded `createColumnBuilder`/`cb.*` style:

- Root `README.md` (npm/GitHub landing page): 4 `createColumnBuilder`
  occurrences, **zero** `betterTables()` — a new user never discovers the
  flagship API.
- `wiki.md` (505k, auto-generated "Version: 3" pre-0.6 snapshot): 27
  `createColumnBuilder`, 0 flagship mentions, **duplicate headings**
  (7× "Architecture Overview", 2× "Next.js Integration"), and a dead
  `examples/nextjs-setup-example.md` citation. `CLAUDE.md` lines 74-80 send
  every agent into these exact headings — so agents author the removed API.
- `packages/core/README.md`, `packages/adapters/drizzle/README.md` — same
  legacy style; plus dead links into a nonexistent repo-root `docs/` tree
  (DEBT-06) and wrong-pathed `docs/CONTRIBUTING.md` (real file is at root).
- `packages/adapters/drizzle/examples/{advanced-relationships,basic-usage}.ts`
  use `createColumnBuilder` and are **never compiled** (tsconfig excludes
  `examples/`) — uncompiled legacy code shipped inside a published package
  (DEBT-05).
- `packages/adapters/toolkit` is publishable but has **no README** (DOCS-04).
- `MIGRATION.md` runbook step 2 cites `bun run changeset:release`, which
  doesn't exist (real script: `bun run release`).

## Current state

Verified at `787a816`:

- `README.md`: `grep -c createColumnBuilder` → 4; `grep -c "betterTables("` → 0.
  Legacy sample sites (approx, re-verify): "The Magic" (~`:44-47`), Quick
  Start (~`:85-100`), cross-table/filtering (~`:137-139`, `:346-404`). The
  shipped flagship examples to mirror are in `apps/marketing/src/app/(marketing)/examples/`.
- `wiki.md`: `grep -c createColumnBuilder` → 27, `grep -c "betterTables("` → 0;
  header line 1-23 declares "Version: 3", auto-generated. CLAUDE.md-named
  headings: "Architecture Overview", "Column Definition (Builder API)",
  "Advanced Filtering System", "Sorting", "Pagination", "URL State
  Management", "Next.js Integration".
- `CLAUDE.md:74-80` — the "Deep dives … see `wiki.md` by heading" pointer list.
- `packages/adapters/drizzle/examples/advanced-relationships.ts:3,243` and
  `basic-usage.ts:4,112` — `createColumnBuilder`. `tsconfig.json` includes
  only `src/**/*` + `tests`.
- `packages/core/README.md` (~`:638-643`, `:695`) and
  `packages/adapters/drizzle/README.md` (~`:1017-1035`) link `../../docs/*`
  (nonexistent) incl. `docs/CONTRIBUTING.md`; `SECURITY.md:74` links
  `tree/main/docs`. Root `CONTRIBUTING.md` exists.
- `packages/adapters/toolkit/` has no `README.md` (only package that lacks one).
- `MIGRATION.md` (~`:634`) — `bun run changeset:release`. Root scripts are
  `changeset`, `changeset:version`, `release`.
- The still-present legacy builders live in
  `packages/core/src/builders/column-factory.ts` (`createColumnBuilder` ~`:106`,
  `defineColumns` ~`:159`) — so all legacy samples compile; they teach the
  non-flagship path, they aren't broken.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Compile examples | `cd packages/adapters/drizzle && bunx tsc --noEmit -p tsconfig.json` (after including examples) | exit 0 |
| Link sanity | `grep -rn "\.\./\.\./docs/" packages/` | should reach 0 by end |
| Core tests (deprecation JSDoc) | `cd packages/core && bun test` | pass |

## Scope

**In scope**:
- `README.md`, `packages/core/README.md`, `packages/adapters/drizzle/README.md`
- `wiki.md` (replace with lean handbook) + `CLAUDE.md` heading pointers
- `packages/adapters/drizzle/examples/*.ts` + that package's `tsconfig.json`
- `packages/adapters/toolkit/README.md` (create)
- `SECURITY.md` (doc link), `MIGRATION.md` (runbook erratum)
- `packages/core/src/builders/column-factory.ts` (JSDoc `@deprecated` only —
  no behavior change)
- `.changeset/*.md` (core patch for the deprecation JSDoc), `plans/README.md`

**Out of scope**:
- Changing/removing the legacy builders themselves — they stay (the 0.6
  policy removed the per-table *shell*, not the column builders).
- New doc features (search, versioned docs site).
- Docs routes in `apps/marketing` (the "fold into marketing" produced none;
  a real docs site is a separate direction decision, not this plan).

## Git workflow

- Branch: `docs-truth-0.6`; commits `Plan 039 Step N: …`.

## Steps

### Step 1: Rewrite the three READMEs on the flagship API

Port every `createColumnBuilder`/`cb.*` code block in `README.md`,
`packages/core/README.md`, and `packages/adapters/drizzle/README.md` to
`betterTables()` + `defineTable()` + `t.*` path builders, mirroring the
shipped `apps/marketing` examples. Add a one-line "which API" pointer to
`MIGRATION.md` in the root README. Keep prose claims truthful (e.g. don't
list export as shipped — see plan 050).

**Verify**: `grep -c "createColumnBuilder" README.md packages/core/README.md packages/adapters/drizzle/README.md`
→ 0 in each (except any explicit "legacy, removed" migration note); every
code block is syntactically plausible against the flagship API in the
marketing examples.

### Step 2: Fix dead doc links

Repoint `../../docs/*` links in the two package READMEs and the
`tree/main/docs` link in `SECURITY.md` to surviving targets (root
`CONTRIBUTING.md`, the real `packages/*/docs/*` files, or the marketing
site). Fix `docs/CONTRIBUTING.md` → `../../CONTRIBUTING.md`.

**Verify**: `grep -rn "\.\./\.\./docs/" packages/ SECURITY.md` → no matches to
nonexistent targets; every remaining relative doc link resolves on disk.

### Step 3: Migrate and compile the drizzle examples

Port `examples/advanced-relationships.ts` and `examples/basic-usage.ts` to
the flagship API. Add `examples/**` to `packages/adapters/drizzle/tsconfig.json`'s
`include` (or add a dedicated `tsconfig.examples.json` referenced by a
`typecheck` include) so they compile in CI — extending the 0.6 guarantee
("every example compile-checked") to cover them.

**Verify**: `cd packages/adapters/drizzle && bunx tsc --noEmit` → exit 0 with
examples included; `grep -c createColumnBuilder examples/*.ts` → 0.

### Step 4: Toolkit README

Create `packages/adapters/toolkit/README.md`: what it is (the ORM-agnostic
adapter machinery — `FilterRouter`, predicate-emitter interface,
`PrimaryTableResolver`, `SchemaIntrospectionPort`, data-transformer), who
imports it (adapter authors, not app developers), and a short pointer to the
Drizzle adapter as the reference consumer. Link it from the root README's
package list if one exists.

**Verify**: file exists and renders (no broken relative links).

### Step 5: Replace wiki.md with a lean 0.6 handbook

Write a new, much smaller `wiki.md` (or `docs/handbook.md` — keep the path
`CLAUDE.md` references, so prefer `wiki.md`) with exactly the sections
`CLAUDE.md` names — Architecture Overview, Column Definition (Builder API),
Advanced Filtering System, Sorting, Pagination, URL State Management, Next.js
Integration — each taught on `betterTables()`/`defineTable()`/`t.*`, each
heading UNIQUE (no duplicates), no dead `examples/` citation. Base content on
the real current code and the marketing examples; do not carry pre-0.6 prose
forward. Move the old auto-generated file to `wiki.archive.md` (or delete it —
maintainer chose "archive out of the agent path"; archiving is safer) and
update `CLAUDE.md:74-80` to point at the new headings (which now exist and are
unique). If any section would exceed what you can write accurately from the
code, write the section header + a 2–3 line summary + a pointer to the
authoritative source file rather than inventing detail.

**Verify**: `grep -c "betterTables(" wiki.md` → > 0; `grep -c createColumnBuilder wiki.md`
→ 0; each CLAUDE.md-referenced heading appears exactly once
(`grep -c "## Architecture Overview" wiki.md` → 1, etc.); no
`nextjs-setup-example.md` reference remains.

### Step 6: `@deprecated` nudge + runbook erratum + changeset + gates

- In `column-factory.ts`, add `@deprecated Use \`defineTable()\`/\`t.*\` — see MIGRATION.md`
  JSDoc to `createColumnBuilder` and `defineColumns` (JSDoc only; they remain
  functional). This surfaces the nudge in editors without breaking anything.
- Fix `MIGRATION.md` runbook step 2: `bun run changeset:release` →
  `bun run release`.
- Changeset for `@better-tables/core` (patch): "createColumnBuilder /
  defineColumns marked @deprecated in favor of defineTable — no runtime change."
- Full gates.

**Verify**: `grep -n "@deprecated" packages/core/src/builders/column-factory.ts`
→ 2 matches; `grep -n "changeset:release" MIGRATION.md` → 0;
`bun run typecheck` + `cd packages/core && bun test` → pass.

## Test plan

- No new unit tests (docs + JSDoc). The durable gate is Step 3 bringing the
  examples under `tsc` so they can't rot.
- If the repo has a "compile-check every doc example" harness (plan 019
  added one for MIGRATION.md — find it under `packages/core/tests` or
  `packages/adapters/drizzle/tests`), add the migrated README/wiki flagship
  snippets to it so the new docs are compile-checked too.

## Done criteria

- [ ] `grep -c "createColumnBuilder" README.md wiki.md packages/core/README.md packages/adapters/drizzle/README.md` → 0 each (barring explicit legacy-migration notes)
- [ ] `grep -c "betterTables(" README.md wiki.md` → > 0 each
- [ ] Each CLAUDE.md-referenced wiki heading appears exactly once
- [ ] `cd packages/adapters/drizzle && bunx tsc --noEmit` → exit 0 with examples included
- [ ] `grep -rn "\.\./\.\./docs/" packages/ SECURITY.md` → no dead-target matches
- [ ] `packages/adapters/toolkit/README.md` exists
- [ ] `grep -n "changeset:release" MIGRATION.md` → 0
- [ ] `@deprecated` JSDoc on both legacy builder factories; core tests pass
- [ ] `plans/README.md` row updated

## STOP conditions

- You cannot write a wiki section accurately from the code without guessing
  behavior — write the header + summary + source pointer and flag the gap in
  your report; do NOT fabricate API detail.
- Including `examples/**` in the drizzle tsconfig surfaces real type errors in
  the migrated examples that trace to an actual API gap (not a mechanical port
  mistake) — report it as a possible correctness finding.
- A README code block can't be expressed in the flagship API because a
  capability the legacy sample showed doesn't exist in 0.6 — report the gap.

## Maintenance notes

- Once the examples compile in CI, the "docs teach the removed API" class is
  structurally prevented for examples; READMEs/wiki still rely on review
  discipline — the compile-check harness (Step 7) closes that too if wired.
- If a real docs site later lands in `apps/marketing`, the lean handbook is
  the content seed.
- Reviewer scrutiny: the wiki rewrite is the highest-risk-for-inaccuracy
  step — spot-check its API claims against the marketing examples.
