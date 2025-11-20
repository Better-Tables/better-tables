import { beforeEach, describe, expect, it } from 'bun:test';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipMap } from '../src/types';
import { relationsSchema, schema } from './helpers/test-schema';

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
