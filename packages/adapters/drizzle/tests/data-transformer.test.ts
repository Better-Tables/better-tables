import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataTransformer } from '../src/data-transformer';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipMap } from '../src/types';

// Test schema
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  bio: text('bio'),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
});

const schema = { users, profiles, posts };

const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  posts: many(posts),
}));

const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));

const relationsSchema = {
  users: usersRelations,
  profiles: profilesRelations,
  posts: postsRelations,
};

// Define proper types for test data
type User = typeof users.$inferSelect;
type Profile = typeof profiles.$inferSelect;
type Post = typeof posts.$inferSelect;

type UserWithRelations = User & {
  profile?: Profile | null;
  posts?: Post[];
};

type UserWithComputed = UserWithRelations & {
  posts_count?: number;
  total_views?: number;
  avg_views?: number;
  min_views?: number;
  max_views?: number;
  full_name?: string;
  email_domain?: string;
  invalid_accessor?: string | null;
};

describe('DataTransformer', () => {
  let transformer: DataTransformer;
  let relationshipManager: RelationshipManager;
  let relationships: RelationshipMap;

  beforeEach(() => {
    const detector = new RelationshipDetector();
    relationships = detector.detectFromSchema(relationsSchema, schema);
    relationshipManager = new RelationshipManager(schema, relationships);
    transformer = new DataTransformer(schema, relationshipManager);
  });

  describe('Basic Transformation', () => {
    it('should transform flat data to nested structure', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profiles_id: 1,
          profiles_userId: 1,
          profiles_bio: 'Software developer',
          posts_id: 1,
          posts_userId: 1,
          posts_title: 'First Post',
        },
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profiles_id: 1,
          profiles_userId: 1,
          profiles_bio: 'Software developer',
          posts_id: 2,
          posts_userId: 1,
          posts_title: 'Second Post',
        },
      ];

      const nestedData = transformer.transformToNested(flatData, 'users', [
        'name',
        'profile.bio',
        'posts.title',
      ]);

      expect(nestedData).toHaveLength(1);
      expect(nestedData[0].name).toBe('John Doe');
      expect((nestedData[0] as UserWithRelations).profile).toBeDefined();
      expect((nestedData[0] as UserWithRelations).profile?.bio).toBe('Software developer');
      expect((nestedData[0] as UserWithRelations).posts).toBeDefined();
      expect(Array.isArray((nestedData[0] as UserWithRelations).posts)).toBe(true);
      expect((nestedData[0] as UserWithRelations).posts).toHaveLength(2);
    });

    it('should handle empty data', () => {
      const nestedData = transformer.transformToNested([], 'users');
      expect(nestedData).toHaveLength(0);
    });

    it('should handle data without relationships', () => {
      const flatData = [{ id: 1, name: 'John Doe', email: 'john@example.com' }];

      const nestedData = transformer.transformToNested(flatData, 'users', ['name', 'email']);

      expect(nestedData).toHaveLength(1);
      expect(nestedData[0].name).toBe('John Doe');
      expect(nestedData[0].email).toBe('john@example.com');
    });
  });

  describe('One-to-One Relationships', () => {
    it('should handle one-to-one relationships', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profiles_id: 1,
          profiles_userId: 1,
          profiles_bio: 'Software developer',
        },
      ];

      const nestedData = transformer.transformToNested(flatData, 'users', ['name', 'profile.bio']);

      expect((nestedData[0] as UserWithRelations).profile).toBeDefined();
      expect((nestedData[0] as UserWithRelations).profile?.bio).toBe('Software developer');
      expect((nestedData[0] as UserWithRelations).profile?.id).toBe(1);
    });

    it('should handle null one-to-one relationships', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profiles_id: null,
          profiles_userId: null,
          profiles_bio: null,
        },
      ];

      const nestedData = transformer.transformToNested(flatData, 'users', ['name', 'profile.bio']);

      expect(nestedData[0].profile).toBeNull();
    });
  });

  describe('One-to-Many Relationships', () => {
    it('should handle one-to-many relationships', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts_id: 1,
          posts_userId: 1,
          posts_title: 'First Post',
        },
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts_id: 2,
          posts_userId: 1,
          posts_title: 'Second Post',
        },
      ];

      const nestedData = transformer.transformToNested(flatData, 'users', ['name', 'posts.title']);

      expect((nestedData[0] as UserWithRelations).posts).toBeDefined();
      expect(Array.isArray((nestedData[0] as UserWithRelations).posts)).toBe(true);
      expect((nestedData[0] as UserWithRelations).posts).toHaveLength(2);
      expect((nestedData[0] as UserWithRelations).posts?.[0]?.title).toBe('First Post');
      expect((nestedData[0] as UserWithRelations).posts?.[1]?.title).toBe('Second Post');
    });

    it('should handle empty one-to-many relationships', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts_id: null,
          posts_userId: null,
          posts_title: null,
        },
      ];

      const nestedData = transformer.transformToNested(flatData, 'users', ['name', 'posts.title']);

      expect(nestedData[0].posts).toBeDefined();
      expect(Array.isArray(nestedData[0].posts)).toBe(true);
      expect(nestedData[0].posts).toHaveLength(0);
    });
  });

  describe('Aggregate Handling', () => {
    it('should handle count aggregates', () => {
      const data = [
        {
          id: 1,
          name: 'John Doe',
          posts: [
            { id: 1, title: 'First Post' },
            { id: 2, title: 'Second Post' },
          ],
        },
      ];

      const aggregateColumns = [
        {
          columnId: 'posts_count',
          function: 'count' as const,
          field: 'id',
          relationshipPath: [
            {
              from: 'users',
              to: 'posts',
              foreignKey: 'userId',
              localKey: 'id',
              cardinality: 'many' as const,
            },
          ],
        },
      ];

      const result = transformer.handleOneToManyAggregates(data, aggregateColumns);

      expect((result[0] as UserWithComputed).posts_count).toBe(2);
    });

    it('should handle sum aggregates', () => {
      const data = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts: [
            { id: 1, views: 100 },
            { id: 2, views: 200 },
          ],
        },
      ];

      const aggregateColumns = [
        {
          columnId: 'total_views',
          function: 'sum' as const,
          field: 'views',
          relationshipPath: [
            {
              from: 'users',
              to: 'posts',
              foreignKey: 'userId',
              localKey: 'id',
              cardinality: 'many' as const,
            },
          ],
        },
      ];

      const result = transformer.handleOneToManyAggregates(data, aggregateColumns);

      expect((result[0] as unknown as UserWithComputed).total_views).toBe(300);
    });

    it('should handle average aggregates', () => {
      const data = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts: [
            { id: 1, views: 100 },
            { id: 2, views: 200 },
          ],
        },
      ];

      const aggregateColumns = [
        {
          columnId: 'avg_views',
          function: 'avg' as const,
          field: 'views',
          relationshipPath: [
            {
              from: 'users',
              to: 'posts',
              foreignKey: 'userId',
              localKey: 'id',
              cardinality: 'many' as const,
            },
          ],
        },
      ];

      const result = transformer.handleOneToManyAggregates(data, aggregateColumns);

      expect((result[0] as unknown as UserWithComputed).avg_views).toBe(150);
    });

    it('should handle min/max aggregates', () => {
      const data = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts: [
            { id: 1, views: 100 },
            { id: 2, views: 200 },
            { id: 3, views: 50 },
          ],
        },
      ];

      const aggregateColumns = [
        {
          columnId: 'min_views',
          function: 'min' as const,
          field: 'views',
          relationshipPath: [
            {
              from: 'users',
              to: 'posts',
              foreignKey: 'userId',
              localKey: 'id',
              cardinality: 'many' as const,
            },
          ],
        },
        {
          columnId: 'max_views',
          function: 'max' as const,
          field: 'views',
          relationshipPath: [
            {
              from: 'users',
              to: 'posts',
              foreignKey: 'userId',
              localKey: 'id',
              cardinality: 'many' as const,
            },
          ],
        },
      ];

      const result = transformer.handleOneToManyAggregates(data, aggregateColumns);

      expect((result[0] as unknown as UserWithComputed).min_views).toBe(50);
      expect((result[0] as unknown as UserWithComputed).max_views).toBe(200);
    });
  });

  describe('Accessor Application', () => {
    it('should apply column accessors', () => {
      const data = [{ id: 1, name: 'John Doe', email: 'john@example.com' }];

      const accessors = new Map([
        ['full_name', (record: User) => record.name.toUpperCase()],
        ['email_domain', (record: User) => record.email.split('@')[1]],
      ]);

      const result = transformer.applyAccessors(data, accessors);

      expect((result[0] as UserWithComputed).full_name).toBe('JOHN DOE');
      expect((result[0] as UserWithComputed).email_domain).toBe('example.com');
    });

    it('should handle accessor errors gracefully', () => {
      const data = [{ id: 1, name: 'John Doe', email: 'john@example.com' }];

      const accessors = new Map([
        [
          'invalid_accessor',
          (record: User) =>
            (record as unknown as { nonExistentField: string }).nonExistentField?.toUpperCase() ||
            null,
        ],
      ]);

      const result = transformer.applyAccessors(data, accessors);

      expect((result[0] as UserWithComputed).invalid_accessor).toBeNull();
    });
  });

  describe('Null Value Handling', () => {
    it('should handle null values in related records', () => {
      const data = [
        {
          id: 1,
          name: 'John Doe',
          profile: null,
          posts: null,
        },
      ];

      const result = transformer.handleNullValues(data, 'users');

      expect(result[0].profile).toBeNull();
      expect(result[0].posts).toEqual([]);
    });
  });

  describe('Data Validation', () => {
    it('should validate transformed data structure', () => {
      const validData = [{ id: 1, name: 'John Doe', email: 'john@example.com' }];

      expect(transformer.validateTransformedData(validData, 'users')).toBe(true);
    });

    it('should reject invalid data structure', () => {
      const invalidData: unknown[] = [null, undefined, 'not an object'];

      expect(
        transformer.validateTransformedData(invalidData as Record<string, unknown>[], 'users')
      ).toBe(false);
    });
  });

  describe('Transformation Statistics', () => {
    it('should provide transformation statistics', () => {
      const data = [
        {
          id: 1,
          name: 'John Doe',
          profile: { bio: 'Developer' },
          posts: [{ title: 'Post 1' }, { title: 'Post 2' }],
        },
      ];

      const stats = transformer.getTransformationStats(data);

      expect(stats.totalRecords).toBe(1);
      expect(stats.nestedRelationships).toBe(1); // profile
      expect(stats.arrayFields).toBe(1); // posts
    });
  });

  describe('Flattening (Debug)', () => {
    it('should flatten nested data back to flat structure', () => {
      const nestedData = [
        {
          id: 1,
          name: 'John Doe',
          profile: {
            bio: 'Developer',
            avatar: 'avatar.jpg',
          },
          posts: [{ title: 'Post 1' }, { title: 'Post 2' }],
        },
      ];

      const flattened = transformer.flattenNestedData(nestedData);

      expect(flattened).toHaveLength(1);
      expect(flattened[0]).toHaveProperty('profile_bio');
      expect(flattened[0]).toHaveProperty('profile_avatar');
      expect(flattened[0]).toHaveProperty('posts');
    });
  });
});
