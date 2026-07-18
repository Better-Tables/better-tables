/**
 * Unit tests for DrizzlePredicateEmitter.prefersDateSemantics — used by the
 * filter router for `between`/`notBetween` timestamp fallback when the filter's
 * `columnType` isn't `'date'`.
 */

import { describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { date, datetime, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { pgTable, text as pgText, timestamp } from 'drizzle-orm/pg-core';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzlePredicateEmitter } from '../src/drizzle-predicate-emitter';

const pgUsers = pgTable('users', {
  id: timestamp('id').primaryKey(),
  createdAt: timestamp('created_at'),
  name: pgText('name'),
});

const mysqlUsers = mysqlTable('users', {
  id: datetime('id').primaryKey(),
  createdAt: datetime('created_at'),
  bornOn: date('born_on'),
  name: varchar('name', { length: 64 }),
});

const sqliteUsers = sqliteTable('users', {
  id: integer('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  name: text('name'),
  plainInt: integer('plain_int'),
});

describe('DrizzlePredicateEmitter.prefersDateSemantics', () => {
  describe('postgres', () => {
    const emitter = new DrizzlePredicateEmitter({ users: pgUsers }, 'postgres');

    it('returns true for PgTimestamp columns', () => {
      expect(emitter.prefersDateSemantics(pgUsers.createdAt)).toBe(true);
      expect(emitter.prefersDateSemantics(pgUsers.id)).toBe(true);
    });

    it('returns false for text columns', () => {
      expect(emitter.prefersDateSemantics(pgUsers.name)).toBe(false);
    });

    it('returns false for SQL expressions', () => {
      expect(emitter.prefersDateSemantics(sql`now()`)).toBe(false);
    });
  });

  describe('mysql', () => {
    const emitter = new DrizzlePredicateEmitter({ users: mysqlUsers }, 'mysql');

    it('returns true for MySqlDateTime / MySqlDate columns', () => {
      expect(emitter.prefersDateSemantics(mysqlUsers.createdAt)).toBe(true);
      expect(emitter.prefersDateSemantics(mysqlUsers.bornOn)).toBe(true);
    });

    it('returns false for varchar columns', () => {
      expect(emitter.prefersDateSemantics(mysqlUsers.name)).toBe(false);
    });
  });

  describe('sqlite', () => {
    const emitter = new DrizzlePredicateEmitter({ users: sqliteUsers }, 'sqlite');

    it('returns true for integer columns with mode: timestamp', () => {
      expect(emitter.prefersDateSemantics(sqliteUsers.createdAt)).toBe(true);
    });

    it('returns false for plain integer and text columns', () => {
      expect(emitter.prefersDateSemantics(sqliteUsers.plainInt)).toBe(false);
      expect(emitter.prefersDateSemantics(sqliteUsers.name)).toBe(false);
    });
  });
});
