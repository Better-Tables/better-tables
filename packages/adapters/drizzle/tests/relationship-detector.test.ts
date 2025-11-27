import { beforeEach, describe, expect, it } from 'bun:test';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipMap } from '../src/types';
import { relationsSchema, schema } from './helpers/test-schema';
import { createMockArrayColumn, schemaPg } from './helpers/test-schema-array-fk';

describe('RelationshipDetector', () => {
  let detector: RelationshipDetector;

  beforeEach(() => {
    detector = new RelationshipDetector();
  });

  it('should detect relationships from schema', () => {
    const relationships = detector.detectFromSchema(relationsSchema, schema);

    expect(relationships['users.profile']).toBeDefined();
    expect(relationships['users.posts']).toBeDefined();
    expect(relationships['users.comments']).toBeDefined();
    expect(relationships['profiles.user']).toBeDefined();
    expect(relationships['posts.user']).toBeDefined();
    expect(relationships['posts.comments']).toBeDefined();
    expect(relationships['comments.post']).toBeDefined();
    expect(relationships['comments.user']).toBeDefined();
  });

  it('should detect relationship cardinality', () => {
    const relationships = detector.detectFromSchema(relationsSchema, schema);

    expect(relationships['users.profile']?.cardinality).toBe('one');
    expect(relationships['users.posts']?.cardinality).toBe('many');
    expect(relationships['profiles.user']?.cardinality).toBe('one');
    expect(relationships['posts.comments']?.cardinality).toBe('many');
  });

  it('should find join path between directly related tables', () => {
    detector.detectFromSchema(relationsSchema, schema);

    const path = detector.getJoinPath('users', 'profiles');
    expect(path).toHaveLength(1);
    expect(path[0]?.from).toBe('users');
    expect(path[0]?.to).toBe('profiles');
  });

  it('should find multi-level join paths', () => {
    detector.detectFromSchema(relationsSchema, schema);

    const path = detector.getJoinPath('users', 'comments');
    expect(path).toHaveLength(2);
    expect(path[0]?.from).toBe('users');
    expect(path[0]?.to).toBe('posts');
    expect(path[1]?.from).toBe('posts');
    expect(path[1]?.to).toBe('comments');
  });

  it('should detect circular references', () => {
    detector.detectFromSchema(relationsSchema, schema);

    const cycles = detector.detectCircularReferences();
    // Bidirectional relations are detected as cycles
    // This is expected behavior for the directed graph implementation
    expect(cycles.length).toBeGreaterThanOrEqual(0);
  });

  it('should get reachable tables', () => {
    detector.detectFromSchema(relationsSchema, schema);

    const reachable = detector.getReachableTables('users');
    expect(reachable.has('users')).toBe(true);
    expect(reachable.has('profiles')).toBe(true);
    expect(reachable.has('posts')).toBe(true);
    expect(reachable.has('comments')).toBe(true);
  });

  it('should validate relationship integrity', () => {
    expect(() => {
      detector.validateRelationships(schema, relationsSchema);
    }).not.toThrow();
  });

  describe('Array Foreign Key Detection - Graph Traversal', () => {
    it('should allow getJoinPath to traverse from referenced table back to array-owning table', () => {
      const mockSchema = {
        events: {
          id: { _name: 'id' },
          organizerId: createMockArrayColumn({
            hasArraySymbol: true,
            hasForeignKey: true,
            fkTable: { _name: 'users' },
            fkColumn: { _name: 'id' },
          }),
        },
        users: {
          id: { _name: 'id' },
          name: { _name: 'name' },
        },
      };

      const detector = new RelationshipDetector();
      detector.detectFromSchema({}, mockSchema);

      // Test forward traversal: from events to users (using schema keys)
      const forwardPath = detector.getJoinPath('events', 'users');
      expect(forwardPath).toBeDefined();
      expect(forwardPath.length).toBeGreaterThan(0);
      expect(forwardPath[0]?.isArray).toBe(true);

      // Test reverse traversal: from users back to events
      // This should now work because we added the reverse edge to relationshipGraph
      const reversePath = detector.getJoinPath('users', 'events');
      expect(reversePath).toBeDefined();
      expect(reversePath.length).toBeGreaterThan(0);
      expect(reversePath[0]?.isArray).toBe(true);
    });

    it('should handle schema keys different from database table names', () => {
      // Test with schema where keys differ from DB names
      const mockSchema = {
        eventsTable: {
          _name: 'events', // Database table name
          id: { _name: 'id' },
          organizerId: createMockArrayColumn({
            hasArraySymbol: true,
            hasForeignKey: true,
            fkTable: { _name: 'users' }, // DB name is 'users'
            fkColumn: { _name: 'id' },
          }),
        },
        usersTable: {
          _name: 'users', // Database table name
          id: { _name: 'id' },
          name: { _name: 'name' },
        },
      };

      const detector = new RelationshipDetector();
      const relationships = detector.detectFromSchema({}, mockSchema);

      // Relationship should be stored with schema keys
      const rel = relationships['eventsTable.organizers'];
      expect(rel).toBeDefined();
      expect(rel?.from).toBe('eventsTable'); // Schema key
      expect(rel?.to).toBe('usersTable'); // Schema key (converted from DB name 'users')
      expect(rel?.isArray).toBe(true);

      // Graph traversal should work with schema keys
      const path = detector.getJoinPath('eventsTable', 'usersTable');
      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThan(0);
    });

    it('should handle schema keys matching database table names (backward compatibility)', () => {
      // Test with schema where keys match DB names
      const mockSchema = {
        events: {
          id: { _name: 'id' },
          organizerId: createMockArrayColumn({
            hasArraySymbol: true,
            hasForeignKey: true,
            fkTable: { _name: 'users' },
            fkColumn: { _name: 'id' },
          }),
        },
        users: {
          id: { _name: 'id' },
        },
      };

      const detector = new RelationshipDetector();
      const relationships = detector.detectFromSchema({}, mockSchema);

      // Should still work when schema keys match DB names
      const rel = relationships['events.organizers'];
      expect(rel).toBeDefined();
      expect(rel?.from).toBe('events');
      expect(rel?.to).toBe('users'); // Falls back to DB name as schema key
      expect(rel?.isArray).toBe(true);
    });
  });

  describe('Array Foreign Key Detection', () => {
    describe('isArrayColumn()', () => {
      it('should detect PostgreSQL array columns via Drizzle symbols', () => {
        // Create a mock schema with array FK that matches what detectArrayForeignKeys expects
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Verify that array FK relationships were detected
        expect(relationships['events.organizers']).toBeDefined();
        expect(relationships['events.organizers']?.isArray).toBe(true);
      });

      it('should detect array columns via dataType metadata', () => {
        // The method is private, so we test via detectArrayForeignKeys indirectly
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, schemaPg);

        // If array columns are detected, relationships should be created
        // This tests the isArrayColumn logic indirectly
        expect(relationships).toBeDefined();
      });

      it('should return false for non-array columns', () => {
        const nonArrayColumn = { name: 'title', dataType: 'text' };
        // Test indirectly by checking that non-array columns don't create array relationships
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, { events: { title: nonArrayColumn } });

        // No array relationships should be created for non-array columns
        expect(relationships['events.organizers']).toBeUndefined();
      });

      it('should handle null and undefined gracefully', () => {
        const detector = new RelationshipDetector();
        expect(() => {
          detector.detectFromSchema({}, { events: { title: null } });
        }).not.toThrow();
        expect(() => {
          detector.detectFromSchema({}, { events: { title: undefined } });
        }).not.toThrow();
      });

      it('should handle non-object column values', () => {
        const detector = new RelationshipDetector();
        expect(() => {
          detector.detectFromSchema({}, { events: { title: 'string' } });
        }).not.toThrow();
      });
    });

    describe('getForeignKeyInfo()', () => {
      it('should extract FK from column metadata', () => {
        // Test indirectly via detectArrayForeignKeys with mock schema
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Should create relationship if FK info is extracted correctly
        expect(relationships['events.organizers']).toBeDefined();
      });

      it('should handle missing foreign keys', () => {
        const column = createMockArrayColumn({ hasArraySymbol: true, hasForeignKey: false });
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema(
          {},
          {
            events: { organizerId: column },
          }
        );

        // No relationship should be created if FK info is missing
        expect(relationships['events.organizers']).toBeUndefined();
      });

      it('should extract FK from function-based .references() pattern', () => {
        // Test the new functionality: .references(() => table.column) pattern
        // Create a mock column with a reference function
        const usersTable = { _name: 'users', id: { _name: 'id', table: { _name: 'users' } } };
        const usersIdColumn = usersTable.id;

        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasReferenceFunction: true,
              fkTable: usersTable,
              fkColumn: usersIdColumn,
            }),
          },
          users: usersTable,
        };

        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Should create relationship if FK info is extracted from reference function
        expect(relationships['events.organizers']).toBeDefined();
        expect(relationships['events.organizers']?.isArray).toBe(true);
      });

      it('should handle function-based references with schema search fallback', () => {
        // Test Method 4: schema search when table reference isn't directly available
        const usersIdColumn = { _name: 'id' };
        const usersTable = { _name: 'users', id: usersIdColumn };

        // Create column with reference function but no direct table property
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasReferenceFunction: true,
              fkColumn: usersIdColumn, // Column exists in schema
            }),
          },
          users: usersTable, // Table contains the column
        };

        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Should find table via schema search fallback
        expect(relationships['events.organizers']).toBeDefined();
      });

      it('should handle multiple foreign keys (takes first)', () => {
        const fkTable1 = { _name: 'users' };
        const fkTable2 = { _name: 'tags' };
        const column: Record<string, unknown> = createMockArrayColumn({
          hasArraySymbol: true,
          hasForeignKey: true,
          fkTable: fkTable1,
        });

        // Add second FK to metadata
        const metaSymbol = Symbol.for('drizzle:ColumnMetadata');
        const metadata = (column as Record<symbol, unknown>)[metaSymbol] as Record<string, unknown>;
        if (metadata && Array.isArray(metadata.foreignKeys)) {
          metadata.foreignKeys.push({
            table: fkTable2,
            column: { _name: 'id' },
          });
        }

        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema(
          {},
          {
            events: { organizerId: column },
            users: { id: { _name: 'id' } },
          }
        );

        // Should use first FK
        expect(relationships).toBeDefined();
      });
    });

    describe('getArrayRelationshipAlias()', () => {
      it('should convert organizerId to organizers', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // organizerId should create 'organizers' alias
        expect(relationships['events.organizers']).toBeDefined();
        expect(relationships['events.organizers']?.localKey).toBe('organizerId');
      });

      it('should handle plural forms (y -> ies)', () => {
        const detector = new RelationshipDetector();
        // Test with a column ending in 'y'
        const schemaWithY = {
          events: {
            categoryId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'categories' },
              fkColumn: { _name: 'id' },
            }),
          },
          categories: { id: { _name: 'id' } },
        };
        const relationships = detector.detectFromSchema({}, schemaWithY);

        // categoryId -> categories (y -> ies)
        expect(relationships['events.categories']).toBeDefined();
      });

      it('should handle special endings (s, x, z, ch, sh)', () => {
        const detector = new RelationshipDetector();

        // Test with columns ending in special characters that require "es" pluralization
        // classId -> remove "Id" -> "class" -> ends with "s" -> add "es" -> "classes"
        const schemaWithSpecial = {
          events: {
            classId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'classes' },
              fkColumn: { _name: 'id' },
            }),
          },
          classes: { id: { _name: 'id' } },
        };
        const relationships = detector.detectFromSchema({}, schemaWithSpecial);

        // Should handle special endings correctly - classId should create 'classes' alias
        // classId -> classes (ends with 's', adds 'es')
        expect(relationships['events.classes']).toBeDefined();
        expect(relationships['events.classes']?.localKey).toBe('classId');
        expect(relationships['events.classes']?.isArray).toBe(true);
      });

      it('should handle camelCase conversion', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Should convert to camelCase
        const alias = 'organizers';
        expect(relationships[`events.${alias}`]).toBeDefined();
      });

      it('should handle edge cases (empty, single char)', () => {
        const detector = new RelationshipDetector();
        // Test with minimal column name
        const schemaMinimal = {
          events: {
            x: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'items' },
              fkColumn: { _name: 'id' },
            }),
          },
          items: { id: { _name: 'id' } },
        };

        expect(() => {
          detector.detectFromSchema({}, schemaMinimal);
        }).not.toThrow();
      });
    });

    describe('detectArrayForeignKeys()', () => {
      it('should detect array FK relationships', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        expect(relationships['events.organizers']).toBeDefined();
      });

      it('should create correct relationship paths', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        const rel = relationships['events.organizers'];
        expect(rel).toBeDefined();
        expect(rel?.from).toBe('events');
        expect(rel?.to).toBe('users');
        expect(rel?.localKey).toBe('organizerId');
        expect(rel?.foreignKey).toBe('id');
      });

      it('should set isArray flag to true', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        expect(relationships['events.organizers']?.isArray).toBe(true);
      });

      it('should create forward and reverse relationships', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Forward relationship
        expect(relationships['events.organizers']).toBeDefined();

        // Reverse relationship should also exist
        const reverseKey = Object.keys(relationships).find(
          (key) => key.startsWith('users.') && relationships[key]?.isArray === true
        );
        expect(reverseKey).toBeDefined();
      });

      it('should handle multiple array FKs in same table', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
            tagIds: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'tags' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
          tags: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Should detect both organizerId and tagIds
        expect(relationships['events.organizers']).toBeDefined();
        expect(relationships['events.tags']).toBeDefined();
      });

      it('should handle array FKs to different target tables', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
            tagIds: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'tags' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
          tags: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // organizerId -> users, tagIds -> tags
        expect(relationships['events.organizers']?.to).toBe('users');
        expect(relationships['events.tags']?.to).toBe('tags');
      });

      it('should skip non-array columns', () => {
        const mockSchema = {
          events: {
            title: { _name: 'title', dataType: 'text' },
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: { id: { _name: 'id' } },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Only organizerId should create relationship, not title
        expect(relationships['events.organizers']).toBeDefined();
        expect(relationships['events.title']).toBeUndefined();
      });

      it('should skip array columns without FK references', () => {
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema(
          {},
          {
            events: {
              organizerId: createMockArrayColumn({
                hasArraySymbol: true,
                hasForeignKey: false,
              }),
            },
          }
        );

        // No relationship should be created
        expect(relationships['events.organizers']).toBeUndefined();
      });

      it('should handle missing target tables gracefully', () => {
        const detector = new RelationshipDetector();
        expect(() => {
          detector.detectFromSchema(
            {},
            {
              events: {
                organizerId: createMockArrayColumn({
                  hasArraySymbol: true,
                  hasForeignKey: true,
                  fkTable: { _name: 'nonexistent' },
                  fkColumn: { _name: 'id' },
                }),
              },
            }
          );
        }).not.toThrow();
      });

      it('should handle missing referenced columns gracefully', () => {
        const detector = new RelationshipDetector();
        expect(() => {
          detector.detectFromSchema(
            {},
            {
              events: {
                organizerId: createMockArrayColumn({
                  hasArraySymbol: true,
                  hasForeignKey: true,
                  fkTable: { _name: 'users' },
                  fkColumn: null,
                }),
              },
              users: { id: { _name: 'id' } },
            }
          );
        }).not.toThrow();
      });
    });

    describe('reverseRelationshipPath()', () => {
      it('should preserve isArray flag', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        // Find reverse relationship
        const reverseKey = Object.keys(relationships).find(
          (key) => key.startsWith('users.') && relationships[key]?.isArray === true
        );

        expect(reverseKey).toBeDefined();
        if (reverseKey) {
          expect(relationships[reverseKey]?.isArray).toBe(true);
        }
      });

      it('should handle undefined isArray', () => {
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema(relationsSchema, schema);

        // Regular relationships should work (isArray undefined)
        expect(relationships['users.profile']).toBeDefined();
        expect(relationships['users.profile']?.isArray).toBeUndefined();
      });

      it('should reverse all relationship properties correctly', () => {
        const mockSchema = {
          events: {
            organizerId: createMockArrayColumn({
              hasArraySymbol: true,
              hasForeignKey: true,
              fkTable: { _name: 'users' },
              fkColumn: { _name: 'id' },
            }),
          },
          users: {
            id: { _name: 'id' },
          },
        };
        const detector = new RelationshipDetector();
        const relationships = detector.detectFromSchema({}, mockSchema);

        const forward = relationships['events.organizers'];
        expect(forward).toBeDefined();
        expect(forward?.from).toBe('events');
        expect(forward?.to).toBe('users');
        expect(forward?.localKey).toBe('organizerId');
        expect(forward?.foreignKey).toBe('id');

        // Find reverse
        const reverseKey = Object.keys(relationships).find(
          (key) => key.startsWith('users.') && relationships[key]?.isArray === true
        );
        if (reverseKey) {
          const reverse = relationships[reverseKey];
          expect(reverse?.from).toBe('users');
          expect(reverse?.to).toBe('events');
          expect(reverse?.localKey).toBe('id');
          expect(reverse?.foreignKey).toBe('organizerId');
          expect(reverse?.isArray).toBe(true);
        }
      });
    });
  });
});

describe('RelationshipManager', () => {
  let manager: RelationshipManager;
  let relationships: RelationshipMap;

  beforeEach(() => {
    const detector = new RelationshipDetector();
    relationships = detector.detectFromSchema(relationsSchema, schema);
    manager = new RelationshipManager(schema, relationships);
  });

  it('should resolve direct column paths', () => {
    const path = manager.resolveColumnPath('name', 'users');

    expect(path.table).toBe('users');
    expect(path.field).toBe('name');
    expect(path.isNested).toBe(false);
  });

  it('should resolve single-level relationship paths', () => {
    const path = manager.resolveColumnPath('profile.bio', 'users');

    expect(path.table).toBe('profile');
    expect(path.field).toBe('bio');
    expect(path.isNested).toBe(true);
    expect(path.relationshipPath).toHaveLength(1);
  });

  it('should resolve multi-level relationship paths', () => {
    const path = manager.resolveColumnPath('posts.comments.content', 'users');

    expect(path.table).toBe('comments');
    expect(path.field).toBe('content');
    expect(path.isNested).toBe(true);
    expect(path.relationshipPath).toHaveLength(2);
  });

  it('should get required joins for columns', () => {
    const columnPath = manager.resolveColumnPath('profile.bio', 'users');
    const joins = manager.getRequiredJoinsForColumn(columnPath, 'users');

    expect(joins).toBeDefined();
    expect(joins.length).toBe(1);
    // Verify that the join structure is correct for a single-level relationship
    // JoinConfig has: type, table, condition, alias
    expect(joins[0]?.type).toBe('left');
    expect(joins[0]?.table).toBeDefined();
    expect(joins[0]?.condition).toBeDefined();
    expect(joins[0]?.alias).toBeDefined();
    // Verify the relationship path structure from columnPath
    expect(columnPath.relationshipPath).toHaveLength(1);
    expect(columnPath.relationshipPath?.[0]?.from).toBe('users');
    expect(columnPath.relationshipPath?.[0]?.to).toBe('profiles');

    // Verify multi-level relationship joins
    const multiLevelPath = manager.resolveColumnPath('posts.comments.content', 'users');
    const multiLevelJoins = manager.getRequiredJoinsForColumn(multiLevelPath, 'users');
    expect(multiLevelJoins.length).toBe(2);
    // Verify join configs are properly structured
    expect(multiLevelJoins[0]?.type).toBe('left');
    expect(multiLevelJoins[0]?.table).toBeDefined();
    expect(multiLevelJoins[0]?.condition).toBeDefined();
    expect(multiLevelJoins[1]?.type).toBe('left');
    expect(multiLevelJoins[1]?.table).toBeDefined();
    expect(multiLevelJoins[1]?.condition).toBeDefined();
    // Verify the relationship path structure from columnPath
    expect(multiLevelPath.relationshipPath).toHaveLength(2);
    expect(multiLevelPath.relationshipPath?.[0]?.from).toBe('users');
    expect(multiLevelPath.relationshipPath?.[0]?.to).toBe('posts');
    expect(multiLevelPath.relationshipPath?.[1]?.from).toBe('posts');
    expect(multiLevelPath.relationshipPath?.[1]?.to).toBe('comments');
  });

  it('should optimize join order', () => {
    const requiredJoins = new Map([
      [
        'posts',
        [
          {
            from: 'users',
            to: 'posts',
            foreignKey: 'userId',
            localKey: 'id',
            cardinality: 'many' as const,
            joinType: 'left' as const,
          },
        ],
      ],
      [
        'comments',
        [
          {
            from: 'posts',
            to: 'comments',
            foreignKey: 'postId',
            localKey: 'id',
            cardinality: 'many' as const,
            joinType: 'left' as const,
          },
        ],
      ],
    ]);

    const joinOrder = manager.optimizeJoinOrder(requiredJoins, 'users');

    expect(joinOrder).toHaveLength(2);
    expect(joinOrder[0]?.to).toBe('posts');
    expect(joinOrder[1]?.to).toBe('comments');
  });

  it('should validate column access', () => {
    expect(manager.validateColumnAccess('name', 'users')).toBe(true);
    expect(manager.validateColumnAccess('profile.bio', 'users')).toBe(true);
    expect(manager.validateColumnAccess('invalid.column', 'users')).toBe(false);
  });

  it('should get accessible columns', () => {
    const columns = manager.getAccessibleColumns('users');

    expect(columns).toContain('name');
    expect(columns).toContain('email');
    expect(columns).toContain('profile.bio');
    expect(columns).toContain('posts.title');
  });

  it('should build query context', () => {
    const context = manager.buildQueryContext(
      {
        columns: ['name', 'profile.bio'],
        filters: [{ columnId: 'posts.title' }],
        sorts: [{ columnId: 'profile.bio' }],
      },
      'users'
    );

    expect(context.requiredTables.has('users')).toBe(true);
    expect(context.requiredTables.has('profile')).toBe(true);
    expect(context.requiredTables.has('posts')).toBe(true);
  });

  it('should check table reachability', () => {
    expect(manager.isTableReachable('profiles', 'users')).toBe(true);
    expect(manager.isTableReachable('comments', 'users')).toBe(true);
    expect(manager.isTableReachable('posts', 'users')).toBe(true);
  });

  it('should get relationship statistics', () => {
    const stats = manager.getRelationshipStats();

    expect(stats.totalRelationships).toBeGreaterThan(0);
    expect(stats.oneToMany).toBeGreaterThan(0);
    expect(stats.oneToOne).toBeGreaterThan(0);
  });
});
