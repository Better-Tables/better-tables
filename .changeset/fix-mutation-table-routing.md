---
"@better-tables/adapters-drizzle": minor
---

`createRecord`, `updateRecord`, `deleteRecord`, `bulkUpdate`, and `bulkDelete` no longer silently target whichever table happens to be first in `Object.keys(schema)`. In a multi-table schema this previously meant deletes and updates by id could land on the wrong table — silent data corruption or data loss on the most dangerous code path.

**What breaks (migration-guide input):**

- If your schema has **more than one table**, mutation methods now throw a `SchemaError` ("Multiple tables in schema — set 'defaultMutationTable' in drizzleAdapter options to enable create/update/delete") until you configure which table mutations should target:

  ```typescript
  const adapter = drizzleAdapter(db, {
    options: { defaultMutationTable: 'users' },
  });
  ```

  or, using `DrizzleAdapterConfig` directly:

  ```typescript
  new DrizzleAdapter({
    db,
    schema: { users, profiles },
    driver: 'postgres',
    options: { defaultMutationTable: 'users' },
  });
  ```

  If `defaultMutationTable` names a table not present in the schema, the same `SchemaError` is thrown (listing the available tables) on the first mutation call.

- Schemas with **exactly one table** are unaffected — that table is used automatically, with no configuration required.

- `adapter.meta.features.create` / `.update` / `.delete` / `.bulkOperations` now reflect whether mutation routing is actually resolvable (single-table schema, or `defaultMutationTable` configured) instead of being hardcoded to `true`. UI layers that gate mutation actions on `adapter.meta.features` will correctly stop advertising them until `defaultMutationTable` is set.

No data-shape inference was added for routing — inferring the target table from the mutated data would just trade one silent-wrong-table failure mode for another. The fix is explicit configuration only.
