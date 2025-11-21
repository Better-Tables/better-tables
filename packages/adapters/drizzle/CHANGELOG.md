# @better-tables/adapters-drizzle

## 0.5.1

### Patch Changes

- Fixed JSON accessor column resolution and extraction for MySQL, PostgreSQL, and SQLite. JSON fields can now be accessed using dot notation (e.g., `survey.title`) and are properly extracted at the SQL level and nested in the response data.
- Updated dependencies
  - @better-tables/core@0.5.1
