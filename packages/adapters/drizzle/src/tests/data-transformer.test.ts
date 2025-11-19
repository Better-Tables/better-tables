import { beforeEach, describe, expect, it } from 'bun:test';
import { DataTransformer } from '../data-transformer';
import { RelationshipDetector } from '../relationship-detector';
import { RelationshipManager } from '../relationship-manager';
import type { RelationshipMap } from '../types';
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
      const result1 = transformer.transformToNested(null as any, 'users', []);
      const result2 = transformer.transformToNested(undefined as any, 'users', []);

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
});
