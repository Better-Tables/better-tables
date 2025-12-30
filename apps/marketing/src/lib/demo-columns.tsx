import { createColumnBuilder } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
import type { UserWithRelations } from './db/schema';

type DemoUser = UserWithRelations;

const cb = createColumnBuilder<DemoUser>();

export const demoColumns = [
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor((user) => user.name)
    .filterable()
    .sortable()
    .build(),

  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor((user) => user.email)
    .filterable()
    .sortable()
    .build(),

  cb
    .number()
    .id('age')
    .displayName('Age')
    .accessorWithDefault((user) => user.age, 0)
    .range(18, 100, { includeNull: true })
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('role')
    .displayName('Role')
    .accessor((user) => user.role)
    .options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
      { value: 'contributor', label: 'Contributor' },
      { value: 'viewer', label: 'Viewer' },
    ])
    .filterable()
    .sortable()
    .cellRenderer(({ value }) => {
      const colors: Record<string, string> = {
        admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        contributor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      };
      return (
        <Badge className={colors[value as string] || ''} variant="outline">
          {value as string}
        </Badge>
      );
    })
    .build(),

  cb
    .option()
    .id('status')
    .displayName('Status')
    .accessor((user) => user.status)
    .options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
      { value: 'suspended', label: 'Suspended' },
    ])
    .filterable()
    .sortable()
    .cellRenderer(({ value }) => {
      const colors: Record<string, string> = {
        active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      };
      return (
        <Badge className={colors[value as string] || ''} variant="outline">
          {value as string}
        </Badge>
      );
    })
    .build(),

  cb
    .text()
    .id('profile.location')
    .displayName('Location')
    .accessor((user) => user.profile?.location ?? '')
    .filterable()
    .sortable()
    .build(),

  cb
    .number()
    .id('posts_count')
    .displayName('Posts')
    .accessor((user) => user.posts?.length || 0)
    .filterable()
    .sortable()
    .build(),

  cb
    .date()
    .id('createdAt')
    .displayName('Joined')
    .accessor((user) => user.createdAt)
    .filterable()
    .sortable()
    .build(),
];

export const defaultVisibleColumns = [
  'name',
  'email',
  'role',
  'status',
  'profile.location',
  'posts_count', // Computed from posts relationship (posts will be fetched automatically)
];

export type { DemoUser };
