/**
 * Plan 063 Step 3 — Tier 2 growth-ratio gates for the toolkit's flat→nested
 * transformer.
 *
 * Same method as the drizzle scale-growth suite: run the identical
 * transform over 1,000 and 10,000 flat rows and bound the 10k/1k RATIO
 * (ratios cancel host speed; an accidental O(n²) — the exact regression
 * class plan 040's hoists removed — lands ~100×, far past the 15× bound).
 * Each timed sample runs the op `BATCH` (20) times so even the 1k case
 * measures well above timer resolution (no denominator floor needed; BATCH
 * cancels out of the ratio). The only absolute assertion is a catastrophic
 * ceiling on the BATCH total.
 *
 * Port construction mirrors tests/data-transformer-cache.test.ts (and the
 * bench/ suite): a toy schema-introspection + relationship-manager pair,
 * `users` primary with a one-to-many `posts` relation (4 posts per user in
 * the fan-out dataset).
 */

import { describe, expect, it } from 'bun:test';
import { DataTransformer } from '../src/data-transformer';
import type { ColumnPath, RelationshipManagerPort, SchemaIntrospectionPort } from '../src/types';

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

// Run the op BATCH times inside each timed sample. Batching pushes even the
// fast 1k case well above timer resolution, so the 10k/1k ratio never needs a
// denominator floor (which could otherwise mask a real regression when the 1k
// time dips into sub-millisecond noise). BATCH cancels out of the ratio.
const BATCH = 20;

/** Median of 5 batched runs after 1 discarded warm-up (plan 063 method). */
function medianBatchMs(op: () => unknown): number {
  for (let i = 0; i < BATCH; i++) op(); // warm-up batch, discarded
  const samples: number[] = [];
  for (let s = 0; s < 5; s++) {
    const start = performance.now();
    for (let i = 0; i < BATCH; i++) op();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[2] as number;
}

const ratioOf = (t10k: number, t1k: number): number => t10k / t1k;

describe('DataTransformer — 10k/1k growth ratios (plan 063 Step 3)', () => {
  it('flat transform grows ≤ 15× from 1k to 10k rows', () => {
    const flat1k = makeFlatRows(1_000);
    const flat10k = makeFlatRows(10_000);
    const transformer = new DataTransformer(schema, relationshipManager, schemaPort);
    const columns = ['email', 'name', 'age'];

    const t1k = medianBatchMs(() => transformer.transformToNested(flat1k, 'users', columns));
    const t10k = medianBatchMs(() => transformer.transformToNested(flat10k, 'users', columns));
    const ratio = ratioOf(t10k, t1k);
    console.log(
      `[transformer-growth batched] flat: 1k=${t1k.toFixed(3)}ms 10k=${t10k.toFixed(3)}ms ratio=${ratio.toFixed(2)}`
    );

    expect(ratio).toBeLessThanOrEqual(15);
    expect(t10k).toBeLessThan(2_000);
  }, 30_000);

  it('one-to-many transform (4 posts/user fan-out) grows ≤ 15× from 1k to 10k flat rows', () => {
    const fanOut1k = makeOneToManyRows(1_000);
    const fanOut10k = makeOneToManyRows(10_000);
    const transformer = new DataTransformer(schema, relationshipManager, schemaPort);
    const columns = ['email', 'name', 'posts.title'];

    const t1k = medianBatchMs(() => transformer.transformToNested(fanOut1k, 'users', columns));
    const t10k = medianBatchMs(() => transformer.transformToNested(fanOut10k, 'users', columns));
    const ratio = ratioOf(t10k, t1k);
    console.log(
      `[transformer-growth batched] one-to-many: 1k=${t1k.toFixed(3)}ms 10k=${t10k.toFixed(3)}ms ratio=${ratio.toFixed(2)}`
    );

    expect(ratio).toBeLessThanOrEqual(15);
    expect(t10k).toBeLessThan(2_000);
  }, 30_000);
});
