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
| `@better-tables/adapters-toolkit` | `packages/adapters/toolkit` | npm (public) | ORM-agnostic adapter toolkit: shared primitives (data transform, primary-table resolution, schema/SQL utils) for building adapters. |
| `@better-tables/site` | `apps/marketing` | private | Public site: marketing, examples, and docs (homepage users: Postgres when `DATABASE_URL` is set, else SQLite; ticket examples: in-memory SQLite). |

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
| Release (dry run) | `bun run release:dry-run` (root) | Previews what semantic-release would publish for every package, no side effects. |

## Releases

Fully automated via [semantic-release](https://semantic-release.org) — no
manual version bumps, changelog edits, or `npm publish`.

- **Commit messages must be [Conventional Commits](https://www.conventionalcommits.org/)**
  (`feat:`, `fix:`, `perf:`, `feat!:`/`BREAKING CHANGE:`, etc.) — this is
  what drives versioning. Enforced locally by commitlint
  (`.husky/commit-msg`) and on PRs by `.github/workflows/pr-title-lint.yml`
  (PR title must be conventional, since a squash-merged PR's title becomes
  the commit message on `main`).
- On every push to `main` (after `.github/workflows/test.yml` passes),
  `.github/workflows/release.yml` runs `scripts/release/run.sh`, which
  invokes semantic-release once per publishable package directory
  (`packages/core`, `packages/cli`, `packages/adapters/drizzle`,
  `packages/adapters/toolkit`), each scoped to only its own directory's
  commits via `semantic-release-monorepo`
  (`scripts/release/create-release-config.cjs` is the shared factory each
  package's `release.config.cjs` calls).
- Each package release: version bump (in `package.json`), `CHANGELOG.md`
  update, git tag (`<pkg-name>@<version>`, matching pre-existing tag
  history), npm publish via `bun publish` (resolves `workspace:*` deps to
  real semver — this is why `@semantic-release/npm` runs with
  `npmPublish: false`), and a GitHub Release.
- `@better-tables/ui` and `apps/marketing` are private and never released.
- No pre-1.0/breaking-change special-casing: standard semver — `feat` →
  minor, `fix`/`perf` → patch, breaking → major, regardless of current
  `0.x` version.

## Test locations

- `packages/core/tests/` (`builders/`, `lib/`, `managers/`, `types/`, `utils/`)
- `packages/cli/tests/`
- `packages/adapters/drizzle/tests/` — SQLite suites run with no setup;
  MySQL/Postgres integration suites need `packages/adapters/drizzle/.env.example`
  copied to `.env.local` and a running DB (skipped otherwise).
- `packages/ui/` has no test suite yet.

## Env vars

Nothing is required by default. Optional: `apps/marketing/.env` may set
`DATABASE_URL` so the homepage users demo hits Neon Postgres (falls back to
in-memory SQLite when unset). See root `.env.example` and
`packages/adapters/drizzle/.env.example` (MySQL/Postgres integration tests).

## Published vs. private

- **Published to npm**: `@better-tables/core`, `@better-tables/cli`,
  `@better-tables/adapters-drizzle`, `@better-tables/adapters-toolkit`.
- **Private** (`"private": true`): `@better-tables/ui` (copied via the CLI,
  not installed from npm — do not remove `private` without re-reading
  plan 009 Step 3's reasoning), `apps/marketing`.

## Deferred packaging work (plan 009)

- Plan 007 (adapter toolkit extraction) landed: `packages/adapters/toolkit`
  exists, `drizzle-orm`/`better-sqlite3`/drivers are `peerDependencies` of the
  Drizzle adapter, and its `sideEffects: false` is set.
- `packages/ui` builds with tsdown **`unbundle: true`** (ESM file-to-file) so
  per-file `'use client'` directives survive. Do not reintroduce a global
  `"use client"` banner or a single bundled UI entry without re-checking
  directive preservation. Subpath exports remain unplanned (see
  `plans/README.md`).
- Per-component subpath exports for `@better-tables/ui` (follow-up, not
  planned — see `plans/README.md`).

## Deep dives

Canonical docs: `apps/marketing/content/docs/` served at `/docs` on
`@better-tables/site`. `wiki.md` is a short path map for agents.

| Topic | Docs path |
|---|---|
| Architecture | `/docs/architecture` |
| Columns | `/docs/columns` |
| Filtering (operator reference) | `/docs/filtering` |
| Sorting | `/docs/sorting` |
| Pagination | `/docs/pagination` |
| Facets | `/docs/facets` |
| Selection & actions | `/docs/selection-and-actions` |
| Inline editing | `/docs/inline-editing` |
| Large datasets | `/docs/large-datasets` |
| URL state | `/docs/url-state` |
| Next.js | `/docs/nextjs` |
| BetterTable props | `/docs/better-table` |
| Custom adapters | `/docs/adapters/custom` |
| Troubleshooting | `/docs/troubleshooting` |
