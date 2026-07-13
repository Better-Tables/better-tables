import { describe, expect, expectTypeOf, it } from 'bun:test';
import {
  betterTablesV1,
  defineTableRowV1,
  defineTableV1,
  type Paths,
  type PathsOfType,
  type PathValue,
  type SchemaAwareAdapter,
} from '../../src/types/experimental/table-def-v1';

/**
 * Type-level acceptance tests for the plan 011 "path-typed" prototype
 * (`src/types/experimental/table-def-v1.ts`). See
 * `plans/design/table-definition-dx.md` for the design these validate.
 *
 * Fixture is DELIBERATELY mutually recursive (User -> Post -> User -> ...)
 * to exercise the depth cap in `Paths`.
 */

interface Profile {
  location: string | null;
  website?: string;
}

interface Post {
  title: string;
  views: number;
  author: User;
}

interface User {
  id: string;
  firstName: string;
  age: number;
  role: 'admin' | 'editor';
  profile?: Profile | null;
  posts: Post[];
}

type Schema = {
  users: { row: User };
  posts: { row: Post };
  profiles: { row: Profile };
};

// A dummy value cast to the schema-aware adapter shape. `$types` is a
// type-only phantom (see table-def-v1.ts) -- never actually populated.
const fakeAdapter = {} as SchemaAwareAdapter<{ tables: Schema }>;
const tables = betterTablesV1({ database: fakeAdapter });

describe('table-def-v1 prototype (plan 011)', () => {
  describe('Paths<T> -- runtime path semantics lifted to the type level', () => {
    it('includes plain fields, a to-one relation path, and a to-many relation path', () => {
      const p1: Paths<User> = 'role';
      const p2: Paths<User> = 'profile.location';
      const p3: Paths<User> = 'posts.title';
      expect([p1, p2, p3]).toEqual(['role', 'profile.location', 'posts.title']);
    });

    it('allows a depth-3 path through the mutual recursion (2 dots)', () => {
      // users -> posts -> author -> posts: 3 segments, 2 dots, within the
      // depth-3 cap (top-level Paths<User, 3> call decrements to 0 by here).
      const p: Paths<User> = 'posts.author.posts';
      expect(p).toBe('posts.author.posts');
    });

    it('caps recursion at depth 3 -- a 4-segment path is NOT reachable (pinned)', () => {
      // @ts-expect-error - 'posts.author.posts.title' is 4 segments / 3 dots,
      // one level beyond what Paths<User, 3> (the default depth cap)
      // produces. This is the pinned expectation from plan 011 Step 4 item 1.
      const tooDeep: Paths<User> = 'posts.author.posts.title';
      expect(typeof tooDeep).toBe('string');
    });
  });

  describe('PathsOfType<T, V> -- paths filtered by resolved value type', () => {
    it('includes a direct numeric field and a numeric field through an array relation', () => {
      const n1: PathsOfType<User, number> = 'age';
      const n2: PathsOfType<User, number> = 'posts.views';
      expect([n1, n2]).toEqual(['age', 'posts.views']);
    });

    it('excludes a string field from the numeric-paths union', () => {
      // @ts-expect-error - 'firstName' resolves to `string`, not `number`
      const bad: PathsOfType<User, number> = 'firstName';
      expect(typeof bad).toBe('string');
    });
  });

  describe('PathValue<T, P> -- nullability propagation', () => {
    it('unions `null` when traversing an optional+nullable relation to a nullable field', () => {
      expectTypeOf<PathValue<User, 'profile.location'>>().toEqualTypeOf<string | null>();
    });

    it('does not add nullability for a required scalar field', () => {
      expectTypeOf<PathValue<User, 'age'>>().toEqualTypeOf<number>();
    });

    it('resolves a path through a required array relation to the element field type', () => {
      expectTypeOf<PathValue<User, 'posts.views'>>().toEqualTypeOf<number>();
    });
  });

  describe('t.number() -- path autocomplete restricted to numeric paths', () => {
    it('accepts a numeric path', () => {
      const def = defineTableV1<typeof tables>()('users', (t) => ({
        columns: [t.number('age').range(0, 130)],
      }));
      expect(def.tableName).toBe('users');
    });

    it('rejects a non-numeric path (the literal example from the design doc)', () => {
      defineTableV1<typeof tables>()('users', (t) => ({
        // @ts-expect-error - 'firstName' is a string path, not numeric
        columns: [t.number('firstName')],
      }));
      expect(true).toBe(true);
    });
  });

  describe('t.option() -- value type inferred from the path, options() checked against it', () => {
    it('infers the literal union `"admin" | "editor"` from the `role` path', () => {
      const def = defineTableV1<typeof tables>()('users', (t) => ({
        columns: [
          t.option('role').options([
            { value: 'admin', label: 'Admin' },
            { value: 'editor', label: 'Editor' },
          ]),
        ],
      }));
      expect(def.tableName).toBe('users');
    });

    it('rejects an option value outside the literal union', () => {
      defineTableV1<typeof tables>()('users', (t) => ({
        columns: [
          // @ts-expect-error - 'bogus' is not a member of 'admin' | 'editor'
          t.option('role').options([{ value: 'bogus', label: 'Bogus' }]),
        ],
      }));
      expect(true).toBe(true);
    });
  });

  describe('t.count() -- restricted to array-relation paths', () => {
    it('accepts a path to an array relation', () => {
      const def = defineTableV1<typeof tables>()('users', (t) => ({
        columns: [t.count('posts')],
      }));
      expect(def.tableName).toBe('users');
    });

    it('rejects a path to a non-array (to-one) relation', () => {
      defineTableV1<typeof tables>()('users', (t) => ({
        // @ts-expect-error - 'profile' is a to-one relation, not an array
        columns: [t.count('profile')],
      }));
      expect(true).toBe(true);
    });
  });

  describe('defineTableV1 -- table-name safety and the tier-2 escape hatch', () => {
    it('rejects a table name absent from the schema catalog', () => {
      defineTableV1<typeof tables>()(
        // @ts-expect-error - 'widgets' is not a key of Schema
        'widgets',
        (t) => ({ columns: [t.text('firstName')] })
      );
      expect(true).toBe(true);
    });

    it('the tier-2 explicit-row form compiles for a schema-less (REST-style) adapter', () => {
      interface RestCustomer {
        id: string;
        email: string;
      }

      const def = defineTableRowV1<RestCustomer>()('customers', (t) => ({
        columns: [t.text('email')],
      }));

      expect(def.tableName).toBe('customers');
    });
  });
});
