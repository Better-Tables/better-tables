---
"@better-tables/adapters-drizzle": minor
---

`drizzle-orm` and `better-sqlite3` moved out of `dependencies` and into
`peerDependencies` (kept in `devDependencies` for local development and
tests). This avoids bundling a second copy of `drizzle-orm` that can
type/instance-mismatch against the consumer's own copy, and stops forcing
every consumer — including Postgres/MySQL-only users — to compile the
`better-sqlite3` native addon. `better-sqlite3`, `mysql2`, and `postgres`
are now marked `optional` in `peerDependenciesMeta`: install only the
driver(s) you actually use. This is a dependency-resolution behavior change
for consumers — if you were relying on `drizzle-orm`/`better-sqlite3` being
transitively installed by this package, add them to your own
`dependencies` (`drizzle-orm` range `>=0.44.0 <0.46.0`).
