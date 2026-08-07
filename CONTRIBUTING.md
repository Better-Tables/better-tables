# Contributing to Better Tables

Thanks for your interest in contributing! This guide covers setup,
conventions, and what to check before opening a PR. For architecture and
package-level details, see [`CLAUDE.md`](CLAUDE.md) and `wiki.md`.

## Setup

Requirements: [Bun](https://bun.sh) (see `packageManager` in `package.json`
for the pinned version), Node.js 18+.

```bash
git clone https://github.com/Better-Tables/better-tables.git
cd better-tables
bun install
bun run build      # build all packages once
bun run typecheck  # sanity check before you start
```

No environment variables are required for the default workflow (demo app,
core/ui tests). See `.env.example` if you need the Drizzle adapter's
MySQL/Postgres integration tests.

## Branch and commit conventions

- Branch names are short, kebab-case, and describe the change (e.g.
  `fix-join-count-inflation`, `dx-hygiene-sweep`) — no required prefix.
- Commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat: ...`, `fix: ...`, `perf: ...`, `feat!: ...` / a `BREAKING CHANGE:`
  footer for breaking changes, `chore:`/`docs:`/`refactor:`/`test:`/`ci:`
  for everything else). This is enforced by commitlint on commit
  (`.husky/commit-msg`) and it's what drives releases — see
  [Releases](#releases) below. If you squash-merge, the **PR title** must
  also be a valid Conventional Commit (linted by
  `.github/workflows/pr-title-lint.yml`), since GitHub uses it as the
  squashed commit's message on `main`.
- Prefer one logical change per commit; large or multi-step work should
  read as a sequence of independently-revertable commits (see any
  `plans/*.md` for examples of how work gets broken down).
- If you're executing against a written plan in `plans/`, follow its
  step/commit structure and update `plans/README.md`'s status row when
  you finish, unless told otherwise.

## Releases

Releases are fully automated by [semantic-release](https://semantic-release.org)
on merge to `main` — there's no manual versioning step, and nothing to run
before opening a PR. Each published package
(`@better-tables/core`, `@better-tables/cli`,
`@better-tables/adapters-drizzle`, `@better-tables/adapters-toolkit`) is
versioned independently from the Conventional Commits that touched its
directory: `feat` → minor, `fix`/`perf` → patch, a breaking-change commit
→ major. `@better-tables/ui` and `apps/marketing` are private and never
published. See [`CLAUDE.md`](CLAUDE.md#releases) for how the pipeline
works, and `bun run release:dry-run` to preview what would be released
without publishing anything.

## Before opening a PR

- [ ] `bun run typecheck` passes (root, or scoped with `--filter=<pkg>`)
- [ ] `bun run test` passes for every package you touched
- [ ] `cd packages/<pkg> && bun run lint` is clean (don't run the root
      `lint` script to "just check" — it auto-fixes unsafely across the
      whole repo)
- [ ] Commit messages (and, for squash-merged PRs, the PR title) are valid
      Conventional Commits
- [ ] If you added a new package, it's listed in `CLAUDE.md`'s package map
- [ ] Docs (`README.md`, package `README.md`s) still describe the real,
      shipped behavior — don't let quick-starts drift from what's
      installable

## Questions

Open a GitHub issue or start a discussion — see the links in
[`README.md`](README.md#-questions).
