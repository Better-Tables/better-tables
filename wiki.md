# Better Tables handbook (agent pointer)

Canonical product documentation lives on the marketing site under **`/docs`**
(source: `apps/marketing/content/docs/`).

For local preview: `cd apps/marketing && bun run dev` → http://localhost:3000/docs

## Heading map (site paths)

| Topic | Docs path |
|---|---|
| Architecture Overview | `/docs/architecture` |
| Column Definition (Builder API) | `/docs/columns` |
| Auto columns | `/docs/columns/auto-columns` |
| Advanced Filtering System | `/docs/filtering` |
| Sorting | `/docs/sorting` |
| Pagination | `/docs/pagination` |
| Inline editing | `/docs/inline-editing` |
| URL State Management | `/docs/url-state` |
| Next.js Integration | `/docs/nextjs` |
| Drizzle adapter | `/docs/adapters/drizzle` |
| HTTP adapter | `/docs/adapters/http` |
| UI & CLI | `/docs/ui-and-cli` |
| Migration (0.5 → 0.6) | `/docs/migration` + root `MIGRATION.md` |

AI indexes: `/llms.txt`, `/llms-full.txt`. Per-page Markdown: append `.mdx` to any docs URL.

Authoritative shipped examples: `apps/marketing/src/lib/demo/support/` and `/examples/*`.
