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
    code: `import { betterTables } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { BetterTable } from '@better-tables/ui';
import { db } from '@/lib/db';

// One instance for the whole app. The adapter reads your Drizzle
// schema, so every column path below is checked against it — and
// the row type is derived from it. No interface to hand-maintain.
export const tables = betterTables({ database: drizzleAdapter(db) });

export const usersTable = tables.define('users', (t) => ({
  columns: [
    t.text('name').filterable().sortable(),
    t.text('email').filterable().sortable(),
    t.option('role').options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
      { value: 'viewer', label: 'Viewer' },
    ]).filterable(),
  ],
}));

function UserTable({ users }: { users: typeof usersTable.$infer.Row[] }) {
  return (
    <BetterTable
      table={usersTable}
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
    code: `import { betterTables } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { BetterTable } from '@better-tables/ui';
import { db } from '@/lib/db';

const tables = betterTables({ database: drizzleAdapter(db) });

// Dot-paths reach straight across your relations. They're typed
// against the real schema, so 'profile.locaton' is a compile error
// — not a silent empty column.
export const usersTable = tables.define('users', (t) => ({
  columns: [
    t.text('name').sortable(),
    t.text('profile.location').filterable().sortable(),
    t.text('profile.website').filterable(),
  ],
}));

// Filtering or sorting by "profile.location" generates the JOIN for
// you, and the joined row is embedded in the result — typed, with
// zero query writing.
function UserTable({ users }: { users: typeof usersTable.$infer.Row[] }) {
  return (
    <BetterTable
      table={usersTable}
      data={users}
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
import { parseTableSearchParams } from '@better-tables/core';
import { tables, usersTable } from '@/lib/tables';
import { UsersTableClient } from './users-table-client';

export default async function UsersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string>>
}) {
  // One call parses page, limit, filters and sorting out of the URL
  const { page, limit, filters, sorting } = parseTableSearchParams(
    await searchParams,
    { page: 1, limit: 10 }
  );

  // Table-scoped read: the primary table comes from usersTable, and
  // rows come back typed as its own row — no cast.
  const result = await tables.fetchData(usersTable, {
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
import { Badge } from '@/components/ui/badge';
import { tables } from '@/lib/tables';

export const usersTable = tables.define('users', (t) => ({
  columns: [
    t.text('name'),

    // Custom cell rendering — \`value\` is typed from the schema
    t.option('role').cellRenderer(({ value }) => (
      <Badge variant={value === 'admin' ? 'default' : 'secondary'}>
        {value}
      </Badge>
    )),

    t.number('views').sortable(),
  ],
}));

function AdvancedTable({ users }: { users: typeof usersTable.$infer.Row[] }) {
  return (
    <BetterTable
      table={usersTable}
      data={users}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: true,
      }}
      onRowSelect={(selectedIds) => {
        console.log('Selected:', selectedIds);
      }}
    />
  );
}

// For 10k+ rows, drop pagination and add \`virtualized\` — the same
// table renders only the rows in view, and filtering/sorting are
// untouched:
//
//   <BetterTable table={usersTable} data={allUsers} virtualized
//     features={{ filtering: true, sorting: true, pagination: false }} />`,
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
