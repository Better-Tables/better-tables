# Plan 037: Ship UI component source inside the CLI package (stop downloading from the mutable `main` branch)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/cli`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (packaging/distribution change; test-suite mock rework)
- **Depends on**: 033 (touches `packages/cli/package.json` too — land 033 first or rebase over it)
- **Category**: security / dx
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

`better-tables init` copies `@better-tables/ui`'s component source into the
consumer's project — that's the distribution model (the ui package is
private, never on npm). Today it fetches every file from
`raw.githubusercontent.com/Better-Tables/better-tables/main/packages/ui/src`
at run time. Two consequences:

1. **Version skew, guaranteed at the next release**: the fetched code is
   whatever `main` holds at the moment of `init`, decoupled from the
   installed CLI version. A user on CLI 0.1.5 running `init` after the 0.6
   merge gets 0.6-era components (React 19, new hook contracts) regardless
   of what their project or the CLI's templates expect — and mid-refactor
   `main` states ship to users the moment they're pushed.
2. **No integrity gate on a supply-chain path**: whatever is served for
   `main` is written into consumer projects as executable source, with no
   pin, checksum, or signature. (The audit's finding SEC-03.)

The fix: bundle `packages/ui/src` into the published CLI tarball at build
time and copy from disk. This makes `init` offline-capable, byte-exact to
the released CLI version, and removes the network trust dependency
entirely. (Tag-pinned GitHub fetches were considered and rejected: the ui
package has no npm version or git tag of its own — it's private — and the
repo's remote is not even guaranteed present; bundling is the only option
that ties component source to the CLI release artifact itself.)

## Current state

All excerpts verified at `787a816`.

- `packages/cli/src/lib/file-operations.ts`:
  - `:30-33` —

    ```ts
    const GITHUB_REPO = 'Better-Tables/better-tables';
    const GITHUB_BRANCH = 'main'; // Could be made configurable or use package version
    const GITHUB_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
    const GITHUB_UI_BASE_URL = `${GITHUB_BASE_URL}/packages/ui/src`;
    ```

  - `:38-55` — `downloadFromGitHub(filePath)` → `fetch(url)` → text; 404
    and non-OK produce thrown Errors.
  - `:56+` — `UI_SOURCE_FILES`: a static nested manifest of every file to
    copy (components/table/*, components/filters/*, components/ui/*, hooks,
    lib, styles…). This manifest stays — it defines WHAT to copy; this plan
    changes only WHERE FROM.
  - `:300-320` (inside `copyFile`) — per-file flow: ensure dest dir →
    `const content = await downloadFromGitHub(mapping.sourcePath)` →
    `transformImports(...)` → `writeFileSync(dest)`. `copyAllFiles` drives
    it from `commands/init.ts:238`.
- `packages/cli/package.json` — `"files": ["dist"]`, `"bin": { "better-tables": "./dist/cli.mjs" }`,
  build is `tsdown`, version `0.1.5`, publishes with `access: public`.
  (Plan 033 edits this file's `lint:fix` and `@types/bun` lines — rebase
  awareness.)
- Tests: `packages/cli/tests/` — 137 tests across 9 files, all green at
  `787a816`. Before Step 3, inspect how they satisfy `downloadFromGitHub`
  today (global `fetch` mock, network, or bypass) — the plan's Step 3
  adapts them to the filesystem source; the STOP conditions bound this.
- The ui source being bundled: `packages/ui/src/**` (components, hooks,
  lib, styles). It is the same tree `UI_SOURCE_FILES` maps.
- Conventions: user-facing CLI change → changeset (`@better-tables/cli`,
  minor). Commits `Plan 037 Step N: …`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Build CLI | `cd packages/cli && bun run build` | exit 0; `dist/` + `ui-src/` produced |
| CLI tests | `cd packages/cli && bun test` | all pass |
| Typecheck | `bun run typecheck` (root) | exit 0 |
| Pack check | `cd packages/cli && npm pack --dry-run` (bun's pack lacks a dry-run listing; npm reads the same `files` field) | file list includes `ui-src/**` |

## Scope

**In scope** (the only files you should modify):
- `packages/cli/src/lib/file-operations.ts`
- `packages/cli/scripts/bundle-ui-src.ts` (create)
- `packages/cli/package.json` (`build` script, `files` array)
- `packages/cli/tests/**` (adapt source-of-truth mocks)
- `.gitignore` (add `packages/cli/ui-src/`)
- `.changeset/<new-file>.md`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `packages/ui/**` — the source of the copy is read-only here.
- `commands/init.ts` conflict-resolution logic and `transformImports` —
  only the byte source changes.
- Adding a `--remote`/branch flag — explicitly not wanted (it would
  reintroduce the unpinned path this plan removes).
- Release workflow (`.github/workflows/release.yml`) — `bun run release`
  already runs `bun run build` before `changeset publish`, which produces
  `ui-src/` in time for packing; verify, don't edit.

## Git workflow

- Branch: `cli-bundled-ui-source`
- Commits: `Plan 037 Step N: <imperative summary>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bundling script + build wiring

Create `packages/cli/scripts/bundle-ui-src.ts` (run with bun): recursively
copy `../ui/src` → `./ui-src` (paths relative to `packages/cli`), replacing
any existing `ui-src` first (`rm -rf` semantics via
`fs.rmSync(dest, { recursive: true, force: true })`, then
`fs.cpSync(src, dest, { recursive: true })`). Resolve the source as
`path.resolve(import.meta.dir, '../../ui/src')` and fail with a clear error
if it doesn't exist.

In `packages/cli/package.json`:
- `"build": "tsdown && bun scripts/bundle-ui-src.ts"`
- `"files": ["dist", "ui-src"]`

Add `packages/cli/ui-src/` to the root `.gitignore` (it's a build artifact,
like `dist`).

**Verify**:
1. `cd packages/cli && bun run build` → exit 0;
   `diff -r ../ui/src ui-src` → no output (byte-identical).
2. `git status` → `ui-src/` does NOT appear (ignored).
3. `npm pack --dry-run 2>&1 | grep -c "ui-src/"` → > 0.

### Step 2: Read locally instead of downloading

In `file-operations.ts`:
1. Delete the four `GITHUB_*` constants and `downloadFromGitHub`.
2. Add a resolver + reader:

   ```ts
   import { fileURLToPath } from 'node:url';

   /**
    * The bundled UI source root. In the published package this is
    * `<pkg>/ui-src` (created by scripts/bundle-ui-src.ts at build time);
    * in the monorepo (running the CLI from source, ui-src not yet built)
    * it falls back to the workspace's `packages/ui/src`.
    */
   function resolveUiSourceRoot(): string {
     const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
     // import.meta.url is <pkg>/dist/*.mjs when built, <pkg>/src/lib/*.ts in dev —
     // walk up until a directory containing package.json with name @better-tables/cli.
     ...
     const bundled = join(pkgRoot, 'ui-src');
     if (existsSync(bundled)) return bundled;
     const workspace = join(pkgRoot, '..', 'ui', 'src');
     if (existsSync(workspace)) return workspace;
     throw new Error(
       'Bundled UI source not found. This @better-tables/cli install is corrupted — reinstall it.'
     );
   }

   async function readUiSourceFile(filePath: string): Promise<string> {
     const fullPath = join(resolveUiSourceRoot(), filePath);
     if (!existsSync(fullPath)) {
       throw new Error(`File not found in bundled UI source: ${filePath}`);
     }
     return readFileSync(fullPath, 'utf-8');
   }
   ```

   Implement the package-root walk robustly (the two-`dirname` sketch is
   right for `dist/cli.mjs` but verify against tsdown's actual output
   layout and the dev path `src/lib/file-operations.ts` — the
   walk-up-to-package.json loop is the safe form; cache the result in a
   module-level variable). `readUiSourceFile` is async only to keep
   `copyFile`'s call shape unchanged.
3. Replace the one call site
   (`const content = await downloadFromGitHub(mapping.sourcePath)`) with
   `await readUiSourceFile(mapping.sourcePath)`.
4. Keep error-message texts close to the old ones where tests assert on
   them, but they must no longer mention GitHub.

**Verify**:
1. `grep -rn "raw.githubusercontent\|GITHUB_" packages/cli/src/` → no
   matches.
2. `cd packages/cli && bun run typecheck` → exit 0.

### Step 3: Adapt the test suite

Run `cd packages/cli && bun test` and triage failures. Expected classes:
- Tests that mocked global `fetch` to serve component content → rewrite to
  point the reader at a fixture: prefer the REAL workspace fallback (the
  resolver already reaches `packages/ui/src` in-repo, so most copy tests
  can assert against real file content), or a temp-dir fixture if a test
  needs synthetic content.
- Tests asserting GitHub-specific error messages → update to the new
  messages.
Do not weaken any assertion about the transform/conflict/write pipeline —
only the content SOURCE changes.

**Verify**: `cd packages/cli && bun test` → all pass (≥137; count may grow
with Step 4's additions).

### Step 4: New tests locking the distribution contract

Add (in the existing test file that covers `copyFile`/`copyAllFiles`, or a
new `tests/bundled-source.test.ts` modeled on the suite's structure):

1. Resolver prefers `ui-src` when present (create a temp dir shaped like an
   installed package: `package.json` + `ui-src/components/...` fixture; if
   the resolver's root detection can't be pointed at a temp dir without
   export changes, export `resolveUiSourceRoot` for tests — internal
   export, note it `/** @internal */`).
2. Resolver falls back to the workspace `packages/ui/src` (the in-repo
   case — assert it returns a path ending in `packages/ui/src` and that a
   known file, e.g. `components/table/table.tsx`, is readable).
3. Missing file → error naming the path (`File not found in bundled UI
   source: …`).

**Verify**: `cd packages/cli && bun test` → all pass including the new
tests.

### Step 5: End-to-end init smoke + gates + changeset + ledger

1. E2E smoke in a scratch dir (use the scratchpad, not the repo):
   `cd <scratch> && mkdir cli-smoke && cd cli-smoke && bun init -y`
   then run the built CLI:
   `bun /Users/…/better-tables/packages/cli/dist/cli.mjs init --yes`
   (check `commands/init.ts` for the exact non-interactive flags; if none
   exist, drive the prompts per the CLI test suite's existing e2e pattern
   — mirror how `packages/cli/tests/` invokes init). Confirm files are
   written and `grep -rn "raw.githubusercontent" <scratch>/cli-smoke` →
   no matches, and one copied file (e.g. the table component) is identical
   to `packages/ui/src`'s post-transform expectation.
2. Root `bun run typecheck`; `cd packages/cli && bun test`.
3. Changeset for `@better-tables/cli` (minor): "init now copies component
   source bundled with the CLI release instead of downloading from the
   repository's main branch — offline-capable, version-exact."
4. Update the plan 037 row in `plans/README.md`.

**Verify**: all listed commands green; changeset exists.

## Test plan

- Adapted existing suite (Step 3) — the transform/conflict/write pipeline
  keeps its full coverage, re-pointed at filesystem source.
- New tests (Step 4): resolver preference order, workspace fallback,
  missing-file error.
- E2E smoke (Step 5) proving a real init works offline from the built
  artifact.
- Verification: `cd packages/cli && bun test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "raw.githubusercontent\|GITHUB_BRANCH" packages/cli/src/` → no matches
- [ ] `cd packages/cli && bun run build` → exit 0 and `diff -r ../ui/src ui-src` → empty
- [ ] `npm pack --dry-run` (in packages/cli) lists `ui-src/` entries
- [ ] `git check-ignore packages/cli/ui-src` → exits 0 (ignored)
- [ ] `cd packages/cli && bun test` → all pass, incl. resolver tests
- [ ] Root `bun run typecheck` → exit 0
- [ ] E2E smoke wrote components into a scratch project with no network fetch of component source
- [ ] New `.changeset/*.md` with `"@better-tables/cli": minor` exists
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The CLI test suite turns out to hit the real network (no fetch mock) —
  that changes the Step 3 rework scope; report what you found first.
- tsdown's output layout makes package-root resolution ambiguous (e.g.
  bundle-splitting relocates `import.meta.url` unexpectedly) and the
  walk-up loop can't find the CLI's own `package.json` in both dev and
  built modes.
- `npm pack --dry-run` refuses to include `ui-src` (files-field
  interaction) — do not switch to `.npmignore` without reporting.
- Step 5's smoke requires interactive input that the existing test suite
  has no pattern for driving.
- You find yourself editing `commands/init.ts` beyond (at most) an import
  line — the copy pipeline is out of scope.

## Maintenance notes

- Every ui component change now reaches users ONLY via a CLI release —
  that's the point, but it means "fix a component" implies "release the
  CLI". The release runbook (MIGRATION.md) doesn't need changes: `bun run
  release` builds before publishing, which regenerates `ui-src`.
- If the ui package later gains per-component subpath exports (ledger
  backlog), `UI_SOURCE_FILES` and this bundle both need revisiting
  together.
- Reviewer scrutiny: the resolver's dev-mode fallback must never win inside
  a published install (bundled dir existing is the guard), and the packed
  tarball size delta (~ui/src) should be sanity-checked in the PR.
