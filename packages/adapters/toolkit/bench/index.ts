/**
 * @fileoverview mitata micro-benchmarks for @better-tables/adapters-toolkit
 * (plan 063 Step 4).
 *
 * Trend tier — NOT part of `bun test` (lives in bench/, outside the test
 * globs) and never a PR gate. Absolute numbers are machine-dependent; they
 * feed `bench-results/@better-tables-adapters-toolkit.json`
 * (github-action-benchmark `customSmallerIsBetter` format) for trend
 * tracking on main only.
 *
 * Run with `bun bench/index.ts` from packages/adapters/toolkit, or
 * `bun run bench` at the repo root (turbo). Emitted `value` is mitata's p50
 * (median) of the measured samples, in nanoseconds per iteration.
 *
 * Benches `DataTransformer.transformToNested` on 1k and 10k flat rows,
 * flat-only vs. with a one-to-many relation (4 posts per user). Port
 * construction mirrors tests/data-transformer-cache.test.ts. The growth-
 * RATIO gate for the same operation lives in the Tier-2 test suite; this
 * file only records absolute trend numbers.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bench, do_not_optimize, run } from 'mitata';
import { DataTransformer } from '../src/data-transformer';
import type { ColumnPath, RelationshipManagerPort, SchemaIntrospectionPort } from '../src/types';

const PACKAGE_NAME = '@better-tables/adapters-toolkit';
const ENTRY_PREFIX = 'toolkit';

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
// Toy schema + ports (mirroring tests/data-transformer-cache.test.ts)
// ---------------------------------------------------------------------------

interface ToyTable {
  columns: string[];
  primaryKey: string;
}

const users: ToyTable = { columns: ['id', 'email', 'name', 'age'], primaryKey: 'id' };
const posts: ToyTable = { columns: ['id', 'title', 'userId'], primaryKey: 'id' };
const schema = { users, posts };

const relationshipManager: RelationshipManagerPort = {
  resolveColumnPath(columnId, primaryTable): ColumnPath {
    if (!columnId.includes('.')) {
      return { columnId, table: primaryTable, field: columnId, isNested: false };
    }
    const [, field = ''] = columnId.split('.');
    return {
      columnId,
      table: 'posts',
      field,
      isNested: true,
      relationshipPath: [
        {
          from: primaryTable,
          to: 'posts',
          foreignKey: 'userId',
          localKey: 'id',
          cardinality: 'many',
        },
      ],
    };
  },
  getRelationshipByAlias() {
    return null;
  },
  isArrayRelationship(relationshipPath) {
    return relationshipPath.some((rel) => rel.cardinality === 'many');
  },
};

const schemaPort: SchemaIntrospectionPort<ToyTable> = {
  getColumnNames(table) {
    return table.columns;
  },
  getForeignKeyColumns() {
    return [];
  },
  getPrimaryKeyColumns(table) {
    return [{ name: table.primaryKey, column: table.primaryKey }];
  },
};

// ---------------------------------------------------------------------------
// Datasets (built once; transformToNested does not mutate its input)
// ---------------------------------------------------------------------------

/** N flat rows, one row per user, primary-table columns only. */
function makeFlatRows(count: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = new Array(count);
  for (let i = 0; i < count; i++) {
    rows[i] = {
      id: i + 1,
      email: `user${i}@example.com`,
      name: `User ${i}`,
      age: 18 + (i % 60),
    };
  }
  return rows;
}

/** N flat rows total: N/4 users × 4 posts each (one-to-many JOIN fan-out shape). */
function makeOneToManyRows(count: number): Record<string, unknown>[] {
  const postsPerUser = 4;
  const rows: Record<string, unknown>[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const userId = Math.floor(i / postsPerUser) + 1;
    rows[i] = {
      id: userId,
      email: `user${userId}@example.com`,
      name: `User ${userId}`,
      age: 18 + (userId % 60),
      posts_id: i + 1,
      posts_title: `Post ${i}`,
    };
  }
  return rows;
}

const flatDatasets = new Map<number, Record<string, unknown>[]>([
  [1000, makeFlatRows(1000)],
  [10_000, makeFlatRows(10_000)],
]);

const oneToManyDatasets = new Map<number, Record<string, unknown>[]>([
  [1000, makeOneToManyRows(1000)],
  [10_000, makeOneToManyRows(10_000)],
]);

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

bench('transformToNested.flat.$rows-rows', function* (state) {
  const rows = state.get('rows') as number;
  const data = flatDatasets.get(rows);
  if (!data) throw new Error(`no flat dataset for ${rows}`);
  const transformer = new DataTransformer(schema, relationshipManager, schemaPort);
  yield () =>
    do_not_optimize(transformer.transformToNested(data, 'users', ['email', 'name', 'age']));
}).args('rows', [1000, 10_000]);

bench('transformToNested.one-to-many.$rows-rows', function* (state) {
  const rows = state.get('rows') as number;
  const data = oneToManyDatasets.get(rows);
  if (!data) throw new Error(`no one-to-many dataset for ${rows}`);
  const transformer = new DataTransformer(schema, relationshipManager, schemaPort);
  yield () =>
    do_not_optimize(transformer.transformToNested(data, 'users', ['email', 'posts.title']));
}).args('rows', [1000, 10_000]);

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
