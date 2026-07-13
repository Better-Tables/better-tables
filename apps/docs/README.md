# @better-tables/docs

Fumadocs-powered documentation site for Better Tables.

## Run locally

```bash
cd apps/docs
bun run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Live demo

The interactive table demo lives on the marketing site (`apps/marketing`, `@better-tables/site`). Run `cd apps/marketing && bun run dev` and scroll to **Try Better Tables Live** on [http://localhost:3000](http://localhost:3000).

## Project layout

| Route | Description |
| ----- | ----------- |
| `app/(home)` | Landing page |
| `app/docs` | Documentation pages |
| `app/api/search/route.ts` | Doc search API |
| `content/docs/` | MDX documentation source |

## Learn more

- [Fumadocs](https://fumadocs.dev)
- [Next.js](https://nextjs.org/docs)
