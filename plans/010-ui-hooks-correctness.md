# Plan 010: Fix the data-fetch race and URL-sync lifecycle bugs; stand up the first UI test harness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/ui/src/hooks/use-table-data.ts packages/ui/src/hooks/use-table-url-sync.ts packages/ui/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (M for the fixes; the harness setup is the rest)
- **Risk**: MED (fetch/sync lifecycle timing; mitigated by writing characterization tests FIRST)
- **Depends on**: 001 (CI must run UI tests once they exist — add the `test-ui` job as part of this plan if 001 landed without it)
- **Category**: bug / tests
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

`packages/ui` — the package every consumer actually renders — has zero tests, and its two most critical hooks have real lifecycle bugs. `useTableData` cannot cancel in-flight requests and has no ordering guard, so rapid filtering can render stale results (last-to-resolve wins). `useTableUrlSync` — the highest-churn hook in the repo — leaks its debounce timer on unmount, re-subscribes on every render when passed an inline config object, and its "retry hydration" branch is an admitted stub that marks hydration done without applying URL state, silently dropping deep-link state when the store isn't ready yet. These bugs are invisible precisely because no test harness exists; this plan fixes both hooks and leaves the harness the rest of the UI package needs.

## Current state

- `packages/ui/src/hooks/use-table-data.ts:93-154` — the fetch lifecycle:

  ```typescript
  const fetchData = useCallback(async () => {
    if (!enabled) return;
    const abortController = new AbortController();   // :96 — created per call…
    ...
    const result = await adapter.fetchData(fetchParams);  // :114 — …but signal never passed
    if (!abortController.signal.aborted) { setData(result.data); ... }
    ...
    return () => { abortController.abort(); };       // :131-133 — returned only AFTER the await
  }, [adapter, filters, pagination, params, enabled]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    fetchData().then((cleanupFn) => { cleanup = cleanupFn; });  // :147-149
    return () => { cleanup?.(); };                   // :151-153 — undefined while in flight
  }, [fetchData]);
  ```

  Consequences: (a) the abort function doesn't exist until the fetch already finished, so teardown during flight is a no-op; (b) even if it ran, no signal reaches the adapter; (c) no request-sequence guard → out-of-order completion renders stale data; (d) default params `filters = []` / `params = {}` (`:80-83`) plus the dep array mean unmemoized caller props rebuild `fetchData` every render.
  Note: `FetchDataParams` (`packages/core/src/types/adapter.ts:35-75`) has **no `signal` field** — adding optional `signal?: AbortSignal` to it is a small additive core change included in scope; adapters may ignore it.

- `packages/ui/src/hooks/use-table-url-sync.ts` — three defects:
  1. Timer leak: the `debounce` helper (`:20-33`) holds `timeoutId` in its own closure; the unmount cleanup (`:214-218`) clears `pendingUrlUpdateRef.current`, but that ref is **never assigned anywhere** (declared `:65`; the "clear pending" branch `:203-206` also reads it) — so a queued `setTimeout` fires after unmount.
  2. Hydration stub: when the store doesn't exist yet (`:73-84`), a 100 ms retry finds the store but only sets `hasHydratedFromUrl.current = true` with the comment `// Retry hydration logic here if needed` — URL state is never applied; and the subscribe effect returned early when the store was absent and never re-runs (its deps `[tableId, config, adapter]` haven't changed), so sync never attaches either.
  3. Re-subscribe churn: both effects depend on `config` (`:84`, `:221`), and consumers pass inline objects — `packages/ui/src/components/table/table.tsx:275` builds `urlSync?.config || {…}` inline; `apps/demo/components/users-table-client.tsx:31-40` passes an inline literal — so every render tears down/recreates the subscription and a fresh debounce closure (multiplying leak #1).

- No test infrastructure in `packages/ui`: `"test": "bun test"` exists in package.json but there are no test files, no DOM environment, no React testing dependencies. Bun supports `@happy-dom/global-registrator` + `@testing-library/react` (React 19-compatible versions; `bunfig.toml` `[test] preload` registers the DOM). CI does not run UI at all until plan 001; if 001 landed, it gates UI with typecheck/lint only and expects this plan to add the test job.
- Conventions: hooks are plain functions with JSDoc; core-side state machinery lives in `@better-tables/core` (`getTableStore(tableId)` from the registry). Test assertion style: bun:test `describe/it/expect` (see `packages/core/tests/managers/table-state-manager.test.ts` for the closest structural pattern).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                | exit 0              |
| UI tests  | `cd packages/ui && bun test`             | all pass            |
| Typecheck | `cd packages/ui && bun run typecheck` and `cd packages/core && bun run typecheck` | exit 0 |
| Core tests (signal addition) | `cd packages/core && bun test` | all pass  |
| Build     | `bun run build` (root)                   | exit 0              |

## Scope

**In scope**:
- `packages/ui/src/hooks/use-table-data.ts`
- `packages/ui/src/hooks/use-table-url-sync.ts`
- `packages/ui/src/components/table/table.tsx` — ONLY the inline `urlSync?.config || {…}` stabilization at `:275` (useMemo)
- `packages/core/src/types/adapter.ts` — add optional `signal?: AbortSignal` to `FetchDataParams` (additive)
- `packages/ui/package.json`, `packages/ui/bunfig.toml` (create), test setup file, `packages/ui/tests/**` (create)
- `.github/workflows/test.yml` — add the `test-ui` job (if plan 001 left UI typecheck-only)
- `.changeset/*.md`

**Out of scope** (do NOT touch):
- `virtualized-table.tsx` and `table.tsx` render-performance work (UI-05/06/08 in `plans/README.md`) — separate concern; don't drive-by-memoize.
- The Next.js/vanilla URL adapter implementations beyond what the url-sync fix requires.
- `use-table-store.ts`, `use-filter-validation.ts` — audited clean.

## Git workflow

- Branch: `ui-hooks-correctness`
- Commits: harness first, then characterization tests, then each fix; style: imperative sentence, e.g. "Add happy-dom test harness for the ui package"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Test harness

Add devDeps to `packages/ui` (catalog-consistent versions): `@happy-dom/global-registrator`, `@testing-library/react`, `@testing-library/dom`. Create `packages/ui/bunfig.toml` with `[test] preload = ["./tests/setup.ts"]`; `tests/setup.ts` registers happy-dom globals. Smoke test: render a `<div>` via RTL and assert it mounts.

**Verify**: `cd packages/ui && bun test tests/setup.test.ts` → 1 pass

### Step 2: Characterization tests (write BEFORE fixing — they must fail on the bugs)

`tests/hooks/use-table-data.test.ts` with a stub adapter whose `fetchData` resolves on command (deferred promises):

1. **Race**: trigger fetch A (slow) then fetch B (fast) by changing `filters`; resolve B, then A. EXPECT rendered data = B's. (Fails today: A wins.)
2. **Signal**: assert the stub receives an `AbortSignal` and it's aborted when a newer fetch starts. (Fails today: no signal.)
3. **Unmount**: unmount mid-flight; resolving afterward causes no state update / act warning.

`tests/hooks/use-table-url-sync.test.ts` with a fake `UrlSyncAdapter` (records `setParams` calls) and a real core store via `getTableStore`/store-creation helpers:

4. **Timer leak**: make a state change (queues debounced update), unmount before 150 ms, advance time. EXPECT zero `setParams` calls after unmount. (Fails today.)
5. **Late store hydration**: mount the hook BEFORE the table store exists with URL params carrying a filter; create the store; EXPECT the filter applied to the store ≤ a few hundred ms later. (Fails today: stub.)
6. **Config identity**: re-render 5× with inline-recreated `config`; EXPECT the store subscription count not to grow (instrument via store's subscribe or the adapter call pattern).

**Verify**: `cd packages/ui && bun test` → tests 1, 2, 4, 5 FAIL (red), smoke passes. Commit the red tests with `test:` prefix noting expected failures, or use `it.todo`-style skips flipped in later steps — choose one, state it in the commit.

### Step 3: Fix `useTableData`

- Add `signal?: AbortSignal` to `FetchDataParams` in core (JSDoc: "adapters SHOULD abort or ignore; optional").
- In the hook: keep the current `AbortController` per fetch but (a) store it in a `useRef`, aborting the previous one synchronously at the start of each new fetch AND in the effect cleanup; (b) pass `signal` in `fetchParams`; (c) add a monotonic request id (`useRef` counter) — only the newest request's resolution may call `setData`/`setError`/`setLoading(false)`.
- Effect simplifies to `useEffect(() => { fetchData(); return () => controllerRef.current?.abort(); }, [fetchData])`.
- Document (JSDoc on the options) that `filters`/`params`/`pagination` should be referentially stable; do not add deep-compare magic.

**Verify**: tests 1–3 pass; `cd packages/core && bun test && bun run typecheck` → pass (additive field breaks nothing)

### Step 4: Fix `useTableUrlSync`

- Debounce: return a `cancel()` from the `debounce` helper (clear its internal timer); store the debounced fn + cancel in refs; call `cancel()` in the subscribe-effect cleanup. Delete the never-assigned `pendingUrlUpdateRef` dead code (`:65`, `:203-206`, `:214-218`) — the cancel replaces it.
- Hydration: implement the retry branch — on finding the store, run the SAME hydration routine as the store-present path (extract it to a local function), THEN mark `hasHydratedFromUrl`. Make the subscribe effect re-run when the store appears: simplest robust fix is a `storeReady` state flag set by the retry (add it to both effects' deps). Bound the retry (e.g. 5 attempts × 100 ms) and `console.warn` on giving up.
- Config identity: in `table.tsx:275`, wrap the `urlSync?.config || {…}` in `useMemo` keyed on the primitive fields actually used. In the hook, leave `config` in deps (now stable from the main consumer) — document the stability requirement in JSDoc rather than deep-comparing.

**Verify**: tests 4–6 pass; full `cd packages/ui && bun test` green

### Step 5: CI + changeset

If `.github/workflows/test.yml` lacks a UI test job, add `test-ui` mirroring `test-core` (working-directory `packages/ui`). Changeset: patch `@better-tables/ui`, patch-or-minor `@better-tables/core` (additive `signal` field — minor).

**Verify**: `bun run typecheck && bun run build` (root) → exit 0; `ls .changeset/*.md`

## Test plan

Steps 1–2 define it: 6 characterization tests written red-first (race, signal, unmount, timer leak, late-store hydration, config identity), flipped green by Steps 3–4. This is deliberately test-first — the STOP conditions depend on the red state proving the bugs are real as described.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd packages/ui && bun test` → ≥ 7 tests, all pass
- [ ] `grep -n "pendingUrlUpdateRef" packages/ui/src/hooks/use-table-url-sync.ts` → 0 matches
- [ ] `grep -n "signal" packages/core/src/types/adapter.ts` → the optional field exists with JSDoc
- [ ] `grep -n "Retry hydration logic here if needed" packages/ui/src/hooks/use-table-url-sync.ts` → 0 matches
- [ ] `cd packages/core && bun test` → all pass
- [ ] `bun run typecheck && bun run build` (root) → exit 0
- [ ] CI workflow contains a UI test job
- [ ] `.changeset/*.md` exists
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A characterization test that should be red (1, 2, 4, 5) passes BEFORE the fix — the bug analysis is wrong or drifted; re-verify against the excerpts and report.
- happy-dom + RTL + React 19 + bun test can't render hooks reliably (flaky `act` behavior) after one honest configuration attempt — report the incompatibility with the error; the harness choice may need to change (jsdom, or vitest for this package), which is a maintainer decision.
- Fixing hydration requires changes to the core store registry (`getTableStore` semantics) beyond reading — core lifecycle changes are out of scope; report the coupling.
- The `signal` addition to `FetchDataParams` breaks the Drizzle adapter's typecheck (it shouldn't — optional field) — report rather than patching the adapter here.

## Maintenance notes

- The harness unlocks the rest of the UI backlog (render-perf findings UI-05/06/08 in `plans/README.md` need it for regression tests) — that's the follow-up sequence.
- Reviewers: scrutinize the hydration re-run logic for effect-loop risk (the `storeReady` flag must be set once), and confirm the race fix doesn't drop the loading state on rapid navigation (loading should reflect the NEWEST request).
- When plan 006's contract v2 lands, `signal` should become part of the formal adapter capability story (adapters that honor cancellation advertise it).
