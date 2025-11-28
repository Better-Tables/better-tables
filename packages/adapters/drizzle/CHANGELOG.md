# @better-tables/adapters-drizzle

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
