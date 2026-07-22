import { defineTable } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
// Type-only import: `UsersTables` carries the Postgres Drizzle schema types
// (flagship path). SQLite fallback mirrors the same column/relation names.
import type { UsersTables } from './adapter';

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  editor: 'bg-blue-100 text-blue-800',
  contributor: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-red-100 text-red-800',
};

// Validate URL to prevent XSS attacks
const isValidUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

/**
 * The homepage demo's table definition — the flagship path-builder form.
 * Own-table paths (`name`, `age`) and relation paths (`profile.bio`) derive
 * accessors and JOINs from the schema; `.editable()` on a relation path
 * routes cell saves to the RELATED profiles row via
 * `resolveCellWriteTarget` (see `saveUserCell`).
 */
export const usersTable = defineTable<UsersTables>()('users', (t) => ({
  columns: [
    t.text('name').filterable().sortable().editable(),

    t.text('email').filterable().sortable().editable(),

    t.number('age').range(18, 100, { includeNull: true }).filterable().sortable().editable(),

    t
      .option('role')
      .options([
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
        { value: 'contributor', label: 'Contributor' },
        { value: 'viewer', label: 'Viewer' },
      ])
      .filterable()
      .sortable()
      .editable()
      .cellRenderer(({ value }) => (
        <Badge className={roleColors[value] || ''} variant="outline">
          {value}
        </Badge>
      )),

    t
      .option('status')
      .options([
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'pending', label: 'Pending' },
        { value: 'suspended', label: 'Suspended' },
      ])
      .filterable()
      .sortable()
      .editable()
      .cellRenderer(({ value }) => (
        <Badge className={statusColors[value] || ''} variant="outline">
          {value}
        </Badge>
      )),

    // Client-only display values (`type: 'custom'`). Honest defaults are
    // filterable/sortable false (plan 060); explicit flags kept for clarity.
    t
      .computed('hasBio', (row) => Boolean(row.profile?.bio))
      .displayName('Has Bio')
      .filterable(false)
      .sortable(false)
      .cellRenderer(({ value }) => (
        <Badge variant={value ? 'secondary' : 'outline'} className="text-xs">
          {value ? 'Yes' : 'No'}
        </Badge>
      )),

    t
      .computed('roleTags', (row) => [row.role])
      .displayName('Role Tags')
      .filterable(false)
      .sortable(false)
      .cellRenderer(({ value }) => (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )),

    // Server-derived relation count (plan 060) — filterable/sortable via SQL.
    t
      .count('posts')
      .displayName('Posts'),

    t.date('createdAt').displayName('Joined').filterable().sortable().editable(),

    // One-to-one relation paths: the adapter JOINs profiles automatically.
    t
      .text('profile.bio')
      .displayName('Bio')
      .searchable({ includeNull: true })
      .truncate({ maxLength: 32, suffix: '...', showTooltip: true })
      .filterable()
      // `profiles.bio` is a nullable column; without this the edit pipeline
      // rejects clearing the cell with "This field is required."
      .nullable()
      .editable(),

    t
      .text('profile.website')
      .displayName('Website')
      .filterable()
      .cellRenderer(({ value }) => {
        if (!value) return <span className="text-muted-foreground">-</span>;
        if (!isValidUrl(value)) {
          return <span className="text-muted-foreground">{value}</span>;
        }
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {value}
          </a>
        );
      }),

    t
      .text('profile.location')
      .displayName('Location')
      .searchable({ includeNull: true })
      .filterable()
      // Nullable column — see `profile.bio` above.
      .nullable()
      .editable(),

    t
      .text('profile.github')
      .displayName('GitHub')
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
            @{value}
          </a>
        );
      }),
  ],
}));

/** Row type inferred from the table definition — includes the joined `profile`. */
export type UserRow = typeof usersTable.$infer.Row;

/** Explicit column list for `<BetterTable columns={…}>` (no adapter on the client). */
export const userColumns = usersTable.columns;

/**
 * Every DB-backed field the homepage fetch / HTTP adapter allowlist covers.
 * Includes `id` / `profile.id` so cell edits can address rows (and related
 * profiles). Computed columns are client-only and omitted here.
 */
export const allUserColumnIds = [
  'id',
  'name',
  'email',
  'age',
  'role',
  'status',
  'postsCount',
  'createdAt',
  'profile.id',
  'profile.bio',
  'profile.website',
  'profile.location',
  'profile.github',
] as const;

// Default visible columns for the demo
export const defaultVisibleColumns = [
  'name',
  'email',
  'age',
  'role',
  'status',
  'postsCount',
  'hasBio',
  'roleTags',
  'createdAt',
  'profile.bio',
  'profile.website',
  'profile.location',
  'profile.github',
];
