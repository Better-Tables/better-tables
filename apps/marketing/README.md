# @better-tables/site

Public site for Better Tables — marketing, examples, and docs — including a live interactive demo of the full table stack.

## Run locally

```bash
cd apps/marketing
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and scroll to **Try Better Tables Live**.

### Optional Postgres (homepage users demo)

Copy a Neon (or any Postgres) connection string into `apps/marketing/.env`:

```bash
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
```

When `DATABASE_URL` is set, the homepage users table uses `@better-tables/adapters-drizzle` against that database (Drizzle schema in `src/lib/demo/users/postgres/`). Without it — or if the connection fails — the demo falls back to an in-memory SQLite seed (`src/lib/demo/users/sqlite/`).

Ticket examples under `/examples/*` always use the separate in-memory SQLite support dataset (`src/lib/demo/support/`).

## How the homepage demo works

```
URL searchParams
  → LiveDemo (RSC)
  → fetchUsers() → tables.fetchData(usersTable)   // Drizzle adapter, real SQL
  → <UsersTableClient data={…} /> + SQL readout

Bulk delete / suspend / reset → POST|PATCH|DELETE /api/users   // mutations only
Cell edits → saveUserCell server action → tables.cellEditAction(usersTable)
```

Reads never go through `/api/users`. That route is mutations-only.

## Demo stack

| Surface | Backend | Path |
|---------|---------|------|
| Homepage users (reads) | Postgres when `DATABASE_URL` set; else SQLite | `src/lib/demo/users/` |
| Homepage users (mutations) | same dialect | `src/app/api/users/route.ts` |
| `/examples/*` tickets | In-memory SQLite | `src/lib/demo/support/` |

Key files:

| File | Purpose |
|------|---------|
| `src/lib/demo/users/adapter.ts` | Dialect selector + `getTables()` |
| `src/lib/demo/users/columns.tsx` | `defineTable` column definitions |
| `src/lib/demo/users/fetch-users.ts` | RSC read path (`tables.fetchData`) |
| `src/lib/demo/users/postgres/schema.ts` | Neon-shaped Drizzle PG schema |
| `src/components/home/live-demo.tsx` | Server section on the homepage |
| `src/app/api/users/route.ts` | Bulk delete / suspend / SQLite reset |
