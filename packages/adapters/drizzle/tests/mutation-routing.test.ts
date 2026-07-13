/**
 * Mutation table routing tests for DrizzleAdapter
 *
 * Regression coverage for the bug where createRecord/updateRecord/deleteRecord/
 * bulkUpdate/bulkDelete silently routed to whichever table happened to be
 * first in `Object.keys(schema)`, rather than an explicit, validated target.
 *
 * The schema used here intentionally puts `users` first and `profiles`
 * second so that any accidental reversion to "first table" routing is
 * caught by these tests.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../src/types';
import { SchemaError } from '../src/types';
import type { BunSQLiteDatabase } from './helpers/test-fixtures';
import { closeDatabase, createTestDatabase, setupTestDatabase } from './helpers/test-fixtures';
import { profiles, users } from './helpers/test-schema';

const multiTableSchema = { users, profiles };
const singleTableSchema = { users };

function buildAdapter(
  db: BunSQLiteDatabase,
  schema: typeof multiTableSchema,
  defaultMutationTable?: string
): DrizzleAdapter<typeof multiTableSchema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof multiTableSchema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema,
    driver: 'sqlite',
    autoDetectRelationships: false,
    ...(defaultMutationTable !== undefined ? { options: { defaultMutationTable } } : {}),
  };
  return new DrizzleAdapter(config);
}

function buildSingleTableAdapter(
  db: BunSQLiteDatabase
): DrizzleAdapter<typeof singleTableSchema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof singleTableSchema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema: singleTableSchema,
    driver: 'sqlite',
    autoDetectRelationships: false,
  };
  return new DrizzleAdapter(config);
}

describe('DrizzleAdapter - mutation table routing', () => {
  let db: BunSQLiteDatabase;
  let sqlite: Database;

  beforeEach(async () => {
    const created = createTestDatabase();
    db = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  describe('multi-table schema, no defaultMutationTable configured', () => {
    it('rejects createRecord with a SchemaError naming defaultMutationTable', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      await expect(
        adapter.createRecord({ id: 201, name: 'X', email: 'x@example.com' })
      ).rejects.toThrow(SchemaError);
      await expect(
        adapter.createRecord({ id: 201, name: 'X', email: 'x@example.com' })
      ).rejects.toThrow(/defaultMutationTable/);
    });

    it('rejects updateRecord with a SchemaError naming defaultMutationTable', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      await expect(adapter.updateRecord('1', { name: 'Updated' })).rejects.toThrow(SchemaError);
      await expect(adapter.updateRecord('1', { name: 'Updated' })).rejects.toThrow(
        /defaultMutationTable/
      );
    });

    it('rejects deleteRecord with a SchemaError naming defaultMutationTable', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      await expect(adapter.deleteRecord('1')).rejects.toThrow(SchemaError);
      await expect(adapter.deleteRecord('1')).rejects.toThrow(/defaultMutationTable/);
    });

    it('rejects bulkUpdate with a SchemaError naming defaultMutationTable', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      await expect(adapter.bulkUpdate(['1', '2'], { name: 'Updated' })).rejects.toThrow(
        SchemaError
      );
      await expect(adapter.bulkUpdate(['1', '2'], { name: 'Updated' })).rejects.toThrow(
        /defaultMutationTable/
      );
    });

    it('rejects bulkDelete with a SchemaError naming defaultMutationTable', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      await expect(adapter.bulkDelete(['1', '2'])).rejects.toThrow(SchemaError);
      await expect(adapter.bulkDelete(['1', '2'])).rejects.toThrow(/defaultMutationTable/);
    });

    it('advertises create/update/delete/bulkOperations as unsupported in meta.features', () => {
      const adapter = buildAdapter(db, multiTableSchema);
      expect(adapter.meta.features.create).toBe(false);
      expect(adapter.meta.features.update).toBe(false);
      expect(adapter.meta.features.delete).toBe(false);
      expect(adapter.meta.features.bulkOperations).toBe(false);
      // Read remains supported regardless of mutation routing.
      expect(adapter.meta.features.read).toBe(true);
    });
  });

  describe("multi-table schema with defaultMutationTable: 'profiles'", () => {
    it('routes createRecord to profiles, not the first schema table (users) - the core regression test', async () => {
      const adapter = buildAdapter(db, multiTableSchema, 'profiles');

      // Seed a user with the same id we're about to use for the profile,
      // so we can prove the mutation didn't land in `users`.
      await db.run(`
        INSERT INTO users (id, name, email, age, created_at) VALUES
          (99, 'Untouched User', 'untouched@example.com', 40, ${Date.now()});
      `);

      const created = await adapter.createRecord({
        id: 99,
        userId: 1,
        bio: 'Profile Bio',
        avatar: 'avatar99.jpg',
      });

      expect((created as { bio?: string }).bio).toBe('Profile Bio');

      const profileRaw = sqlite.query('SELECT * FROM profiles WHERE id = 99').all();
      expect(profileRaw).toHaveLength(1);
      expect((profileRaw[0] as { bio: string }).bio).toBe('Profile Bio');

      // The users row with the same id must be completely untouched.
      const userRaw = sqlite.query('SELECT * FROM users WHERE id = 99').all();
      expect(userRaw).toHaveLength(1);
      expect((userRaw[0] as { name: string }).name).toBe('Untouched User');
      expect((userRaw[0] as { email: string }).email).toBe('untouched@example.com');
    });

    it("deleteRecord removes from profiles and leaves an identically-id'd row in users untouched", async () => {
      const adapter = buildAdapter(db, multiTableSchema, 'profiles');

      await db.run(`
        INSERT INTO users (id, name, email, age, created_at) VALUES
          (98, 'Still Here', 'stillhere@example.com', 41, ${Date.now()});
      `);
      await db.run(`
        INSERT INTO profiles (id, user_id, bio, avatar) VALUES
          (98, 1, 'To be deleted', 'avatar98.jpg');
      `);

      await adapter.deleteRecord('98');

      const profileRaw = sqlite.query('SELECT * FROM profiles WHERE id = 98').all();
      expect(profileRaw).toHaveLength(0);

      const userRaw = sqlite.query('SELECT * FROM users WHERE id = 98').all();
      expect(userRaw).toHaveLength(1);
      expect((userRaw[0] as { name: string }).name).toBe('Still Here');
    });

    it('advertises create/update/delete/bulkOperations as supported in meta.features', () => {
      const adapter = buildAdapter(db, multiTableSchema, 'profiles');
      expect(adapter.meta.features.create).toBe(true);
      expect(adapter.meta.features.update).toBe(true);
      expect(adapter.meta.features.delete).toBe(true);
      expect(adapter.meta.features.bulkOperations).toBe(true);
    });
  });

  describe('single-table schema, no config (back-compat)', () => {
    it('createRecord still works without any defaultMutationTable configuration', async () => {
      const adapter = buildSingleTableAdapter(db);

      const created = await adapter.createRecord({
        id: 301,
        name: 'Solo Table User',
        email: 'solo@example.com',
        age: 22,
      });

      expect((created as { name?: string }).name).toBe('Solo Table User');

      const userRaw = sqlite.query('SELECT * FROM users WHERE id = 301').all();
      expect(userRaw).toHaveLength(1);
    });

    it('advertises create/update/delete/bulkOperations as supported in meta.features', () => {
      const adapter = buildSingleTableAdapter(db);
      expect(adapter.meta.features.create).toBe(true);
      expect(adapter.meta.features.update).toBe(true);
      expect(adapter.meta.features.delete).toBe(true);
      expect(adapter.meta.features.bulkOperations).toBe(true);
    });
  });

  describe("defaultMutationTable: 'nonexistent'", () => {
    it('does not throw at construction time', () => {
      expect(() => buildAdapter(db, multiTableSchema, 'nonexistent')).not.toThrow();
    });

    it('throws a SchemaError listing available tables on the first mutation', async () => {
      const adapter = buildAdapter(db, multiTableSchema, 'nonexistent');
      await expect(adapter.createRecord({ id: 1 })).rejects.toThrow(SchemaError);

      try {
        await adapter.createRecord({ id: 1 });
        throw new Error('expected createRecord to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaError);
        const schemaError = error as SchemaError;
        expect(schemaError.details?.availableTables).toEqual(['users', 'profiles']);
      }
    });

    it('advertises create/update/delete/bulkOperations as unsupported in meta.features', () => {
      const adapter = buildAdapter(db, multiTableSchema, 'nonexistent');
      expect(adapter.meta.features.create).toBe(false);
    });
  });
});
