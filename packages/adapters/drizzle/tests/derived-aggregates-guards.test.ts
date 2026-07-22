/**
 * Regression guards for plan-060 derived aggregate lowering
 * (non-numeric filter values, array-FK relations).
 */

import { describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { lowerDerivedAggregateSpec } from '../src/derived-aggregates';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipMap } from '../src/types';
import { QueryError, SchemaError } from '../src/types';
import { relationsSchema, schema } from './helpers/test-schema';

describe('lowerDerivedAggregateSpec guards', () => {
  it('throws SchemaError for array-FK relations', () => {
    const relationships: RelationshipMap = {
      'users.arrayPosts': {
        from: 'users',
        to: 'posts',
        foreignKey: 'userId',
        localKey: 'id',
        cardinality: 'many',
        joinType: 'left',
        isArray: true,
      },
    };
    const manager = new RelationshipManager(schema, relationships);

    expect(() =>
      lowerDerivedAggregateSpec(
        {
          columnId: 'arrayPostsCount',
          kind: 'aggregate',
          relation: 'arrayPosts',
          fn: 'count',
        },
        'users',
        schema,
        manager
      )
    ).toThrow(SchemaError);
  });

  it('throws QueryError when a filter value is non-numeric', () => {
    const detector = new RelationshipDetector();
    const relationships = detector.detectFromSchema(relationsSchema, schema);
    const manager = new RelationshipManager(schema, relationships);
    const config = lowerDerivedAggregateSpec(
      {
        columnId: 'postsCount',
        kind: 'aggregate',
        relation: 'posts',
        fn: 'count',
      },
      'users',
      schema,
      manager
    );

    expect(config.filterSql).toBeDefined();
    // Runtime may still pass non-numeric strings; the guard must reject them.
    const badGt = {
      columnId: 'postsCount',
      type: 'number',
      operator: 'greaterThan',
      values: ['not-a-number'],
    } as unknown as FilterState;
    const badBetween = {
      columnId: 'postsCount',
      type: 'number',
      operator: 'between',
      values: ['1', 'NaN'],
    } as unknown as FilterState;

    expect(() => config.filterSql?.(badGt, { primaryTable: 'users' } as never)).toThrow(QueryError);

    expect(() => config.filterSql?.(badBetween, { primaryTable: 'users' } as never)).toThrow(
      QueryError
    );
  });
});
