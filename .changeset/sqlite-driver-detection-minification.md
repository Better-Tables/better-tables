---
"@better-tables/adapters-drizzle": patch
---

Fix SQLite driver auto-detection in minified/production builds. Detection now
identifies SQLite by its `run`/`all`/`get`/`values` method signature — property
names that survive minification and are shared by every SQLite driver
(better-sqlite3, bun:sqlite, libsql, D1, …) — instead of falling back to the
Drizzle class name, which bundlers mangle. This resolves `drizzleAdapter(db)`
throwing "Unable to detect database driver from Drizzle instance" for SQLite in a
built app (the old `'run' && 'exec'` check never matched, since the Drizzle `db`
has no `exec`). Passing `driver` explicitly remains supported.
