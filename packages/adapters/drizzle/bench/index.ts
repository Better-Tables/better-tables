/**
 * @fileoverview mitata micro-benchmarks for @better-tables/adapters-drizzle
 * (plan 063 Step 4).
 *
 * Trend tier — NOT part of `bun test` (lives in bench/, outside the test
 * globs) and never a PR gate. Absolute numbers are machine-dependent; they
 * feed `bench-results/@better-tables-adapters-drizzle.json`
 * (github-action-benchmark `customSmallerIsBetter` format) for trend
 * tracking on main only.
 *
 * Run with `bun bench/index.ts` from packages/adapters/drizzle, or
 * `bun run bench` at the repo root (turbo). Emitted `value` is mitata's p50
 * (median) of the measured samples, in nanoseconds per iteration.
 *
 * Measurement choice (plan 063 Step 4): `fetchData` runs end-to-end against
 * an in-memory bun:sqlite database seeded with the shared 3-row test fixture
 * (tests/helpers/test-fixtures.ts). Isolating "pure SQL generation" would
 * mean benching private query-builder internals — a brittle, non-public
 * seam — so these numbers are SQL generation + statement execution against
 * a trivially small :memory: dataset; generation dominates. The adapter's
 * LRU result cache is DISABLED so every iteration regenerates SQL instead
 * of measuring a cache hit.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FilterGroupNode, FilterState } from '@better-tables/core';
import { bench, do_not_optimize, run } from 'mitata';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../src/types';
import { createSQLiteDatabase, setupSQLiteDatabase } from '../tests/helpers/test-fixtures';
import { relationsSchema, schema } from '../tests/helpers/test-schema';

const PACKAGE_NAME = '@better-tables/adapters-drizzle';
const ENTRY_PREFIX = 'drizzle';

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
// Adapter over in-memory bun:sqlite (mirrors tests/helpers/test-fixtures.ts's
// createSQLiteAdapter, plus a disabled result cache so repeat fetchData calls
// regenerate SQL instead of hitting the plan-040 LRU)
// ---------------------------------------------------------------------------

const { db } = createSQLiteDatabase();
await setupSQLiteDatabase(db);

const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
  // Same cast rationale as tests/helpers/test-fixtures.ts: the suite runs on
  // bun:sqlite while the adapter types assume better-sqlite3; the query API
  // surface used here is identical across both drivers.
  db: db as unknown as DrizzleDatabase<'sqlite'>,
  schema,
  driver: 'sqlite',
  autoDetectRelationships: true,
  relations: relationsSchema,
  options: { defaultPrimaryTable: 'users', cache: { enabled: false, ttl: 0 } },
};

const adapter = new DrizzleAdapter(config);

// ---------------------------------------------------------------------------
// Filter fixtures
// ---------------------------------------------------------------------------

/** 20 AND-ed leaves cycling over users.name/email (text) and users.age (number). */
function makeLeafFilters(count: number): FilterState[] {
  const leaves: FilterState[] = [];
  for (let i = 0; i < count; i++) {
    switch (i % 4) {
      case 0:
        leaves.push({ columnId: 'name', type: 'text', operator: 'contains', values: [`n${i}`] });
        break;
      case 1:
        leaves.push({ columnId: 'email', type: 'text', operator: 'contains', values: [`e${i}`] });
        break;
      case 2:
        leaves.push({ columnId: 'age', type: 'number', operator: 'greaterThan', values: [i] });
        break;
      default:
        leaves.push({ columnId: 'age', type: 'number', operator: 'lessThan', values: [100 + i] });
    }
  }
  return leaves;
}

const leafFilters20 = makeLeafFilters(20);

/** Depth-3 AND(leaf, OR(leaf, AND(leaf, leaf)), OR(leaf, leaf)) tree. */
const depth3Tree: FilterGroupNode = {
  kind: 'group',
  logic: 'and',
  children: [
    { columnId: 'age', type: 'number', operator: 'greaterThan', values: [18] },
    {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['Jo'] },
        {
          kind: 'group',
          logic: 'and',
          children: [
            { columnId: 'age', type: 'number', operator: 'lessThan', values: [40] },
            { columnId: 'email', type: 'text', operator: 'endsWith', values: ['example.com'] },
          ],
        },
      ],
    },
    {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'email', type: 'text', operator: 'contains', values: ['j'] },
        { columnId: 'name', type: 'text', operator: 'startsWith', values: ['B'] },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

bench('fetchData.no-filters', async () => {
  do_not_optimize(await adapter.fetchData({ pagination: { page: 1, limit: 10 } }));
});

bench('fetchData.20-leaf-filters', async () => {
  do_not_optimize(
    await adapter.fetchData({ filters: leafFilters20, pagination: { page: 1, limit: 10 } })
  );
});

bench('fetchData.depth-3-tree', async () => {
  do_not_optimize(
    await adapter.fetchData({ filters: depth3Tree, pagination: { page: 1, limit: 10 } })
  );
});

// Relational column selection: one-to-one (profile.bio) + one-to-many
// (posts.title) → JOIN generation and the plan-020 two-phase fan-out path.
bench('fetchData.relational-columns', async () => {
  do_not_optimize(
    await adapter.fetchData({
      columns: ['id', 'name', 'email', 'profile.bio', 'posts.title'],
      pagination: { page: 1, limit: 10 },
    })
  );
});

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

const file = writeBenchResults(entries);
// biome-ignore lint/suspicious/noConsole: bench reporter output
console.log(`wrote ${entries.length} entries to ${file}`);
