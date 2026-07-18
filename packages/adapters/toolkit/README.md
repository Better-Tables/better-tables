# @better-tables/adapters-toolkit

ORM-agnostic adapter machinery shared by Better Tables database adapters. This package is for **adapter authors**, not application developers wiring up a table UI.

## What it provides

| Export | Role |
|--------|------|
| `FilterRouter` | Routes UI filter state to adapter-specific predicate emitters by column type and operator |
| `PredicateEmitter` interface | Contract for translating `FilterState` into SQL/ORM predicates |
| `PrimaryTableResolver` | Resolves which schema table backs a column path (including joins) |
| `SchemaIntrospectionPort` | Reads primary keys and schema metadata without tying to a specific ORM |
| `DataTransformer` | Normalizes adapter fetch results (memoization, bounded LRU cache — see plan 040) |

Supporting utilities (`generateAlias`, `getPrimaryKeyMap`, SQL identifier quoting, etc.) live alongside these modules.

## Who imports it

- **Adapter authors** building a new `@better-tables/adapters-*` package
- **Not** typical app code — apps use `@better-tables/core` plus a concrete adapter (e.g. Drizzle)

## Reference consumer

The Drizzle adapter (`@better-tables/adapters-drizzle`) is the canonical reference implementation. Start there when extending or debugging toolkit behavior:

- [Drizzle adapter README](../drizzle/README.md)
- [Drizzle advanced usage](../drizzle/docs/ADVANCED_USAGE.md)

## Related packages

- [@better-tables/core](../../packages/core/README.md) — column builders, managers, adapter contract types
- [@better-tables/adapters-drizzle](../drizzle/README.md) — production Drizzle ORM adapter

## License

MIT — see [LICENSE](../../LICENSE).
