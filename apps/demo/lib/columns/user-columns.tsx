import { createColumnBuilder } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
import type { UserWithRelations } from '../db/schema';

const cb = createColumnBuilder<UserWithRelations>();

export const userColumns = [
  // Direct user columns
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
    .nullableAccessor((user) => user.age, 0)
    .range(18, 100)
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
    })
    .build(),

  cb
    .date()
    .id('createdAt')
    .displayName('Joined')
    .accessor((user) => user.createdAt)
    .filterable(false) // Disable filtering - timestamp format needs custom handling
    .sortable()
    .build(),

  // One-to-one relationship (profile)
  cb
    .text()
    .id('profile.bio')
    .displayName('Bio')
    .nullableAccessor((user) => user.profile?.bio)
    .truncate({ maxLength: 32, suffix: '...', showTooltip: true })
    .filterable()
    .build(),

  cb
    .text()
    .id('profile.website')
    .displayName('Website')
    .nullableAccessor((user) => user.profile?.website)
    .filterable()
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
    })
    .build(),

  cb
    .text()
    .id('profile.location')
    .displayName('Location')
    .nullableAccessor((user) => user.profile?.location)
    .filterable()
    .build(),

  cb
    .text()
    .id('profile.github')
    .displayName('GitHub')
    .nullableAccessor((user) => user.profile?.github)
    .filterable()
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
    })
    .build(),

  // Note: Computed columns are not yet supported by the adapter
  // These would need to be implemented as virtual columns or handled differently
];

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
