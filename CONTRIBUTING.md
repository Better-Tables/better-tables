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
- Commit messages are imperative-mood, present-tense sentences describing
  the change (e.g. "Fix identifier escaping to escape-and-wrap
  atomically", "Add sideEffects false to core and ui"). No conventional-
  commits prefix convention is enforced.
- Prefer one logical change per commit; large or multi-step work should
  read as a sequence of independently-revertable commits (see any
  `plans/*.md` for examples of how work gets broken down).
- If you're executing against a written plan in `plans/`, follow its
  step/commit structure and update `plans/README.md`'s status row when
  you finish, unless told otherwise.

## Changesets

Any user-facing change to a **published** package
(`@better-tables/core`, `@better-tables/cli`,
`@better-tables/adapters-drizzle`) needs a changeset:

```bash
bun run changeset
```

Pick the affected package(s) and bump type (patch/minor/major), and write
a description aimed at consumers — what changed and, for breaking changes,
what they need to do about it. Changes to `@better-tables/ui` don't need a
changeset (it's private, distributed via the CLI, not versioned on npm).

## Before opening a PR

- [ ] `bun run typecheck` passes (root, or scoped with `--filter=<pkg>` if
      `apps/web`'s pre-existing, unrelated failure blocks the root run —
      see `CLAUDE.md`)
- [ ] `bun run test` passes for every package you touched
- [ ] `cd packages/<pkg> && bun run lint` is clean (don't run the root
      `lint` script to "just check" — it auto-fixes unsafely across the
      whole repo)
- [ ] A changeset exists if you changed a published package's behavior
- [ ] If you added a new package, it's listed in `CLAUDE.md`'s package map
- [ ] Docs (`README.md`, package `README.md`s) still describe the real,
      shipped behavior — don't let quick-starts drift from what's
      installable

## Questions

Open a GitHub issue or start a discussion — see the links in
[`README.md`](README.md#-questions).
