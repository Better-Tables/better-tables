import type { RelationshipManager } from './relationship-manager';
import type { AggregateColumn, AnyTableType, ColumnPath } from './types';

/**
 * Data transformer that converts flat SQL results to nested structures
 */
export class DataTransformer {
  private schema: Record<string, AnyTableType>;
  private relationshipManager: RelationshipManager;
  private mainTable: string;

  constructor(
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    mainTable: string
  ) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    this.mainTable = mainTable;
  }

  /**
   * Transform flat SQL result to nested structure
   */
  transformToNested<TData = Record<string, unknown>>(
    flatData: Record<string, unknown>[],
    columns?: string[]
  ): TData[] {
    if (!flatData || flatData.length === 0) {
      return [];
    }

    // Group data by main table primary key
    const groupedData = this.groupByMainTableKey(flatData);

    // Transform each group to nested structure
    const nestedData: TData[] = [];

    for (const [, records] of groupedData) {
      const nestedRecord = this.buildNestedRecord(records, columns);
      nestedData.push(nestedRecord as TData);
    }

    return nestedData;
  }

  /**
   * Group flat data by main table primary key
   */
  private groupByMainTableKey(
    flatData: Record<string, unknown>[]
  ): Map<string, Record<string, unknown>[]> {
    const grouped = new Map<string, Record<string, unknown>[]>();

    for (const record of flatData) {
      // Assume main table has an 'id' field - this could be made configurable
      const mainKey = String(record.id || record[`${this.mainTable}_id`]);

      if (!grouped.has(mainKey)) {
        grouped.set(mainKey, []);
      }

      const group = grouped.get(mainKey);
      if (group) {
        group.push(record);
      }
    }

    return grouped;
  }

  /**
   * Build nested record from grouped flat records
   */
  private buildNestedRecord(
    records: Record<string, unknown>[],
    columns?: string[]
  ): Record<string, unknown> {
    if (records.length === 0) {
      return {};
    }

    // Use the first record as the base
    const baseRecord = records[0];
    if (!baseRecord) return {};

    const nestedRecord: Record<string, unknown> = { ...baseRecord };

    // Process each column to build nested structure
    if (columns && columns.length > 0) {
      // Group columns by relationship to avoid processing the same relationship multiple times
      const processedRelationships = new Set<string>();

      for (const columnId of columns) {
        const parts = columnId.split('.');
        if (parts.length > 1) {
          // This is a relationship column - use first part as relationship key
          const relationshipKey = parts[0];
          if (relationshipKey && !processedRelationships.has(relationshipKey)) {
            this.processColumn(nestedRecord, columnId, records);
            processedRelationships.add(relationshipKey);
          }
        } else {
          // Direct column - process normally
          this.processColumn(nestedRecord, columnId, records);
        }
      }
    } else {
      // Process all available columns
      const firstRecord = records[0];
      if (firstRecord) {
        const allColumns = this.getAllColumnIds(firstRecord);
        for (const columnId of allColumns) {
          try {
            this.processColumn(nestedRecord, columnId, records);
          } catch {
            // Skip columns that can't be resolved (e.g., table names, invalid paths)
            // This can happen with auto-detected columns from SQL joins
          }
        }
      }
    }

    return nestedRecord;
  }

  /**
   * Process a single column to build nested structure
   */
  private processColumn(
    nestedRecord: Record<string, unknown>,
    columnId: string,
    records: Record<string, unknown>[]
  ): void {
    const columnPath = this.relationshipManager.resolveColumnPath(columnId);

    if (!columnPath.isNested) {
      // Direct column - already in base record
      return;
    }

    if (columnPath.relationshipPath && columnPath.relationshipPath.length > 0) {
      const relationship = columnPath.relationshipPath[0];
      if (!relationship) return;

      if (relationship.cardinality === 'one') {
        this.processOneToOneColumn(nestedRecord, columnPath, records);
      } else {
        this.processOneToManyColumn(nestedRecord, columnPath, records);
      }
    }
  }

  /**
   * Process one-to-one relationship column
   */
  private processOneToOneColumn(
    nestedRecord: Record<string, unknown>,
    columnPath: ColumnPath,
    records: Record<string, unknown>[]
  ): void {
    const relationshipPath = columnPath.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[0];
    if (!relationship) return;

    const realTableName = relationship.to;
    const alias = columnPath.table; // Use the alias from columnPath (e.g., 'profile')

    // Find the first record with data for this relationship
    const relatedRecord = records.find(
      (record) =>
        record[`${realTableName}_${columnPath.field}`] !== null &&
        record[`${realTableName}_${columnPath.field}`] !== undefined
    );

    if (relatedRecord) {
      // Build nested object for the related table
      const relatedData: Record<string, unknown> = {};

      // Extract all columns from the related table
      const relatedColumns = this.getRelatedTableColumns(realTableName);

      for (const col of relatedColumns) {
        const flatKey = `${realTableName}_${col}`;
        if (relatedRecord[flatKey] !== undefined) {
          relatedData[col] = relatedRecord[flatKey];
        }
      }

      nestedRecord[alias] = relatedData; // Use alias as the key
    } else {
      nestedRecord[alias] = null;
    }
  }

  /**
   * Process one-to-many relationship column
   */
  private processOneToManyColumn(
    nestedRecord: Record<string, unknown>,
    columnPath: ColumnPath,
    records: Record<string, unknown>[]
  ): void {
    const relationshipPath = columnPath.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[0];
    if (!relationship) return;

    const realTableName = relationship.to;
    const alias = columnPath.table; // Use the alias from columnPath (e.g., 'posts')

    // Group records by related table primary key
    const relatedRecords = new Map<string, Record<string, unknown>>();

    for (const record of records) {
      const relatedKey = String(record[`${realTableName}_id`] || '');
      if (relatedKey && relatedKey !== 'undefined' && relatedKey !== 'null') {
        if (!relatedRecords.has(relatedKey)) {
          relatedRecords.set(relatedKey, {});
        }

        const relatedData = relatedRecords.get(relatedKey);
        if (!relatedData) continue;

        // Extract all columns from the related table
        const relatedColumns = this.getRelatedTableColumns(realTableName);
        for (const col of relatedColumns) {
          const flatKey = `${realTableName}_${col}`;
          if (record[flatKey] !== undefined) {
            relatedData[col] = record[flatKey];
          }
        }
      }
    }

    nestedRecord[alias] = Array.from(relatedRecords.values()); // Use alias as the key
  }

  /**
   * Get all column IDs from a flat record
   * Handles aliased columns from SQL joins (e.g., profiles_bio, posts_title)
   */
  private getAllColumnIds(record: Record<string, unknown>): string[] {
    const columnIds: string[] = [];
    const mainTableColumns = this.getMainTableColumns();

    for (const key of Object.keys(record)) {
      // Check if it's a main table column (no underscore processing needed)
      if (mainTableColumns.includes(key)) {
        columnIds.push(key);
        continue;
      }

      // Check if this is a main table column with table name prefix (e.g., users_id, users_name)
      if (key.startsWith(`${this.mainTable}_`)) {
        const field = key.substring(this.mainTable.length + 1);
        if (mainTableColumns.includes(field)) {
          columnIds.push(field); // Use the field name without table prefix
          continue;
        }
      }

      // Check if this follows the pattern: tableName_columnName
      // This is a heuristic for detecting joined columns - not all databases use this pattern
      // TODO: In the future, this could be improved by using query builder metadata
      // instead of trying to parse column names from SQL results
      if (key.includes('_')) {
        // Try to find a table name match (longest match first to handle edge cases)
        const tableNames = Object.keys(this.schema).filter((t) => t !== this.mainTable);
        // Sort by length descending to match longest table name first
        tableNames.sort((a, b) => b.length - a.length);

        let foundMatch = false;

        for (const tableName of tableNames) {
          // Check if key starts with tableName_
          if (key.startsWith(`${tableName}_`)) {
            const field = key.substring(tableName.length + 1);
            // Verify the field exists in that table to avoid false matches
            const relatedColumns = this.getRelatedTableColumns(tableName);
            if (relatedColumns.includes(field)) {
              // Confirmed: this is a column from the related table
              // Check if this is a foreign key column by looking at relationships
              const isForeignKey = this.isForeignKeyColumn(tableName, field);

              if (!isForeignKey) {
                columnIds.push(`${tableName}.${field}`);
              }
              foundMatch = true;
              break;
            }
          }
        }

        // If no table match found, treat as main table column (e.g., user_id, created_at)
        if (!foundMatch) {
          columnIds.push(key);
        }
      } else {
        // No underscore - must be a main table column
        columnIds.push(key);
      }
    }

    return columnIds;
  }

  /**
   * Get column names from main table
   */
  private getMainTableColumns(): string[] {
    const table = this.schema[this.mainTable];
    if (!table || typeof table !== 'object') {
      return [];
    }

    const tableObj = table as unknown as Record<string, unknown>;
    if ('_' in tableObj && tableObj._ && typeof tableObj._ === 'object') {
      const meta = tableObj._ as Record<string, unknown>;
      if ('columns' in meta && meta.columns && typeof meta.columns === 'object') {
        return Object.keys(meta.columns);
      }
    }

    return [];
  }

  /**
   * Get columns for a related table
   */
  private getRelatedTableColumns(tableName: string): string[] {
    const table = this.schema[tableName];
    if (!table || typeof table !== 'object') {
      return [];
    }

    const tableObj = table as unknown as Record<string, unknown>;

    // Try _.columns first
    if ('_' in tableObj && tableObj._ && typeof tableObj._ === 'object') {
      const meta = tableObj._ as Record<string, unknown>;
      if ('columns' in meta && meta.columns && typeof meta.columns === 'object') {
        return Object.keys(meta.columns);
      }
    }

    // Fallback: use direct property access
    return Object.keys(tableObj).filter(
      (key) => !key.startsWith('_') && typeof tableObj[key] === 'object' && tableObj[key] !== null
    );
  }

  /**
   * Handle one-to-many relationships with aggregation
   */
  handleOneToManyAggregates<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[],
    aggregateColumns: AggregateColumn[]
  ): TData[] {
    for (const record of data) {
      for (const aggregateCol of aggregateColumns) {
        this.applyAggregateToRecord(record as Record<string, unknown>, aggregateCol);
      }
    }

    return data;
  }

  /**
   * Apply aggregate to a single record
   */
  private applyAggregateToRecord(
    record: Record<string, unknown>,
    aggregateCol: AggregateColumn
  ): void {
    const relationshipPath = aggregateCol.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[0];
    if (!relationship) return;

    const relatedTable = relationship.to;

    if (record[relatedTable] && Array.isArray(record[relatedTable])) {
      const relatedRecords = record[relatedTable];

      switch (aggregateCol.function) {
        case 'count':
          record[aggregateCol.columnId] = relatedRecords.length;
          break;
        case 'sum':
          record[aggregateCol.columnId] = relatedRecords.reduce(
            (sum: number, r: Record<string, unknown>) => sum + (Number(r[aggregateCol.field]) || 0),
            0
          );
          break;
        case 'avg': {
          const sum = relatedRecords.reduce(
            (sum: number, r: Record<string, unknown>) => sum + (Number(r[aggregateCol.field]) || 0),
            0
          );
          record[aggregateCol.columnId] =
            relatedRecords.length > 0 ? sum / relatedRecords.length : 0;
          break;
        }
        case 'min':
          record[aggregateCol.columnId] = Math.min(
            ...relatedRecords.map(
              (r: Record<string, unknown>) => Number(r[aggregateCol.field]) || Infinity
            )
          );
          break;
        case 'max':
          record[aggregateCol.columnId] = Math.max(
            ...relatedRecords.map(
              (r: Record<string, unknown>) => Number(r[aggregateCol.field]) || -Infinity
            )
          );
          break;
      }
    } else {
      record[aggregateCol.columnId] = 0;
    }
  }

  /**
   * Apply column accessors to transformed data
   */
  applyAccessors<TData = Record<string, unknown>>(
    data: TData[],
    accessors: Map<string, (data: TData) => unknown>
  ): TData[] {
    return data.map((record) => {
      const processedRecord = { ...record };

      for (const [columnId, accessor] of accessors) {
        try {
          (processedRecord as Record<string, unknown>)[columnId] = accessor(record);
        } catch {
          // Silently handle accessor errors
          // console.warn(`Error applying accessor for column ${columnId}:`, error);
          (processedRecord as Record<string, unknown>)[columnId] = null;
        }
      }

      return processedRecord;
    });
  }

  /**
   * Handle null/undefined values in related records
   */
  handleNullValues<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[]
  ): TData[] {
    return data.map((record) => {
      const processedRecord = { ...record };

      // Process each property
      for (const [key, value] of Object.entries(processedRecord)) {
        if (value === null || value === undefined) {
          // Check if this is a relationship field
          const columnPath = this.relationshipManager.resolveColumnPath(key);

          if (columnPath.isNested) {
            // Set to null for one-to-one, empty array for one-to-many
            const relationship = columnPath.relationshipPath?.[0];
            if (relationship?.cardinality === 'many') {
              (processedRecord as Record<string, unknown>)[key] = [];
            } else {
              (processedRecord as Record<string, unknown>)[key] = null;
            }
          }
        }
      }

      return processedRecord;
    });
  }

  /**
   * Flatten nested data back to flat structure (for debugging)
   */
  flattenNestedData<TData extends Record<string, unknown> = Record<string, unknown>>(
    nestedData: TData[]
  ): Record<string, unknown>[] {
    const flattened: Record<string, unknown>[] = [];

    for (const record of nestedData) {
      const flatRecord = this.flattenRecord(record as Record<string, unknown>);
      flattened.push(flatRecord);
    }

    return flattened;
  }

  /**
   * Flatten a single nested record
   */
  private flattenRecord(record: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      const flatKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - recurse
        const nested = this.flattenRecord(value as Record<string, unknown>, flatKey);
        Object.assign(flattened, nested);
      } else if (Array.isArray(value)) {
        // Array - handle each item
        flattened[flatKey] = value;
      } else {
        // Primitive value
        flattened[flatKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Validate transformed data structure
   */
  validateTransformedData<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[]
  ): boolean {
    try {
      for (const record of data) {
        if (!record || typeof record !== 'object') {
          return false;
        }

        // Check for required fields
        const recordObj = record as Record<string, unknown>;
        if (!recordObj.id && !recordObj[`${this.mainTable}_id`]) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get transformation statistics
   */
  getTransformationStats<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[]
  ): {
    totalRecords: number;
    nestedRelationships: number;
    nullValues: number;
    arrayFields: number;
  } {
    const stats = {
      totalRecords: data.length,
      nestedRelationships: 0,
      nullValues: 0,
      arrayFields: 0,
    };

    for (const record of data) {
      const recordObj = record as Record<string, unknown>;
      for (const [, value] of Object.entries(recordObj)) {
        if (value === null || value === undefined) {
          stats.nullValues++;
        } else if (Array.isArray(value)) {
          stats.arrayFields++;
        } else if (value && typeof value === 'object') {
          stats.nestedRelationships++;
        }
      }
    }

    return stats;
  }

  /**
   * Check if a column is a foreign key by examining relationships
   * This is more generic than hardcoded naming patterns
   */
  private isForeignKeyColumn(tableName: string, columnName: string): boolean {
    // Check if this column is used as a foreign key in any relationship
    for (const relationship of Object.values(this.relationshipManager.getRelationships())) {
      // Check if this column is the foreign key in this relationship
      if (relationship.from === tableName && relationship.foreignKey === columnName) {
        return true;
      }
    }

    return false;
  }
}
