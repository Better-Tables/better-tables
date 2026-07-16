# CLAUDE.md

Working notes for AI agents (and humans) operating in this repo. Keep this
file short — deep dives belong in `wiki.md` (linked by heading below), not
here.

## Package map

| Package | Path | Published? | What it is |
|---|---|---|---|
| `@better-tables/core` | `packages/core` | npm (public) | Column builders, filter/sort/pagination managers, adapter contract types. No React, no DB driver. |
| `@better-tables/ui` | `packages/ui` | **private** — distributed via CLI copy, not npm | React table/filter components (shadcn-style), hooks, stores. |
| `@better-tables/cli` | `packages/cli` | npm (public) | `better-tables init` — copies `ui`'s components into a consumer project. |
| `@better-tables/adapters-drizzle` | `packages/adapters/drizzle` | npm (public) | Drizzle ORM adapter: schema introspection, JOIN/filter/pagination query generation for Postgres/MySQL/SQLite. |
| `@better-tables/site` | `apps/marketing` | private | Public site: marketing, examples, and docs (in-memory SQLite demo + seed). |

## Data flow (one-liner)

Column definitions (`@better-tables/core`) → adapter (e.g.
`@better-tables/adapters-drizzle`) turns them into DB queries + results →
`@better-tables/ui` renders/filters/sorts/paginates against the adapter's
response, with URL state sync.

## Commands

| Purpose | Command | Notes |
|---|---|---|
| Install | `bun install` (root) | Workspace catalog pins shared React, Tailwind, TypeScript, and tooling versions. |
| Typecheck | `bun run typecheck` (root) | Runs `tsc --noEmit` in every package via turbo. |
| Build | `bun run build` (root) | Runs all packages and apps via turbo. Use `bun run build --filter=<pkg>` to scope. |
| Test (all) | `bun run test` (root) | Runs each package's `bun test`. |
| Test (one package) | `cd packages/<name> && bun test` | e.g. `cd packages/core && bun test`. |
| Lint (check) | `cd packages/<name> && bun run lint` | Per-package `biome check .` — read-only. |
| Lint (root) | `bun run lint` (root) | **Mutates**: `biome check --write --unsafe .` across the whole repo. Don't run this to "just check" — use the per-package command or add `-- --no-write` awareness before running at root. |
| Changesets | `bun run changeset` (root) | Required for any user-facing change to a published package (see `CONTRIBUTING.md`). |

## Test locations

- `packages/core/tests/` (`builders/`, `lib/`, `managers/`, `types/`, `utils/`)
- `packages/cli/tests/`
- `packages/adapters/drizzle/tests/` — SQLite suites run with no setup;
  MySQL/Postgres integration suites need `packages/adapters/drizzle/.env.example`
  copied to `.env.local` and a running DB (skipped otherwise).
- `packages/ui/` has no test suite yet.

## Env vars

Nothing is required by default. See root `.env.example` (pointer only) and
`packages/adapters/drizzle/.env.example` (the only real env vars in the repo,
for optional MySQL/Postgres integration tests).

## Published vs. private

- **Published to npm**: `@better-tables/core`, `@better-tables/cli`,
  `@better-tables/adapters-drizzle`.
- **Private** (`"private": true`): `@better-tables/ui` (copied via the CLI,
  not installed from npm — do not remove `private` without re-reading
  plan 009 Step 3's reasoning), `apps/marketing`.

## Deferred packaging work (plan 007 / plan 009)

- `packages/adapters/drizzle/package.json` dependency classes
  (`drizzle-orm`/`better-sqlite3` should move out of `dependencies`) and its
  `sideEffects` field are deferred until plan 007 (adapter toolkit
  extraction) lands, to avoid merge conflicts. See `plans/009-dx-hygiene-sweep.md`.
- `packages/ui` builds with tsdown **`unbundle: true`** (ESM file-to-file) so
  per-file `'use client'` directives survive. Do not reintroduce a global
  `"use client"` banner or a single bundled UI entry without re-checking
  directive preservation. Subpath exports remain unplanned (see
  `plans/README.md`).
- Per-component subpath exports for `@better-tables/ui` (follow-up, not
  planned — see `plans/README.md`).

## Deep dives

For architecture, the column-builder API, filtering/sorting/pagination
internals, URL state sync, and Next.js integration details, see `wiki.md`
by heading: "Architecture Overview", "Column Definition (Builder API)",
"Advanced Filtering System", "Sorting", "Pagination", "URL State
Management", "Next.js Integration".
