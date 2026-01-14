import { columns, createColumnBuilder } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
import type { UserWithRelations } from '../db/schema';

const cb = createColumnBuilder<UserWithRelations>();

export const userColumns = columns([
  // Direct user columns
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor((user) => user.name),

  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor((user) => user.email),

  cb
    .number()
    .id('age')
    .displayName('Age')
    .accessorWithDefault((user) => user.age, 0)
    .range(18, 100, { includeNull: true }),

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
    .cellRenderer(({ value }) => {
      const colors: Record<string, string> = {
        admin: 'bg-purple-100 text-purple-800',
        editor: 'bg-blue-100 text-blue-800',
        contributor: 'bg-green-100 text-green-800',
        viewer: 'bg-gray-100 text-gray-800',
      };
      return (
        <Badge className={colors[value as string] || ''} variant="outline">
          {value as string}
        </Badge>
      );
    }),

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
    .cellRenderer(({ value }) => {
      const colors: Record<string, string> = {
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-gray-100 text-gray-800',
        pending: 'bg-yellow-100 text-yellow-800',
        suspended: 'bg-red-100 text-red-800',
      };
      return (
        <Badge className={colors[value as string] || ''} variant="outline">
          {value as string}
        </Badge>
      );
    }),

  cb
    .date()
    .id('createdAt')
    .displayName('Joined')
    .accessor((user) => user.createdAt),

  // One-to-one relationship (profile)
  cb
    .text()
    .id('profile.bio')
    .displayName('Bio')
    .accessorWithDefault((user) => user.profile?.bio)
    .searchable({ includeNull: true })
    .truncate({ maxLength: 32, suffix: '...', showTooltip: true }),

  cb
    .text()
    .id('profile.website')
    .displayName('Website')
    .accessorWithDefault((user) => user.profile?.website)
    .cellRenderer(({ value }) => {
      if (!value) return <span className="text-muted-foreground">-</span>;

      // Validate URL to prevent XSS attacks
      const url = value as string;
      const isValidUrl = (url: string): boolean => {
        try {
          const parsedUrl = new URL(url);
          return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol);
        } catch {
          return false;
        }
      };

      if (!isValidUrl(url)) {
        return <span className="text-muted-foreground">{url}</span>;
      }

      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {url}
        </a>
      );
    }),

  cb
    .text()
    .id('profile.location')
    .displayName('Location')
    .accessorWithDefault((user) => user.profile?.location)
    .searchable({ includeNull: true }),

  cb
    .text()
    .id('profile.github')
    .displayName('GitHub')
    .accessorWithDefault((user) => user.profile?.github)
    .cellRenderer(({ value }) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <a
          href={`https://github.com/${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          @{value as string}
        </a>
      );
    }),

  // Note: Computed columns are not yet supported by the adapter
  // These would need to be implemented as virtual columns or handled differently
]);

// Default visible columns for the demo
export const defaultVisibleColumns = [
  'name',
  'email',
  'age',
  'role',
  'status',
  'createdAt',
  'profile.bio',
  'profile.website',
  'profile.location',
  'profile.github',
];
