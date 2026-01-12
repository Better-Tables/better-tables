# @better-tables/adapters-drizzle

## 0.5.31

### Patch Changes

- Updated DrizzleAdapter and related types to automatically filter out relations from the schema, ensuring only tables are used for type inference and operations. Introduced InferSelectModelFromFilteredSchema type for improved type safety and replaced direct usage of InferSelectModel<TSchema[keyof TSchema]>. Adjusted DrizzleAdapterConfig, computed fields, and method signatures to align with the new schema filtering approach.

## 0.5.30

### Patch Changes

- Introduces a utility type and function to filter out relations from Drizzle schemas, ensuring only actual table types are passed to the adapter. Updates factory functions and type inference to use filtered schemas, improving type safety and preventing relations from being incorrectly included in adapter operations.

## 0.5.29

### Patch Changes

- Updated the filtering system to support an "Include Unknown" checkbox for nullable columns, allowing users to include rows with null values in their filter results. Refactored column builders to replace nullableAccessor with accessorWithDefault for better handling of default values. Updated documentation and examples to reflect these changes, ensuring clarity on the new filtering behavior.
- Updated dependencies
  - @better-tables/core@0.5.6

## 0.5.28

### Patch Changes

- Updated dependencies
  - @better-tables/core@0.5.5

## 0.5.27

### Patch Changes

- Updated dependencies
  - @better-tables/core@0.5.4

## 0.5.26

### Patch Changes

- Skip relational queries when computed fields require SQL expressions in PostgresQueryBuilder. This change ensures compatibility by avoiding raw SQL in SELECT for relational queries, enhancing the handling of computed fields during query construction.

## 0.5.25

### Patch Changes

- Add `sortSql` support for computed fields, enabling efficient database-level sorting. Computed field SQL expressions are now injected into SELECT and ORDER BY clauses with proper identifier escaping to prevent SQL injection. The adapter filters out computed fields from query context building and includes database-specific SQL identifier quoting. Also fixes date handling by converting Date objects to ISO strings for PostgreSQL and MySQL, and refines the 'isNot' operator using De Morgan's law for better cross-database compatibility.

## 0.5.24

### Patch Changes

- Enhance FilterHandler date comparison logic to support full-day range matching for 'is' and 'isNot' operators. Update 'before' and 'after' operators to consider start and end of day in UTC, improving accuracy in date filtering.

## 0.5.23

### Patch Changes

- Introduced a new method to identify timestamp columns, allowing for correct date comparisons in filter conditions even when the column type is not explicitly set to 'date'. Added comprehensive tests for PostgreSQL, MySQL, and SQLite to validate the new functionality.

## 0.5.22

### Patch Changes

- Adds filterSql to computed fields to push conditions into the WHERE clause (before pagination) for faster queries on large datasets. Also adds filter handler hooks and safer batching for huge arrays to improve flexibility and reliability. New FeaturesComputed fields: filterSql returns SQL directly; preferred over filter; applied before pagination.Extensibility hooks: beforeBuildFilterCondition, afterBuildFilterCondition, buildLargeArrayCondition. Batching options: batchSize, maxBatchesPerGroup, enableNestedGrouping for large arrays.

## 0.5.21

### Patch Changes

- Enhance PostgreSQL integration tests to utilize parameterized queries for large arrays. Added tests for handling 50 and 51 values, ensuring proper functionality with new batch sizes. Updated existing tests to use parameterized queries for improved security and reliability.

## 0.5.20

### Patch Changes

- This update modifies the `buildLargeArrayAnyCondition` and `buildLargeArrayAllCondition` methods in the FilterHandler class to handle large arrays more efficiently. Instead of using parameterized array literals, the methods now batch values into smaller chunks (1000 values each) and utilize batched VALUES clauses combined with OR and AND conditions. This change addresses parameter binding issues while maintaining security through proper parameterization, enhancing the robustness of SQL condition generation for large arrays.

## 0.5.19

### Patch Changes

- Add getPostgresColumnType method to FilterHandler for type inference. This update introduces a new private method, `getPostgresColumnType`, to the FilterHandler class. This method determines the PostgreSQL type name for a given column, enhancing type safety when building SQL conditions. The `buildLargeArrayAnyCondition` and `buildLargeArrayAllCondition` methods have been updated to utilize this new method, allowing for proper type casting of arrays in SQL expressions, thereby preventing type mismatch errors. This change improves the robustness and reliability of array handling in PostgreSQL.

## 0.5.18

### Patch Changes

- This update introduces the autoShowFilteredColumns property to the BetterTable component, allowing columns to automatically show or hide based on active filters. When a filter is applied, the corresponding column becomes visible, and it hides again if the filter is removed, provided it is not in the defaultVisibleColumns. The implementation includes a useEffect hook to manage column visibility state based on filter changes.

## 0.5.17

### Patch Changes

- This update introduces a new property `requiresColumn` in the `ComputedFieldConfig` interface, allowing computed fields to specify if they need the underlying database column to be fetched. The DrizzleAdapter has been modified to track and include these columns in the SELECT statement, ensuring proper handling of computed fields that depend on real column values. Additionally, the logic for filtering columns has been refined to accommodate this new functionality.

## 0.5.16

### Patch Changes

- Fix relationship handling in RelationshipManager to prioritize relationship checks over column checks. This change addresses cases where a column name may conflict with a relationship alias, ensuring proper validation and error handling for relationships and columns.

## 0.5.15

### Patch Changes

- Adds checks to skip records when the primary key cannot be determined and ensures getPrimaryKeyName always returns a valid string. This aligns behavior with groupByMainTableKey and prevents issues with undefined or invalid primary key names.

## 0.5.14

### Patch Changes

- This update refines the DataTransformer class to better manage nested data structures. Key changes include improved detection of nested vs. flat data, enhanced grouping logic for primary keys, and optimized processing of relationship columns. The logic now ensures that all relevant fields are preserved, including handling edge cases for empty relationships and direct columns. Additionally, the code has been structured for better clarity and maintainability, supporting more robust data transformations in relational queries.

## 0.5.13

### Patch Changes

- This update introduces the ComputedFieldContext type to enhance type definitions related to computed fields in the DrizzleAdapter.

## 0.5.12

### Patch Changes

- This update introduces computed fields functionality, allowing users to define virtual columns that are calculated at runtime. The implementation includes examples for basic computations, database queries, and filtering support. Additionally, it enhances the DrizzleAdapter to handle computed fields efficiently, including batch processing and error handling. Documentation has been updated to reflect these changes, providing clear guidance on usage and best practices.

## 0.5.11

### Patch Changes

- This update introduces logic to the DataTransformer for removing flattened fields from related tables after constructing a nested structure. It ensures that only direct columns from the primary table, nested relationship objects, and JSON accessor fields are retained, improving the handling of nested data structures in relational queries

## 0.5.10

### Patch Changes

- This update introduces functionality to the DataTransformer to detect and handle nested data structures from relational queries. It adds methods for filtering nested data to include only requested columns and checks if data is already nested. Additionally, the query builders (Postgres, MySQL, SQLite) are updated to pass an `isNested` flag, ensuring proper handling of nested data during transformations. The RelationshipDetector is also enhanced to merge manual relationships while preserving the `isArray` flag, improving overall relationship management. It introduces functionality to filter nested data by requested columns and handle various relationship types, including one-to-one and array relationships. Additionally, the PostgresQueryBuilder is enhanced to support fallback mechanisms for manual joins when the relational API is unavailable, ensuring robust query handling. The RelationshipManager is also improved with tests for identifying array relationships and merging manual relationships, enhancing overall relationship management.

## 0.5.9

### Patch Changes

- This update introduces functionality in the FilterHandler to handle PostgreSQL array columns, allowing for the use of native array operators in filter conditions. It includes methods to check for array columns, retrieve their element types, and build array literals with proper type casting. Additionally, the buildFilterCondition method has been updated to return undefined for empty filters, improving error handling and flexibility in filter configurations.

## 0.5.8

### Patch Changes

- This update introduces functionality to the RelationshipDetector that automatically identifies array foreign key relationships in the schema. It enhances the detection process by adding detailed documentation and improving the methods for checking array columns and extracting foreign key information. This change streamlines the handling of relationships, ensuring better integration with various schema configurations.

## 0.5.7

### Patch Changes

- This update refines the relationship detection logic by merging auto-detected relationships with manually provided ones, ensuring that manual relationships take precedence. This change improves the handling of relationships in the schema, allowing for more flexible configuration while maintaining compatibility with array foreign key detection.

## 0.5.6

### Patch Changes

- This update fixes the relationship detection logic to always call detectFromSchema, allowing for array foreign key detection even when explicit relations are not provided. An empty object is passed for relations if none are specified, ensuring compatibility and improved functionality in schema handling.

## 0.5.5

### Patch Changes

- This update modifies the RelationshipDetector to resolve table references using schema keys instead of database table names. It introduces methods to handle schema key resolution and ensures that both forward and reverse relationships in the relationship graph utilize schema keys. This change enhances compatibility and maintains graceful degradation when schema keys are not found.

## 0.5.4

### Patch Changes

- Add support for array foreign key relationships: introduced detection and handling of array foreign key relationships in Drizzle adapters. It updates the relationship detector to identify array FKs, adds driver-specific join condition logic for PostgreSQL, MySQL, and SQLite, and extends the data transformer to process array relationships. Comprehensive tests and a test schema for array FKs are included to ensure correct behavior across supported databases.

## 0.5.3

### Patch Changes

- Adds compressed URL state sync for tables (filters, sorting, column visibility, and column order) and a new urlSync API in BetterTable for easy sharing and SSR-friendly URLs.
- Updated dependencies
  - @better-tables/core@0.5.3

## 0.5.2

### Patch Changes

- Fixes filter and table state sync by creating the table store synchronously, and prevents hydration warnings in the FilterBar. Enhance FilterHandler to support JSONB field extraction and improve security validations.
- Updated dependencies
  - @better-tables/core@0.5.2

## 0.5.1

### Patch Changes

- Fixed JSON accessor column resolution and extraction for MySQL, PostgreSQL, and SQLite. JSON fields can now be accessed using dot notation (e.g., `survey.title`) and are properly extracted at the SQL level and nested in the response data.
- Updated dependencies
  - @better-tables/core@0.5.1
