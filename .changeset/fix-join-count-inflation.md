---
"@better-tables/adapters-drizzle": patch
---

Fixed inflated `total`/`totalPages`/`hasNext` on MySQL and SQLite when a query joins a one-to-many relationship (e.g. filtering or selecting `posts.title` on `users`). The count query previously counted raw joined rows instead of distinct primary keys, so pagination could report pages that don't exist. MySQL and SQLite now count distinct primary keys under joins, matching the existing PostgreSQL behavior.
