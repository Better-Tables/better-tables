# Better Tables Demo App

A comprehensive demonstration of Better Tables with Drizzle adapter, showcasing all features including advanced filtering, pagination, sorting, relationships, and CRUD operations.

## Features Demonstrated

### Column Types
- **Text columns**: name, email, bio, website, location, github
- **Number columns**: age, views, likes, posts count, engagement score
- **Date columns**: joined date with filtering
- **Boolean columns**: has_profile, is_active, popular_author
- **Option columns**: role, status with custom badges

### Relationships
- **One-to-one**: User → Profile
- **One-to-many**: User → Posts, User → Comments
- **Many-to-many**: Posts ↔ Categories
- **Cross-table filtering**: Filter by profile fields, post data
- **Aggregations**: Sum, count, average calculations

### Table Operations
- **Advanced filtering**: All column types with various operators
- **Multi-column sorting**: Sort by multiple columns
- **Pagination**: Configurable page sizes (10, 20, 50, 100)
- **Row selection**: Select individual or all rows
- **Bulk actions**: Export and delete selected rows

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+

### Installation

From the monorepo root:

```bash
# Install dependencies
pnpm install

# Navigate to demo app
cd apps/demo

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the demo.

### Build for Production

```bash
pnpm build
pnpm start
```

## Architecture

This demo uses **Next.js 15 App Router** with:
- **Server Components** for data fetching (uses Drizzle adapter directly)
- **Client Components** for interactivity (filters, sorting, pagination)
- **URL search params** for state management (shareable, bookmarkable links)
- **In-memory SQLite database** (created on first request, persisted for server lifetime)

### Schema

- **users**: 25 users with varied roles and statuses
- **profiles**: 12 profiles (not all users have profiles)
- **posts**: 25+ posts with views and likes
- **comments**: 30+ comments on posts
- **categories**: 8 categories (Technology, Design, Business, etc.)
- **post_categories**: Many-to-many relationships

## Project Structure

```
apps/demo/
├── app/
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main demo page (Server Component)
├── components/
│   └── users-table-client.tsx    # Client wrapper for interactivity
├── lib/
│   ├── columns/
│   │   └── user-columns.tsx      # Column definitions
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── seed.ts               # Seed data
│   │   └── index.ts              # Database initialization
│   └── adapter.ts                # Drizzle adapter configuration
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## Key Files

### Column Definitions (`lib/columns/user-columns.tsx`)

Showcases all column types and features:
- Direct columns from users table
- Relationship columns (profile.*)
- Aggregate columns (posts_count, total_views)
- Computed columns (engagement_score, is_active)
- Custom cell renderers with badges and links

### Main Page (`app/page.tsx`)

Server Component that:
- Fetches data using Drizzle adapter directly
- Parses URL search params for filters/sorting/pagination
- Renders stats cards and table
- No client-side state needed for data fetching

### Client Wrapper (`components/users-table-client.tsx`)

Client Component that:
- Handles filter/sort/pagination changes via URL updates
- Manages row selection state
- Provides interactive table controls
- Uses Next.js router for state management

## Customization

### Changing Page Size Options

Edit the `TablePagination` component or pass custom options.

### Adding More Columns

1. Add to `lib/columns/user-columns.tsx`
2. Include in `defaultVisibleColumns` array

### Modifying Seed Data

Edit `lib/db/seed.ts` to change or add sample data.

## Performance

The demo is optimized with:
- **Caching**: 5-minute TTL for repeated queries
- **Batching**: Efficient batch operations
- **Query optimization**: Limited joins and smart indexing
- **Performance tracking**: Execution time monitoring

## Technologies

- **Next.js 15**: React framework with App Router
- **React 19**: Latest React features
- **Better Tables**: Core table library
- **Drizzle ORM**: TypeScript ORM
- **SQLite**: In-memory database
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library

## Notes

- Data resets on server restart (in-memory database)
- No authentication or authorization implemented
- Bulk actions are demonstrations (no actual deletion)
- All data is randomly generated for demo purposes

## Learn More

- [Better Tables Documentation](../../docs/GETTING_STARTED.md)
- [Drizzle Adapter Guide](../../packages/adapters/drizzle/README.md)
- [Column Builders Guide](../../docs/core/COLUMN_BUILDERS_GUIDE.md)

## License

MIT

