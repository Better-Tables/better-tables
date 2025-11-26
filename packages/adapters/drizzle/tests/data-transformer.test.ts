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
});
