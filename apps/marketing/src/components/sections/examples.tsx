import { codeToHtml } from 'shiki';
import { FeatureSelector } from '@/components/feature-selector';
import { Section } from '@/components/section';

interface FeatureOption {
  id: number;
  title: string;
  description: string;
  code: string;
}

const featureOptions: FeatureOption[] = [
  {
    id: 1,
    title: 'Basic Table Setup',
    description:
      'Automatic server-side filtering, sorting, and pagination. Zero query writing required.',
    code: `import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive';
}

const cb = createColumnBuilder<User>();

const columns = [
  cb.text().id('name').displayName('Name')
    .accessor(u => u.name).filterable().sortable().build(),
  cb.text().id('email').displayName('Email')
    .accessor(u => u.email).filterable().sortable().build(),
  cb.option().id('role').displayName('Role')
    .accessor(u => u.role)
    .options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
      { value: 'viewer', label: 'Viewer' },
    ]).filterable().build(),
];

function UserTable({ users }: { users: User[] }) {
  return (
    <BetterTable
      columns={columns}
      data={users}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: true,
      }}
    />
  );
}`,
  },
  {
    id: 2,
    title: 'Cross-Table Filtering',
    description: 'Automatic server-side filtering across relationships using the Drizzle adapter.',
    code: `import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

interface UserWithRelations {
  id: string;
  name: string;
  profile?: { location: string; website: string };
  posts?: Array<{ title: string; views: number }>;
}

const cb = createColumnBuilder<UserWithRelations>();

// Define columns that span multiple tables
const columns = [
  cb.text().id('name').accessor(u => u.name).build(),
  // Filter across relationships automatically!
  cb.text().id('profile.location')
    .accessor(u => u.profile?.location)
    .filterable().build(),
  cb.number().id('posts_count')
    .accessor(u => u.posts?.length || 0)
    .filterable().sortable().build(),
];

// User filters by "profile.location" - automatic JOIN generated
// User filters by "posts_count" - automatic COUNT and JOIN
// All handled by the adapter, zero query writing required

function UserTable() {
  const adapter = drizzleAdapter(db);
  
  return (
    <BetterTable 
      columns={columns} 
      adapter={adapter}
      features={{ filtering: true, sorting: true }}
    />
  );
}`,
  },
  {
    id: 3,
    title: 'Server-Side Rendering with Next.js',
    description:
      'Automatic server-side filtering with Next.js. URL state persistence for shareable views.',
    code: `// app/users/page.tsx (Server Component)
import { deserializeFiltersFromURL } from '@better-tables/core';
import { getAdapter } from '@/lib/adapter';
import { UsersTableClient } from './users-table-client';

export default async function UsersPage({ 
  searchParams 
}: { 
  searchParams: Promise<Record<string, string>> 
}) {
  const params = await searchParams;

  // Parse URL params for state
  const page = Number.parseInt(params.page || '1', 10);
  const limit = Number.parseInt(params.limit || '10', 10);
  const filters = params.filters 
    ? deserializeFiltersFromURL(params.filters) 
    : [];
  const sorting = params.sorting 
    ? deserializeSortingFromURL(params.sorting) 
    : [];

  // Fetch data using the adapter
  const adapter = await getAdapter();
  const result = await adapter.fetchData({
    pagination: { page, limit },
    filters,
    sorting,
  });

  return (
    <UsersTableClient
      data={result.data}
      totalCount={result.total}
      initialPagination={{ page, limit }}
      initialFilters={filters}
      initialSorting={sorting}
    />
  );
}`,
  },
  {
    id: 4,
    title: 'Advanced Features',
    description:
      'Virtual scrolling, custom rendering, and more. All with automatic server-side filtering.',
    code: `import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';
import { Badge } from '@/components/ui/badge';

const cb = createColumnBuilder<User>();

const columns = [
  cb.text().id('name').accessor(u => u.name).build(),
  
  // Custom cell rendering
  cb.option().id('role')
    .accessor(u => u.role)
    .cellRenderer(({ value }) => (
      <Badge variant={value === 'admin' ? 'default' : 'secondary'}>
        {value}
      </Badge>
    )).build(),
  
  // Virtual scrolling for large datasets
  cb.number().id('views')
    .accessor(u => u.views)
    .sortable().build(),
];

function AdvancedTable({ users }: { users: User[] }) {
  return (
    <BetterTable
      columns={columns}
      data={users}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: true,
        virtualization: true, // Handle millions of rows
      }}
      onRowSelect={(selectedIds) => {
        console.log('Selected:', selectedIds);
      }}
    />
  );
}`,
  },
  {
    id: 5,
    title: 'Bulk Actions',
    description: 'Type-safe action builder for bulk operations. Automatic server-side execution.',
    code: `import { createActionBuilder } from '@better-tables/core';
import { BetterTable } from '@better-tables/ui';
import { Trash2, Archive } from 'lucide-react';

interface User {
  id: string;
  name: string;
  status: 'active' | 'archived';
}

// Create delete action with confirmation
const deleteAction = createActionBuilder<User>()
  .id('delete')
  .label('Delete Selected')
  .icon(Trash2)
  .variant('destructive')
  .confirmationDialog({
    title: 'Delete Users',
    description: 'Are you sure? This cannot be undone.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  .handler(async (selectedIds) => {
    await fetch('/api/users', {
      method: 'DELETE',
      body: JSON.stringify({ ids: selectedIds }),
    });
  })
  .build();

// Create archive action with conditional visibility
const archiveAction = createActionBuilder<User>()
  .id('archive')
  .label('Archive')
  .icon(Archive)
  .isVisible((ids) => ids.length > 0)
  .isEnabled((ids, data) => 
    data?.every(u => u.status !== 'archived') ?? false
  )
  .handler(async (selectedIds) => {
    await fetch('/api/users', {
      method: 'PATCH',
      body: JSON.stringify({ ids: selectedIds, status: 'archived' }),
    });
  })
  .build();

function UserTable({ users }: { users: User[] }) {
  return (
    <BetterTable
      columns={columns}
      data={users}
      actions={[deleteAction, archiveAction]}
      features={{
        rowSelection: true,
        filtering: true,
        sorting: true,
      }}
    />
  );
}`,
  },
];

export async function Examples() {
  const features = await Promise.all(
    featureOptions.map(async (feature) => ({
      ...feature,
      code: await codeToHtml(feature.code, {
        lang: 'typescript',
        theme: 'github-dark',
      }),
    }))
  );

  return (
    <Section id="examples" title="See the Magic in Action">
      <div className="border-x border-t">
        <FeatureSelector features={features} />
      </div>
    </Section>
  );
}
