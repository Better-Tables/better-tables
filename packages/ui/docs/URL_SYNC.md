# URL Synchronization

Better Tables provides framework-agnostic URL synchronization through a simple adapter interface. This allows you to sync table state (filters, pagination, sorting) with URL query parameters in any React framework.

## How It Works

The `useTableUrlSync` hook takes three parameters:

1. **tableId**: The unique identifier for your table
2. **config**: Which state to sync (`filters`, `pagination`, `sorting`)
3. **adapter**: Framework-specific URL adapter

The adapter handles reading from and writing to URL query parameters in a framework-appropriate way.

## Adapter Interface

```typescript
interface UrlSyncAdapter {
  getParam: (key: string) => string | null;
  setParams: (updates: Record<string, string | null>) => void;
}
```

## Framework Examples

### Next.js App Router

```typescript
// lib/nextjs-url-adapter.ts
import { useRouter, useSearchParams } from 'next/navigation';
import type { UrlSyncAdapter } from '@better-tables/ui';

export function useNextjsUrlAdapter(): UrlSyncAdapter {
  const router = useRouter();
  const searchParams = useSearchParams();

  return {
    getParam: (key: string) => searchParams.get(key),
    setParams: (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.push(`?${params.toString()}`, { scroll: false });
    },
  };
}
```

**Usage:**

```tsx
'use client';

import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

export function MyTable({ data }) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync('my-table', {
    filters: true,
    pagination: true,
    sorting: true
  }, urlAdapter);

  return (
    <BetterTable
      id="my-table"
      columns={columns}
      data={data}
      // No state props needed!
    />
  );
}
```

### React Router v6

```typescript
// lib/react-router-url-adapter.ts
import { useSearchParams } from 'react-router-dom';
import type { UrlSyncAdapter } from '@better-tables/ui';

export function useReactRouterAdapter(): UrlSyncAdapter {
  const [searchParams, setSearchParams] = useSearchParams();

  return {
    getParam: (key: string) => searchParams.get(key),
    setParams: (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      setSearchParams(params, { replace: true });
    },
  };
}
```

**Usage:**

```tsx
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useReactRouterAdapter } from '@/lib/react-router-url-adapter';

export function MyTable({ data }) {
  const urlAdapter = useReactRouterAdapter();

  useTableUrlSync('my-table', {
    filters: true,
    pagination: true,
    sorting: true
  }, urlAdapter);

  return <BetterTable id="my-table" columns={columns} data={data} />;
}
```

### Vanilla React (Browser History API)

Better Tables includes a built-in vanilla adapter:

```tsx
import { BetterTable, useTableUrlSync, createVanillaUrlAdapter } from '@better-tables/ui';
import { useMemo } from 'react';

export function MyTable({ data }) {
  const urlAdapter = useMemo(() => createVanillaUrlAdapter(), []);

  useTableUrlSync('my-table', {
    filters: true,
    pagination: true,
    sorting: true
  }, urlAdapter);

  return <BetterTable id="my-table" columns={columns} data={data} />;
}
```

### TanStack Router

```typescript
// lib/tanstack-router-url-adapter.ts
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { UrlSyncAdapter } from '@better-tables/ui';

export function useTanStackRouterAdapter(): UrlSyncAdapter {
  const navigate = useNavigate();
  const search = useSearch();

  return {
    getParam: (key: string) => {
      return search[key] || null;
    },
    setParams: (updates: Record<string, string | null>) => {
      const newSearch = { ...search };

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          delete newSearch[key];
        } else {
          newSearch[key] = value;
        }
      }

      navigate({
        search: newSearch,
        replace: true,
      });
    },
  };
}
```

### Remix

```typescript
// lib/remix-url-adapter.ts
import { useNavigate, useSearchParams } from '@remix-run/react';
import type { UrlSyncAdapter } from '@better-tables/ui';

export function useRemixUrlAdapter(): UrlSyncAdapter {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  return {
    getParam: (key: string) => searchParams.get(key),
    setParams: (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      navigate(`?${params.toString()}`, { replace: true });
    },
  };
}
```

## Configuration Options

You can selectively enable URL sync for specific features:

```tsx
// Only sync filters
useTableUrlSync('my-table', {
  filters: true,
  pagination: false,
  sorting: false
}, urlAdapter);

// Sync everything
useTableUrlSync('my-table', {
  filters: true,
  pagination: true,
  sorting: true
}, urlAdapter);
```

## URL Parameter Format

The hook uses the following query parameters:

- **filters**: JSON-encoded array of filter states
- **page**: Current page number
- **limit**: Items per page
- **sorting**: JSON-encoded array of sort states

Example URL:
```
/users?page=2&limit=20&filters=[{"columnId":"name","operator":"contains","values":["john"]}]&sorting=[{"columnId":"age","direction":"desc"}]
```

## Server-Side Rendering (SSR)

For SSR frameworks like Next.js, you can parse URL params on the server and pass them as initial state:

```tsx
// app/users/page.tsx (Next.js App Router)
export default async function UsersPage({ searchParams }) {
  const params = await searchParams;
  
  const page = Number.parseInt(params.page || '1');
  const limit = Number.parseInt(params.limit || '10');
  const filters = params.filters ? JSON.parse(params.filters) : [];
  const sorting = params.sorting ? JSON.parse(params.sorting) : [];

  // Fetch data with URL params
  const data = await fetchUsers({ page, limit, filters, sorting });

  return (
    <UsersTableClient
      data={data.items}
      totalCount={data.total}
      initialPagination={{ page, limit, totalPages: data.totalPages }}
      initialFilters={filters}
      initialSorting={sorting}
    />
  );
}
```

```tsx
// components/users-table-client.tsx
'use client';

import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

export function UsersTableClient({ data, totalCount, initialPagination, initialFilters, initialSorting }) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync('users-table', {
    filters: true,
    pagination: true,
    sorting: true
  }, urlAdapter);

  return (
    <BetterTable
      id="users-table"
      columns={columns}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialFilters={initialFilters}
      initialSorting={initialSorting}
    />
  );
}
```

## Without URL Sync

If you don't need URL synchronization, simply don't call `useTableUrlSync`:

```tsx
import { BetterTable } from '@better-tables/ui';

export function MyTable({ data }) {
  return (
    <BetterTable
      id="my-table"
      columns={columns}
      data={data}
      // State is managed internally but not synced to URL
    />
  );
}
```

## Advanced: Custom Serialization

If you need custom serialization (e.g., base64 encoding), implement it in your adapter:

```typescript
export function useCustomUrlAdapter(): UrlSyncAdapter {
  const router = useRouter();
  const searchParams = useSearchParams();

  return {
    getParam: (key: string) => {
      const value = searchParams.get(key);
      if (!value) return null;
      
      try {
        return atob(value); // Decode from base64
      } catch {
        return null;
      }
    },
    setParams: (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, btoa(value)); // Encode to base64
        }
      }

      router.push(`?${params.toString()}`, { scroll: false });
    },
  };
}
```

## Best Practices

1. **Memoize adapters**: Create adapters with `useMemo` or custom hooks to avoid recreating on every render
2. **Error handling**: Wrap JSON parsing in try-catch blocks
3. **Debouncing**: The table state updates are immediate; consider debouncing if you see performance issues
4. **Replace vs Push**: Use `replace: true` to avoid polluting browser history
5. **Scroll behavior**: Use `scroll: false` to prevent page jumping on state changes

