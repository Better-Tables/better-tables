// TODO: Now we are type safe this can be updated to use the types from the schema
// TODO: remove the any types

import { createColumnBuilder } from '@better-tables/core';
import Database from 'better-sqlite3';
import { relations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter } from '../src/drizzle-adapter';

// Schema definition
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  bio: text('bio'),
  avatar: text('avatar'),
  website: text('website'),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
  published: integer('published', { mode: 'boolean' }).default(false),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const comments = sqliteTable('comments', {
  id: integer('id').primaryKey(),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Relations
const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  posts: many(posts),
  comments: many(comments),
}));

const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
}));

const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

const schema = { users, profiles, posts, comments } as const;
const relationsSchema = {
  users: usersRelations,
  profiles: profilesRelations,
  posts: postsRelations,
  comments: commentsRelations,
} as const;

// Define proper types for the data
type User = typeof users.$inferSelect;
type Profile = typeof profiles.$inferSelect;
type Post = typeof posts.$inferSelect;
type Comment = typeof comments.$inferSelect;

type UserWithRelations = User & {
  profile?: Profile | null;
  posts?: Post[];
  comments?: Comment[];
};

// Create a typed column builder
const cb = createColumnBuilder<UserWithRelations>();

// Column definitions with dot notation
const columns = [
  // Direct user columns
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor((user) => user.name)
    .build(),
  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor((user) => user.email)
    .build(),
  cb
    .number()
    .id('age')
    .displayName('Age')
    .nullableAccessor((user) => user.age, 0)
    .build(),
  cb
    .date()
    .id('createdAt')
    .displayName('Joined')
    .accessor((user) => user.createdAt)
    .build(),

  // One-to-one relationship (profile)
  cb
    .text()
    .id('profile.bio')
    .displayName('Bio')
    .nullableAccessor((user) => user.profile?.bio)
    .build(),
  cb
    .text()
    .id('profile.avatar')
    .displayName('Avatar')
    .nullableAccessor((user) => user.profile?.avatar)
    .build(),
  cb
    .text()
    .id('profile.website')
    .displayName('Website')
    .nullableAccessor((user) => user.profile?.website)
    .build(),

  // One-to-many relationship (posts) - first post
  cb
    .text()
    .id('posts.title')
    .displayName('Latest Post')
    .nullableAccessor((user) => user.posts?.[0]?.title)
    .build(),
  cb
    .number()
    .id('posts.views')
    .displayName('Latest Post Views')
    .nullableAccessor((user) => user.posts?.[0]?.views, 0)
    .build(),

  // Aggregate columns
  cb
    .number()
    .id('posts_count')
    .displayName('Posts')
    .accessor((user) => user.posts?.length || 0)
    .build(),
  cb
    .number()
    .id('total_views')
    .displayName('Total Views')
    .accessor((user) => user.posts?.reduce((sum, post) => sum + (post.views || 0), 0) || 0)
    .build(),
  cb
    .number()
    .id('total_likes')
    .displayName('Total Likes')
    .accessor((user) => user.posts?.reduce((sum, post) => sum + (post.likes || 0), 0) || 0)
    .build(),
  cb
    .number()
    .id('avg_views')
    .displayName('Avg Views')
    .accessor((user) => {
      const posts = user.posts || [];
      return posts.length > 0
        ? posts.reduce((sum, post) => sum + (post.views || 0), 0) / posts.length
        : 0;
    })
    .build(),

  // Engagement score (custom calculation)
  cb
    .number()
    .id('engagement_score')
    .displayName('Engagement')
    .accessor((user) => {
      const posts = user.posts || [];
      const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
      const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
      return totalViews + totalLikes * 10; // Likes worth 10x views
    })
    .build(),

  // Status indicators
  cb
    .boolean()
    .id('has_profile')
    .displayName('Has Profile')
    .accessor((user) => !!user.profile)
    .build(),
  cb
    .boolean()
    .id('has_posts')
    .displayName('Has Posts')
    .accessor((user) => (user.posts?.length || 0) > 0)
    .build(),
  cb
    .boolean()
    .id('is_active')
    .displayName('Active User')
    .accessor((user) => {
      const posts = user.posts || [];
      const recentPosts = posts.filter((post) => {
        const daysSinceCreated = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreated <= 30;
      });
      return recentPosts.length > 0;
    })
    .build(),
];

// Example usage
async function setupDatabase(): Promise<any> {
  // Create in-memory SQLite database
  const sqlite = new Database(':memory:');
  const db: any = drizzle(sqlite);

  // Create tables
  await db.run(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    age INTEGER,
    created_at INTEGER NOT NULL
  )`);

  await db.run(sql`CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bio TEXT,
    avatar TEXT,
    website TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.run(sql`CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    published INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.run(sql`CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Insert sample data
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  await db.run(sql`INSERT INTO users (id, name, email, age, created_at) VALUES 
    (1, 'John Doe', 'john@example.com', 30, ${oneMonthAgo}),
    (2, 'Jane Smith', 'jane@example.com', 25, ${oneWeekAgo}),
    (3, 'Bob Johnson', 'bob@example.com', 35, ${now}),
    (4, 'Alice Brown', 'alice@example.com', 28, ${oneWeekAgo}),
    (5, 'Charlie Wilson', 'charlie@example.com', 42, ${oneMonthAgo})`);

  await db.run(sql`INSERT INTO profiles (id, user_id, bio, avatar, website) VALUES 
    (1, 1, 'Software developer passionate about React and TypeScript', 'avatar1.jpg', 'https://johndoe.dev'),
    (2, 2, 'UI/UX Designer creating beautiful user experiences', 'avatar2.jpg', 'https://janesmith.design'),
    (3, 3, 'Full-stack developer and tech blogger', 'avatar3.jpg', 'https://bobjohnson.tech'),
    (4, 4, 'Data scientist and machine learning enthusiast', 'avatar4.jpg', 'https://alicebrown.ai')`);

  await db.run(sql`INSERT INTO posts (id, user_id, title, content, published, views, likes, created_at) VALUES 
    (1, 1, 'Getting Started with React 19', 'React 19 introduces many exciting features...', 1, 1250, 45, ${oneWeekAgo}),
    (2, 1, 'TypeScript Best Practices', 'Here are some TypeScript patterns I use daily...', 1, 890, 32, ${now}),
    (3, 2, 'Design Systems in 2024', 'Building scalable design systems...', 1, 2100, 78, ${oneWeekAgo}),
    (4, 2, 'Color Theory for Developers', 'Understanding color in web design...', 0, 0, 0, ${now}),
    (5, 3, 'Building Full-Stack Apps', 'My approach to full-stack development...', 1, 1560, 56, ${oneWeekAgo}),
    (6, 3, 'Database Optimization Tips', 'How to optimize your database queries...', 1, 980, 23, ${now}),
    (7, 4, 'Machine Learning Basics', 'Introduction to ML concepts...', 1, 3200, 120, ${oneWeekAgo}),
    (8, 4, 'Data Visualization Techniques', 'Creating compelling data visualizations...', 1, 1450, 67, ${now})`);

  await db.run(sql`INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES 
    (1, 1, 2, 'Great article! Very helpful.', ${now}),
    (2, 1, 3, 'Thanks for sharing this.', ${now}),
    (3, 3, 1, 'Love the design system approach!', ${now}),
    (4, 5, 2, 'Excellent full-stack insights.', ${now}),
    (5, 7, 1, 'ML is fascinating!', ${now})`);

  return { db, sqlite };
}

// Create adapter
async function createAdapter() {
  const { db, sqlite } = await setupDatabase();

  const adapter = new DrizzleAdapter({
    db,
    schema,
    mainTable: 'users',
    driver: 'sqlite',
    autoDetectRelationships: true,
    options: {
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
      },
      optimization: {
        maxJoins: 5,
        enableBatching: true,
        batchSize: 1000,
      },
      logging: {
        enabled: true,
        level: 'info',
        logQueries: false,
      },
      performance: {
        trackTiming: true,
        maxQueryTime: 5000,
      },
    },
  });

  return { adapter, sqlite };
}

// Example queries
async function runExamples() {
  const { adapter, sqlite } = await createAdapter();
  const _basicResult = await adapter.fetchData({});
  const _paginatedResult = await adapter.fetchData({
    pagination: { page: 1, limit: 2 },
  });
  const _sortedResult = await adapter.fetchData({
    sorting: [{ columnId: 'age', direction: 'desc' }],
  });
  const _filteredResult = await adapter.fetchData({
    filters: [
      {
        columnId: 'has_profile',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
    ],
  });
  const _crossTableResult = await adapter.fetchData({
    filters: [
      {
        columnId: 'profile.bio',
        type: 'text',
        operator: 'contains',
        values: ['developer'],
      },
    ],
  });
  const _complexResult = await adapter.fetchData({
    filters: [
      {
        columnId: 'is_active',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
      {
        columnId: 'posts_count',
        type: 'number',
        operator: 'greaterThan',
        values: [1],
      },
    ],
    sorting: [{ columnId: 'engagement_score', direction: 'desc' }],
  });
  const _ageOptions = await adapter.getFilterOptions('age');
  const _facets = await adapter.getFacetedValues('posts_count');
  const [_minViews, _maxViews] = await adapter.getMinMaxValues('total_views');

  // Create
  const newUser = await adapter.createRecord({
    name: 'David Lee',
    email: 'david@example.com',
    age: 33,
    createdAt: new Date(),
  } as Partial<User>);

  // Update
  const _updatedUser = await adapter.updateRecord(newUser.id.toString(), {
    age: 34,
  } as Partial<User>);

  // Delete
  await adapter.deleteRecord(newUser.id.toString());
  const _exportResult = await adapter.exportData({
    format: 'json',
    columns: ['name', 'email', 'posts_count', 'total_views'],
  });
  const _perfResult = await adapter.fetchData({
    columns: ['name', 'profile.bio', 'posts.title', 'posts_count', 'total_views'],
    sorting: [{ columnId: 'total_views', direction: 'desc' }],
  });

  // Cleanup
  sqlite.close();
}

// Run examples
if (require.main === module) {
  runExamples().catch(console.error);
}

export { createAdapter, columns, schema, relationsSchema };
