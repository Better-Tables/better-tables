# @better-tables/adapters-drizzle

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
