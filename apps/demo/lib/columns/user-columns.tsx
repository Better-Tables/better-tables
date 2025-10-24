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
      return <Badge className={colors[value as string] || ''}>{value as string}</Badge>;
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
      return (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {value as string}
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

  // Aggregate columns
  cb
    .number()
    .id('posts_count')
    .displayName('Posts')
    .accessor((user) => user.posts?.length || 0)
    .filterable(false)
    .sortable()
    .build(),

  cb
    .number()
    .id('total_views')
    .displayName('Total Views')
    .accessor((user) => user.posts?.reduce((sum, post) => sum + (post.views || 0), 0) || 0)
    .filterable()
    .sortable()
    .build(),

  cb
    .number()
    .id('total_likes')
    .displayName('Total Likes')
    .accessor((user) => user.posts?.reduce((sum, post) => sum + (post.likes || 0), 0) || 0)
    .filterable()
    .sortable()
    .build(),

  cb
    .number()
    .id('avg_views')
    .displayName('Avg Views')
    .accessor((user) => {
      const posts = user.posts || [];
      return posts.length > 0
        ? Math.round(posts.reduce((sum, post) => sum + (post.views || 0), 0) / posts.length)
        : 0;
    })
    .filterable()
    .sortable()
    .build(),

  cb
    .number()
    .id('comments_count')
    .displayName('Comments')
    .accessor((user) => user.comments?.length || 0)
    .filterable()
    .sortable()
    .build(),

  // Computed columns
  cb
    .number()
    .id('engagement_score')
    .displayName('Engagement Score')
    .accessor((user) => {
      const posts = user.posts || [];
      const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
      const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
      return totalViews + totalLikes * 10; // Likes worth 10x views
    })
    .filterable()
    .sortable()
    .build(),

  cb
    .boolean()
    .id('has_profile')
    .displayName('Has Profile')
    .accessor((user) => !!user.profile)
    .filterable()
    .build(),

  cb
    .boolean()
    .id('is_active')
    .displayName('Active User')
    .accessor((user) => {
      const posts = user.posts || [];
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentPosts = posts.filter((post) => {
        const postTime = post.createdAt instanceof Date ? post.createdAt.getTime() : post.createdAt;
        return postTime >= thirtyDaysAgo;
      });
      return recentPosts.length > 0;
    })
    .filterable()
    .build(),

  cb
    .boolean()
    .id('popular_author')
    .displayName('Popular Author')
    .accessor((user) => {
      const posts = user.posts || [];
      const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
      return totalViews >= 5000;
    })
    .filterable()
    .build(),
];

// Default visible columns for the demo
export const defaultVisibleColumns = [
  'name',
  'email',
  'age',
  'role',
  'status',
  'posts_count',
  'total_views',
  'engagement_score',
  'has_profile',
];
