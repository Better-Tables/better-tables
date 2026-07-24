/**
 * @fileoverview mitata micro-benchmarks for @better-tables/core (plan 063 Step 4).
 *
 * Trend tier — NOT part of `bun test` (lives in bench/, outside the test
 * globs) and never a PR gate. Absolute numbers are machine-dependent; they
 * feed `bench-results/@better-tables-core.json` (github-action-benchmark
 * `customSmallerIsBetter` format) for trend tracking on main only.
 *
 * Run with `bun bench/index.ts` from packages/core, or `bun run bench` at
 * the repo root (turbo). Emitted `value` is mitata's p50 (median) of the
 * measured samples, in nanoseconds per iteration.
 *
 * This file ALSO re-measures the plan 031/018 type-perf fixtures with
 * `tsc --extendedDiagnostics` and appends their instantiation counts as
 * `unit: "instantiations"` entries, so the trend graph tracks compile-time
 * cost next to runtime cost (plan 063 Step 5). The blocking budget for those
 * lives in tests/types/type-perf-gate.test.ts — here they are trend-only.
 *
 * Fixture construction mirrors tests/managers/*.test.ts idioms.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bench, do_not_optimize, run } from 'mitata';
import { FilterManager } from '../src/managers/filter-manager';
import { PaginationManager } from '../src/managers/pagination-manager';
import { SortingManager } from '../src/managers/sorting-manager';
import type { ColumnDefinition } from '../src/types/column';
import type { FilterGroupNode, FilterState } from '../src/types/filter';
import type { PaginationState } from '../src/types/pagination';
import type { SortingState } from '../src/types/sorting';
import { serializeFiltersToURL } from '../src/utils/filter-serialization';
import { serializeTableStateToUrl } from '../src/utils/url-serialization';

const PACKAGE_NAME = '@better-tables/core';
const ENTRY_PREFIX = 'core';

/** github-action-benchmark `customSmallerIsBetter` entry. */
interface BenchEntry {
  name: string;
  unit: string;
  value: number;
}

/** Write entries to <package>/bench-results/<package-name>.json. */
function writeBenchResults(entries: BenchEntry[]): string {
  const dir = join(import.meta.dir, '..', 'bench-results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${PACKAGE_NAME.replace('/', '-')}.json`);
  writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
  return file;
}

// ---------------------------------------------------------------------------
// Fixtures (mirroring tests/managers/*.test.ts construction idioms)
// ---------------------------------------------------------------------------

/** Text/number/option column mix, all filterable+sortable, like the FilterManager suite. */
function makeColumns(count: number): ColumnDefinition[] {
  const columns: ColumnDefinition[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      columns.push({
        id: `text${i}`,
        displayName: `Text ${i}`,
        type: 'text',
        accessor: (row: unknown) => (row as Record<string, unknown>)[`text${i}`],
        filterable: true,
        sortable: true,
      });
    } else if (i % 3 === 1) {
      columns.push({
        id: `num${i}`,
        displayName: `Number ${i}`,
        type: 'number',
        accessor: (row: unknown) => (row as Record<string, unknown>)[`num${i}`],
        filterable: true,
        sortable: true,
      });
    } else {
      columns.push({
        id: `opt${i}`,
        displayName: `Option ${i}`,
        type: 'option',
        accessor: (row: unknown) => (row as Record<string, unknown>)[`opt${i}`],
        filterable: true,
        sortable: true,
        filter: {
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      });
    }
  }
  return columns;
}

/** One valid leaf filter per column (type-matched operator + values). */
function makeLeafFilters(columns: ColumnDefinition[]): FilterState[] {
  return columns.map((column, i): FilterState => {
    if (column.type === 'number') {
      return { columnId: column.id, type: 'number', operator: 'greaterThan', values: [i] };
    }
    if (column.type === 'option') {
      return { columnId: column.id, type: 'option', operator: 'is', values: ['a'] };
    }
    return { columnId: column.id, type: 'text', operator: 'contains', values: [`v${i}`] };
  });
}

const columns50 = makeColumns(50);
const leafFilters50 = makeLeafFilters(columns50);

/** Depth-3 FilterGroupNode built fresh per call — the "build" half of the bench. */
function buildDepth3Node(): FilterGroupNode {
  return {
    kind: 'group',
    logic: 'and',
    children: [
      { columnId: 'num1', type: 'number', operator: 'greaterThan', values: [18] },
      {
        kind: 'group',
        logic: 'or',
        children: [
          { columnId: 'text0', type: 'text', operator: 'contains', values: ['Jo'] },
          { columnId: 'opt2', type: 'option', operator: 'is', values: ['a'] },
          {
            kind: 'group',
            logic: 'and',
            children: [
              { columnId: 'num4', type: 'number', operator: 'lessThan', values: [40] },
              { columnId: 'text3', type: 'text', operator: 'endsWith', values: ['@example.com'] },
            ],
          },
        ],
      },
      {
        kind: 'group',
        logic: 'or',
        children: [
          { columnId: 'text6', type: 'text', operator: 'startsWith', values: ['B'] },
          {
            kind: 'group',
            logic: 'and',
            children: [
              { columnId: 'num7', type: 'number', operator: 'between', values: [10, 90] },
              { columnId: 'opt5', type: 'option', operator: 'isNot', values: ['b'] },
            ],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

{
  // Real page changes on a large dataset: 100k rows / limit 10 = 10k pages.
  // Alternate 2 ↔ 3 so every call is a genuine page change (no no-op path).
  const pagination = new PaginationManager({}, { page: 1, limit: 10 });
  pagination.setTotal(100_000);
  let flip = false;
  bench('pagination.goToPage', () => {
    flip = !flip;
    pagination.goToPage(flip ? 2 : 3);
  });
}

{
  // toggleSort cycles asc → desc → none, so every call mutates state.
  const sorting = new SortingManager(makeColumns(3));
  bench('sorting.toggleSort', () => {
    sorting.toggleSort('text0');
  });
}

{
  // Replace-all with a 50-leaf flat array: measures per-leaf validation
  // (column lookup, type/operator checks) + replace + notify.
  const filterManager = new FilterManager(columns50);
  bench('filter.setFilters.50-leaves', () => {
    filterManager.setFilters(leafFilters50);
  });
}

// Build a depth-3 AND(OR(AND)) tree and serialize it to the URL wire format
// (key-shortening + lz-string), the round trip a tree-shaped filter state
// pays on every URL sync.
bench('filter-node.build+serialize.depth-3', () => {
  do_not_optimize(serializeFiltersToURL(buildDepth3Node()));
});

// Whole-table-state URL serialization at 1 / 10 / 50 filters — dominated by
// lz-string compression cost as the filter payload grows.
bench('url-state.serialize.$filters-filters', function* (state) {
  const count = state.get('filters') as number;
  const filters = leafFilters50.slice(0, count);
  const pagination: PaginationState = {
    page: 3,
    limit: 25,
    totalPages: 40,
    hasNext: true,
    hasPrev: true,
  };
  const sorting: SortingState = [{ columnId: 'text0', direction: 'asc' }];
  yield () => do_not_optimize(serializeTableStateToUrl({ filters, pagination, sorting }));
}).args('filters', [1, 10, 50]);

// ---------------------------------------------------------------------------
// Type-perf fixture instantiation counts (trend entries; gate lives in
// tests/types/type-perf-gate.test.ts). Measured via the per-fixture
// tsconfigs (real package options + skipLibCheck), so counts reflect the
// fixture, not stdlib churn — NOT comparable to the old manual bare-file
// numbers in plans/design/table-definition-dx.md.
// ---------------------------------------------------------------------------

async function measureInstantiations(projectRelPath: string): Promise<number> {
  const packageRoot = join(import.meta.dir, '..');
  // `-p <fixture tsconfig>` (NOT a bare `tsc <file>`): bare file mode
  // ignores tsconfig — default ES5 target breaks src imports, strictness
  // differs, and every hoisted @types package auto-loads. The per-fixture
  // configs extend the real package options with only @types/node.
  const proc = Bun.spawn(['bunx', 'tsc', '-p', projectRelPath, '--extendedDiagnostics'], {
    cwd: packageRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`tsc failed (exit ${exitCode}) for ${fixtureRelPath}:\n${stdout}\n${stderr}`);
  }
  const match = stdout.match(/^Instantiations:\s+([\d,]+)/m);
  if (!match?.[1]) {
    throw new Error(`could not parse Instantiations from tsc output for ${fixtureRelPath}`);
  }
  return Number(match[1].replaceAll(',', ''));
}

// ---------------------------------------------------------------------------
// Run + report
// ---------------------------------------------------------------------------

const result = await run();

const entries: BenchEntry[] = [];
for (const trial of result.benchmarks) {
  for (const benchRun of trial.runs) {
    if (benchRun.error !== undefined || benchRun.stats === undefined) {
      throw new Error(`bench "${benchRun.name}" failed: ${String(benchRun.error)}`);
    }
    entries.push({
      name: `${ENTRY_PREFIX}/${benchRun.name}`,
      unit: 'ns',
      value: Math.round(benchRun.stats.p50 * 100) / 100,
    });
  }
}

for (const fixture of [
  {
    entry: 'core/types.filter-fixture.instantiations',
    path: 'tests/types/tsconfig.filter-perf.json',
  },
  {
    entry: 'core/types.table-def-fixture.instantiations',
    path: 'tests/types/tsconfig.table-def-perf.json',
  },
]) {
  const instantiations = await measureInstantiations(fixture.path);
  entries.push({ name: fixture.entry, unit: 'instantiations', value: instantiations });
  // biome-ignore lint/suspicious/noConsole: bench reporter output
  console.log(`${fixture.entry}: ${instantiations}`);
}

const file = writeBenchResults(entries);
// biome-ignore lint/suspicious/noConsole: bench reporter output
console.log(`wrote ${entries.length} entries to ${file}`);
