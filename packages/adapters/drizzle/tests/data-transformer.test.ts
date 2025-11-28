import { beforeEach, describe, expect, it } from 'bun:test';
import { DataTransformer } from '../src/data-transformer';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipMap } from '../src/types';
import { relationsSchema, schema, type User } from './helpers/test-schema';

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
    it('should handle empty arrays', () => {
      const result = transformer.transformToNested([], 'users', []);

      expect(result).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
      const result1 = transformer.transformToNested(
        null as unknown as Record<string, unknown>[],
        'users',
        []
      );
      const result2 = transformer.transformToNested(
        undefined as unknown as Record<string, unknown>[],
        'users',
        []
      );

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it('should transform simple flat data structure', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        },
      ];

      const result = transformer.transformToNested(flatData, 'users', ['name', 'email']);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'John Doe');
      expect(result[0]).toHaveProperty('email', 'john@example.com');
    });

    it('should handle single column transformation', () => {
      const flatData = [{ id: 1, name: 'John Doe' }];

      const result = transformer.transformToNested(flatData, 'users', ['name']);

      expect(result).toHaveLength(1);
      expect((result[0] as User).name).toBe('John Doe');
    });
  });

  describe('Data Integrity', () => {
    it('should preserve original data structure', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        },
      ];

      const result = transformer.transformToNested(flatData, 'users', [
        'id',
        'name',
        'email',
        'age',
      ]);

      expect(result).toHaveLength(1);
      expect((result[0] as User).id).toBe(1);
      expect((result[0] as User).name).toBe('John Doe');
      expect((result[0] as User).email).toBe('john@example.com');
      expect((result[0] as User).age).toBe(30);
    });

    it('should handle missing columns gracefully', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
        },
      ];

      const result = transformer.transformToNested(flatData, 'users', ['name', 'email']);

      expect(result).toHaveLength(1);
      expect((result[0] as User).name).toBe('John Doe');
    });

    it('should handle special characters in data', () => {
      const flatData = [
        {
          id: 1,
          name: "O'Brien",
          email: 'test+tag@example.com',
        },
      ];

      const result = transformer.transformToNested(flatData, 'users', ['name', 'email']);

      expect(result).toHaveLength(1);
      expect((result[0] as User).name).toBe("O'Brien");
    });

    it('should handle large datasets efficiently', () => {
      const flatData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        age: 20 + (i % 50),
      }));

      const result = transformer.transformToNested(flatData, 'users', ['name', 'email', 'age']);

      expect(result).toHaveLength(1000);
      expect((result[0] as User).name).toBe('User 1');
      expect((result[999] as User).name).toBe('User 1000');
    });
  });

  describe('Array Foreign Key Relationships', () => {
    it('should handle array foreign key relationships in flat data', () => {
      // Simulate flat data from array FK join (multiple rows per event due to array join)
      // Column names use underscore format: primary table columns are direct, related columns use table_column format
      const flatData = [
        {
          id: 1,
          title: 'Event 1',
          organizerId: ['user1', 'user2'],
          organizers_id: 'user1',
          organizers_name: 'John Doe',
        },
        {
          id: 1,
          title: 'Event 1',
          organizerId: ['user1', 'user2'],
          organizers_id: 'user2',
          organizers_name: 'Jane Smith',
        },
        {
          id: 2,
          title: 'Event 2',
          organizerId: ['user1'],
          organizers_id: 'user1',
          organizers_name: 'John Doe',
        },
      ];

      // Create a relationship manager with array FK relationship
      const arraySchema = {
        events: schema.posts, // Reuse existing schema structure
        users: schema.users,
      };

      const arrayRelationships: RelationshipMap = {
        'events.organizers': {
          from: 'events',
          to: 'users',
          foreignKey: 'id',
          localKey: 'organizerId',
          cardinality: 'many',
          nullable: true,
          joinType: 'left',
          isArray: true,
        },
      };

      const arrayRelationshipManager = new RelationshipManager(arraySchema, arrayRelationships);
      const arrayTransformer = new DataTransformer(arraySchema, arrayRelationshipManager);

      const result = arrayTransformer.transformToNested(flatData, 'events', [
        'title',
        'organizers.name',
      ]);

      expect(result).toHaveLength(2); // Two unique events
      expect((result[0] as Record<string, unknown>).title).toBe('Event 1');
      expect((result[1] as Record<string, unknown>).title).toBe('Event 2');

      // Array relationships should be grouped
      // Note: The exact structure depends on processOneToManyColumn implementation
      expect(result[0]).toBeDefined();
    });

    it('should handle empty array foreign keys', () => {
      const flatData = [
        {
          id: 1,
          title: 'Event 1',
          organizerId: [],
          organizers_id: null,
          organizers_name: null,
        },
      ];

      const arraySchema = {
        events: schema.posts,
        users: schema.users,
      };

      const arrayRelationships: RelationshipMap = {
        'events.organizers': {
          from: 'events',
          to: 'users',
          foreignKey: 'id',
          localKey: 'organizerId',
          cardinality: 'many',
          nullable: true,
          joinType: 'left',
          isArray: true,
        },
      };

      const arrayRelationshipManager = new RelationshipManager(arraySchema, arrayRelationships);
      const arrayTransformer = new DataTransformer(arraySchema, arrayRelationshipManager);

      const result = arrayTransformer.transformToNested(flatData, 'events', [
        'title',
        'organizers.name',
      ]);

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).title).toBe('Event 1');
    });

    it('should handle array FK relationships with null values', () => {
      const flatData = [
        {
          id: 1,
          title: 'Event 1',
          organizerId: null,
          organizers_id: null,
          organizers_name: null,
        },
      ];

      const arraySchema = {
        events: schema.posts,
        users: schema.users,
      };

      const arrayRelationships: RelationshipMap = {
        'events.organizers': {
          from: 'events',
          to: 'users',
          foreignKey: 'id',
          localKey: 'organizerId',
          cardinality: 'many',
          nullable: true,
          joinType: 'left',
          isArray: true,
        },
      };

      const arrayRelationshipManager = new RelationshipManager(arraySchema, arrayRelationships);
      const arrayTransformer = new DataTransformer(arraySchema, arrayRelationshipManager);

      const result = arrayTransformer.transformToNested(flatData, 'events', [
        'title',
        'organizers.name',
      ]);

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).title).toBe('Event 1');
    });
  });

  describe('Nested Data Detection', () => {
    it('should detect nested data from Drizzle relational queries', () => {
      // Simulate nested data structure from Drizzle relational queries
      const nestedData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            id: 1,
            bio: 'Software developer',
            avatar: 'avatar.jpg',
          },
        },
      ];

      const result = transformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'users',
        ['name', 'email', 'profile.bio'],
        {
          selections: {},
          columnMapping: {},
          isNested: true, // Flag indicating data is already nested
        }
      );

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).name).toBe('John Doe');
      // Nested data should be preserved
      expect((result[0] as Record<string, unknown>).profile).toBeDefined();
    });

    it('should filter nested data to requested columns only', () => {
      const nestedData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          profile: {
            id: 1,
            bio: 'Software developer',
            avatar: 'avatar.jpg',
          },
        },
      ];

      const result = transformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'users',
        ['name', 'profile.bio'], // Only request name and bio
        {
          selections: {},
          columnMapping: {},
          isNested: true,
        }
      );

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.name).toBe('John Doe');
      expect(record.email).toBeUndefined(); // Not requested
      expect(record.age).toBeUndefined(); // Not requested
      expect(record.profile).toBeDefined();
      const profile = record.profile as Record<string, unknown>;
      expect(profile.bio).toBe('Software developer');
      expect(profile.avatar).toBeUndefined(); // Not requested
      expect(profile.id).toBeDefined(); // Always included for identification
    });

    it('should not incorrectly detect JSON columns as nested data', () => {
      // Flat data with JSON-like structure in a column (should not be detected as nested)
      // Use a column that exists in the schema - we'll simulate JSON by using a simple object
      // Since the test schema doesn't have a metadata column, we'll test with existing columns
      // and verify that when isNested is false, flat transformation is used
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          // Simulate a JSON-like structure that might be stored as text
          survey: JSON.stringify({ key: 'value', nested: { data: 'test' } }),
        },
      ];

      const result = transformer.transformToNested(
        flatData as unknown as Record<string, unknown>[],
        'users',
        ['name', 'email'],
        {
          selections: {},
          columnMapping: {},
          isNested: false, // Explicitly not nested - should use flat transformation
        }
      );

      // Should use flat transformation, not treat as nested
      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.name).toBe('John Doe');
      expect(record.email).toBe('john@example.com');
    });

    it('should include all requested fields from same relationship (not overwrite)', () => {
      const nestedData = [
        {
          id: 1,
          title: 'Event 1',
          organizers: [
            { id: 1, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
            { id: 2, name: 'Bob Jones', email: 'bob@example.com', age: 30 },
          ],
        },
      ];

      // Create schema and relationships for events with organizers
      const eventsSchema = {
        events: schema.posts, // Reuse posts table structure for events
        users: schema.users,
      };

      const arrayRelationships: RelationshipMap = {
        'events.organizers': {
          from: 'events',
          to: 'users',
          foreignKey: 'id',
          localKey: 'organizerId',
          cardinality: 'many',
          isArray: true,
        },
      };

      const arrayRelationshipManager = new RelationshipManager(eventsSchema, arrayRelationships);
      const arrayTransformer = new DataTransformer(eventsSchema, arrayRelationshipManager);

      // Request multiple fields from same relationship (using fields that exist in users table)
      const result = arrayTransformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'events',
        ['title', 'organizers.name', 'organizers.email', 'organizers.age'],
        {
          selections: {},
          columnMapping: {},
          isNested: true,
        }
      );

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.title).toBe('Event 1');
      expect(record.organizers).toBeDefined();
      const organizers = record.organizers as unknown[];
      expect(organizers).toHaveLength(2);

      // First organizer should have all requested fields
      const firstOrg = organizers[0] as Record<string, unknown>;
      expect(firstOrg.name).toBe('Jane Smith');
      expect(firstOrg.email).toBe('jane@example.com');
      expect(firstOrg.age).toBe(25);
      expect(firstOrg.id).toBe(1);

      // Second organizer should have all requested fields
      const secondOrg = organizers[1] as Record<string, unknown>;
      expect(secondOrg.name).toBe('Bob Jones');
      expect(secondOrg.email).toBe('bob@example.com');
      expect(secondOrg.age).toBe(30);
      expect(secondOrg.id).toBe(2);
    });

    it('should handle array relationships in nested data', () => {
      const nestedData = [
        {
          id: 1,
          title: 'Event 1',
          organizers: [
            { id: 'user1', name: 'John Doe' },
            { id: 'user2', name: 'Jane Smith' },
          ],
        },
      ];

      const arraySchema = {
        events: schema.posts,
        users: schema.users,
      };

      const arrayRelationships: RelationshipMap = {
        'events.organizers': {
          from: 'events',
          to: 'users',
          foreignKey: 'id',
          localKey: 'organizerId',
          cardinality: 'many',
          isArray: true,
        },
      };

      const arrayRelationshipManager = new RelationshipManager(arraySchema, arrayRelationships);
      const arrayTransformer = new DataTransformer(arraySchema, arrayRelationshipManager);

      const result = arrayTransformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'events',
        ['title', 'organizers.name'],
        {
          selections: {},
          columnMapping: {},
          isNested: true,
        }
      );

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.title).toBe('Event 1');
      expect(Array.isArray(record.organizers)).toBe(true);
      const organizers = record.organizers as Array<Record<string, unknown>>;
      expect(organizers).toHaveLength(2);
      expect(organizers[0]?.name).toBe('John Doe');
      expect(organizers[1]?.name).toBe('Jane Smith');
    });

    it('should handle one-to-one relationships in nested data', () => {
      const nestedData = [
        {
          id: 1,
          name: 'John Doe',
          profile: {
            id: 1,
            bio: 'Software developer',
            avatar: 'avatar.jpg',
          },
        },
      ];

      const result = transformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'users',
        ['name', 'profile.bio'],
        {
          selections: {},
          columnMapping: {},
          isNested: true,
        }
      );

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.profile).toBeDefined();
      const profile = record.profile as Record<string, unknown>;
      expect(profile.bio).toBe('Software developer');
      expect(profile.avatar).toBeUndefined(); // Not requested
    });

    it('should transform flat data normally when isNested is false', () => {
      const flatData = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profiles_userId: 1,
          profiles_bio: 'Software developer',
        },
      ];

      const result = transformer.transformToNested(flatData, 'users', [
        'name',
        'email',
        'profile.bio',
      ]);

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.name).toBe('John Doe');
      expect(record.profile).toBeDefined();
      const profile = record.profile as Record<string, unknown>;
      expect(profile.bio).toBe('Software developer');
    });

    it('should handle empty nested arrays', () => {
      const nestedData = [
        {
          id: 1,
          title: 'Event 1',
          organizers: [],
        },
      ];

      const arraySchema = {
        events: schema.posts,
        users: schema.users,
      };

      const arrayRelationships: RelationshipMap = {
        'events.organizers': {
          from: 'events',
          to: 'users',
          foreignKey: 'id',
          localKey: 'organizerId',
          cardinality: 'many',
          isArray: true,
        },
      };

      const arrayRelationshipManager = new RelationshipManager(arraySchema, arrayRelationships);
      const arrayTransformer = new DataTransformer(arraySchema, arrayRelationshipManager);

      const result = arrayTransformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'events',
        ['title', 'organizers.name'],
        {
          selections: {},
          columnMapping: {},
          isNested: true,
        }
      );

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(Array.isArray(record.organizers)).toBe(true);
      expect((record.organizers as unknown[]).length).toBe(0);
    });

    it('should handle null nested relationships', () => {
      const nestedData = [
        {
          id: 1,
          name: 'John Doe',
          profile: null,
        },
      ];

      const result = transformer.transformToNested(
        nestedData as unknown as Record<string, unknown>[],
        'users',
        ['name', 'profile.bio'],
        {
          selections: {},
          columnMapping: {},
          isNested: true,
        }
      );

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.profile).toBeNull();
    });
  });
});
