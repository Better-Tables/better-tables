/**
 * @fileoverview Adapter metadata builder for Drizzle adapter
 * @module @better-tables/drizzle-adapter/adapter-meta
 */

import type { AdapterFeatures, AdapterMeta, ColumnType, FilterOperator } from '@better-tables/core';
import { COLUMN_TYPES, getOperatorsForType } from '@better-tables/core';

export function buildAdapterMeta(
  mutationsResolvable: boolean,
  customMeta?: Partial<AdapterMeta>
): AdapterMeta {
  const features: AdapterFeatures = {
    create: mutationsResolvable,
    read: true,
    update: mutationsResolvable,
    delete: mutationsResolvable,
    bulkOperations: mutationsResolvable,
    realTimeUpdates: true,
    export: true,
    transactions: true,
  };

  const supportedColumnTypes: ColumnType[] = [...COLUMN_TYPES];
  const supportedOperators = Object.fromEntries(
    supportedColumnTypes.map((type) => [
      type,
      getOperatorsForType(type).map((o) => o.key as FilterOperator),
    ])
  ) as Record<ColumnType, FilterOperator[]>;

  return {
    name: customMeta?.name || 'Drizzle Adapter',
    version: customMeta?.version || '1.0.0',
    features,
    supportedColumnTypes,
    supportedOperators,
    supportsFilterGroups: true,
    maxGroupDepth: 3,
    capabilities: {
      aggregates: {
        fns: ['count', 'sum', 'avg', 'min', 'max'],
        render: true,
        filter: true,
        sort: true,
      },
    },
    ...customMeta,
  };
}
