# @better-tables/site

Public marketing site for Better Tables, including a live interactive demo of the full table stack.

## Run locally

```bash
cd apps/marketing
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and scroll to **Try Better Tables Live**.

## Demo stack

- **Data**: in-memory SQLite seeded with 5,000 users via `drizzle-seed`
- **Adapter**: `@better-tables/adapters-drizzle`
- **Table**: `@better-tables/ui` with URL state sync

Key files:

| File | Purpose |
|------|---------|
| `src/lib/columns/user-columns.tsx` | Full column definitions |
| `src/lib/actions/user-actions.tsx` | Bulk row actions |
| `src/components/sections/users-table-client.tsx` | Client table wrapper |
| `src/components/sections/interactive-demo.tsx` | Server section on homepage |
| `src/app/api/users/route.ts` | Data API |

## Docs site

Documentation lives in [`apps/docs`](../docs) (`@better-tables/docs`).
