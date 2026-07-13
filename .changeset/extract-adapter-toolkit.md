---
"@better-tables/adapters-toolkit": minor
"@better-tables/adapters-drizzle": minor
---

New package `@better-tables/adapters-toolkit`: the ORM-agnostic layer of the
Drizzle adapter, extracted so future adapters (e.g. Prisma) implement small
ports instead of rewriting shared logic. It contains relationship-path
aliasing (`generateAlias`/`generatePathAlias`/`generatePathKey`),
primary-table resolution (`PrimaryTableResolver`), flat-to-nested result
transformation (`DataTransformer`), primary-key introspection over a
`SchemaIntrospectionPort`, filter operator classification and dispatch
(`FilterRouter` + the `PredicateEmitter` interface adapters implement),
relative date-period math (`computeDatePeriodRange`), Levenshtein-based
suggestion distances, and safe SQL identifier escaping/quoting
(`escapeSqlIdentifier`, `quoteIdentifier`). The toolkit has zero `drizzle-orm`
imports.

`@better-tables/adapters-drizzle` is internally restructured on top of the
toolkit with no intended public API change: `FilterHandler` keeps its exact
constructor and method signatures as a composition of the toolkit's
`FilterRouter` with the new `DrizzlePredicateEmitter` (all Drizzle leaf SQL,
JSONB extraction, and PostgreSQL array handling); the triplicated per-dialect
query-builder and operations bodies are deduplicated into
`BaseQueryBuilder`/`ReturningOperations` template methods. One
defense-in-depth fix rides along (ADAPTER-04): SQL identifier quoting now
escapes and wraps in a single call parameterized by the dialect's quote
character, so MySQL identifiers are escaped with backticks instead of relying
on a caller-side pre-escape that always used double quotes. `DataTransformer`
(re-exported from the toolkit) now takes a third constructor argument — a
schema-introspection port — if you were instantiating it directly.
