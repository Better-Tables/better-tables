/**
 * Serializable server-derived column specs (plan 060).
 *
 * Specs ride `FetchDataParams.derived` and must never carry functions or SQL
 * strings — adapters validate identifiers against their schema.
 *
 * @see plans/design/derived-columns.md
 */

/** Aggregate functions supported by derived columns. `distinct` is deferred. */
export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max';

/** Field-requiring aggregate fns (everything except `count`). */
export type AggregateFnWithField = Exclude<AggregateFn, 'count'>;

/**
 * Declarative aggregate over a single-hop many-relation on the primary table.
 *
 * Discriminated on `fn`: `count` has no field; sum/avg/min/max require `field`.
 *
 * @example
 * ```ts
 * { kind: 'aggregate', relation: 'posts', fn: 'count' }
 * { kind: 'aggregate', relation: 'orders', fn: 'sum', field: 'amount' }
 * ```
 */
export type DerivedColumnSpec =
  | {
      kind: 'aggregate';
      /** Relation name on the primary table (e.g. `'posts'`). Single hop. */
      relation: string;
      fn: 'count';
      field?: undefined;
    }
  | {
      kind: 'aggregate';
      relation: string;
      fn: AggregateFnWithField;
      /** Numeric column on the related table. */
      field: string;
    };

/** A derived spec bound to its column id for fetch transport. */
export type DerivedFetchSpec = { columnId: string } & DerivedColumnSpec;

/**
 * Per-operation aggregate capability (Prisma can render/sort relation counts
 * but not filter by them — a flat fn list cannot express that).
 */
export interface AggregateCapabilities {
  fns: AggregateFn[];
  render: boolean;
  filter: boolean;
  sort: boolean;
}

/** Optional adapter capability contributions. */
export interface AdapterCapabilities {
  aggregates?: AggregateCapabilities;
}
