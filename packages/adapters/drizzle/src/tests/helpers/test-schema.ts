/**
 * Shared test schema definitions for Drizzle adapter tests
 */

import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Core test schema used across multiple test files
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  bio: text('bio'),
  avatar: text('avatar'),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
  published: integer('published', { mode: 'boolean' }).default(false),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey(),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
});

export const schema = { users, profiles, posts, comments };

/**
 * Drizzle relations definitions
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  posts: many(posts),
  comments: many(comments),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const relationsSchema = {
  users: usersRelations,
  profiles: profilesRelations,
  posts: postsRelations,
  comments: commentsRelations,
};

/**
 * TypeScript types derived from schema
 */
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;

export type UserWithRelations = User & {
  profile?: Profile | null;
  posts?: Post[];
  comments?: Comment[];
};
